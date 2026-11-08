import {createHash} from 'node:crypto';
import type {Pool} from 'pg';
import {chooseHouse,type HouseInput,type HouseDecision} from '../../domain/house';
import {canonicalJson} from '../../domain/proposals';
import {parseUtc} from '../../domain/types';
import {invariant} from '../../domain/errors';
import {transaction,type Tx} from '../db/client';
export interface StoredHouse {decision:HouseDecision;inputHash:string;precommittedAt:Date;inheritedFromBallot:string|null}
const projection='decision,input_hash AS "inputHash",precommitted_at AS "precommittedAt",inherited_from_ballot AS "inheritedFromBallot"';
async function existing(tx:Tx,id:string):Promise<StoredHouse|undefined>{return (await tx.query<StoredHouse>(`SELECT ${projection} FROM house_decisions WHERE ballot_id=$1`,[id])).rows[0];}
export async function lockHouseInTx(tx:Tx,id:string,input:HouseInput):Promise<StoredHouse>{
 invariant(input.policyVersion==='highest-strike-v1','house_policy','Unsupported paper House policy version');
 const ballot=(await tx.query<{state:string;opens_at:Date;round_id:string;rules:{dataCutoff?:string}}>('SELECT state,opens_at,round_id,rules FROM ballots WHERE id=$1 FOR UPDATE',[id])).rows[0];invariant(ballot,'ballot_unavailable','Ballot unavailable');
 const inputHash=createHash('sha256').update(canonicalJson(input)).digest('hex'),prior=await existing(tx,id);if(prior){invariant(prior.inputHash===inputHash,'house_locked','The paper House is already locked to a different snapshot');return prior;}
 const stamp=(await tx.query<{before:boolean;instant:Date;text:string}>(`WITH t AS MATERIALIZED (SELECT clock_timestamp() instant) SELECT t.instant,to_char(t.instant AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS text,t.instant<b.opens_at AS before FROM t,ballots b WHERE b.id=$1`,[id])).rows[0];
 invariant(ballot.state==='prepared'&&stamp.before,'house_too_late','The paper House must be committed before the original ballot opens');parseUtc(input.cutoff);invariant(Date.parse(input.cutoff)<=stamp.instant.getTime()&&Date.parse(input.cutoff)<ballot.opens_at.getTime(),'house_cutoff','House inputs cannot come from the future or after voting opens');
 invariant(!ballot.rules.dataCutoff||ballot.rules.dataCutoff===input.cutoff,'house_cutoff','The House must use the same predeclared data cutoff');
 const round=(await tx.query<{mode:string;expires_at:Date;rules:{source?:{providerId?:string;kind?:string;dataRightsReference?:string;recordReference?:string};referenceLamports?:string}}>('SELECT r.mode,r.expires_at,s.rules FROM rounds r JOIN seasons s ON s.id=r.season_id WHERE r.id=$1',[ballot.round_id])).rows[0];
 invariant(input.mode===round.mode&&input.expiresAt===round.expires_at.toISOString()&&input.providerId===round.rules.source?.providerId&&input.referenceLamports===round.rules.referenceLamports,'house_context','The House snapshot must match the frozen mode, provider, expiration and reference');
 let decision=chooseHouse(input);
 if(decision.kind==='call'&&!(round.rules.source?.kind==='verified_catalog'&&round.rules.source.dataRightsReference&&round.rules.source.recordReference))decision={kind:'hold',reason:'No approved real-source catalog is available; teaching data cannot support a competitive House call',policyVersion:input.policyVersion};
 return (await tx.query<StoredHouse>(`INSERT INTO house_decisions(ballot_id,policy_version,cutoff_at,precommitted_at,input_hash,input,decision) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb) RETURNING ${projection}`,[id,input.policyVersion,input.cutoff,stamp.text,inputHash,JSON.stringify(input),JSON.stringify(decision)])).rows[0];
}
// Internal service: no HTTP path accepts House inputs or a caller-selected outcome.
export async function lockHouse(db:Pool,id:string,input:HouseInput):Promise<StoredHouse>{return transaction(db,tx=>lockHouseInTx(tx,id,input));}
export async function inheritHouseInTx(tx:Tx,oldId:string,newId:string):Promise<StoredHouse>{
 const rows=(await tx.query<{id:string;round_id:string;opens_at:Date;closes_at:Date;superseded_by:string|null;rules:{candidateVersions?:unknown;dataCutoff?:string}}>('SELECT id,round_id,opens_at,closes_at,superseded_by,rules FROM ballots WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[[oldId,newId]])).rows,old=rows.find(b=>b.id===oldId),replacement=rows.find(b=>b.id===newId);
 invariant(old&&replacement&&old.superseded_by===newId&&old.round_id===replacement.round_id&&old.opens_at.getTime()===replacement.opens_at.getTime()&&old.closes_at.getTime()===replacement.closes_at.getTime(),'house_context','Only an explicit same-round, same-window supersession may inherit a House choice');
 invariant(canonicalJson(old.rules.candidateVersions??[])===canonicalJson(replacement.rules.candidateVersions??[])&&old.rules.dataCutoff===replacement.rules.dataCutoff,'house_context','Changed candidates or cutoffs cannot inherit the old House decision');
 const parent=(await tx.query<{policy_version:string;cutoff_at:Date;precommitted_at:Date;input_hash:string;input:HouseInput;decision:HouseDecision}>('SELECT * FROM house_decisions WHERE ballot_id=$1',[oldId])).rows[0];invariant(parent&&parent.precommitted_at<old.opens_at,'house_unavailable','The original ballot has no valid earlier House precommit');
 const prior=await existing(tx,newId);if(prior){invariant(prior.inputHash===parent.input_hash,'house_locked','The replacement House is already locked differently');return prior;}
 return (await tx.query<StoredHouse>(`INSERT INTO house_decisions(ballot_id,policy_version,cutoff_at,precommitted_at,input_hash,input,decision,inherited_from_ballot) SELECT $2,policy_version,cutoff_at,precommitted_at,input_hash,input,decision,$1 FROM house_decisions WHERE ballot_id=$1 RETURNING ${projection}`,[oldId,newId])).rows[0];
}
export async function inheritHouse(db:Pool,oldId:string,newId:string):Promise<StoredHouse>{return transaction(db,tx=>inheritHouseInTx(tx,oldId,newId));}
export async function configuredHouseInput(tx:Tx,roundId:string,cutoff:string):Promise<HouseInput>{
 const row=(await tx.query<{mode:'simulation'|'live';expires_at:Date;rules:{source?:{providerId?:string};referenceLamports?:string}}>('SELECT r.mode,r.expires_at,s.rules FROM rounds r JOIN seasons s ON s.id=r.season_id WHERE r.id=$1',[roundId])).rows[0];
 invariant(row?.rules.source?.providerId&&row.rules.referenceLamports,'house_context','Frozen provider and reference rules are required');
 // No permitted provider/market catalog exists yet. Unknown observations stay absent.
 // A future approved source reader must preserve this same cutoff and private/public boundary.
 return {policyVersion:'highest-strike-v1',mode:row.mode,providerId:row.rules.source.providerId,expiresAt:row.expires_at.toISOString(),referenceLamports:row.rules.referenceLamports,cutoff,spot:null,usdPerUsdc:null,fxSource:null,limits:null,candidates:[]};
}
