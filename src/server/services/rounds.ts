import type {Pool} from 'pg';
import type {Clock} from '../../domain/clock';
import {invariant} from '../../domain/errors';
import {validateSeasonSchedule,transitionRound,type RoundSchedule,type RoundState} from '../../domain/round-policy';
import {parseId,parseUtc,unitsSchema,type TradingMode} from '../../domain/types';
import {inGuild} from '../db/repositories';
import {transaction,type Tx} from '../db/client';
import {enqueue} from '../jobs/queue';
import {audit} from './audit';
export interface SeasonInput {mode:TradingMode;division:string;rulesVersion:string;schedules:RoundSchedule[]}
// Created only by server catalog/readiness code. HTTP never accepts a readiness object.
export type SeasonSource={kind:'synthetic';providerId:string;expirations:string[]}|{kind:'verified_catalog';providerId:string;expirations:string[];gate0Passed:true;dataRightsReference:string;recordReference:string;feeReserveLamports:string};
export interface RoundRecord {id:string;guild_id:string;season_id:string;mode:TradingMode;number:number;state:RoundState;schedule:RoundSchedule;expires_at:Date;revision:number}
export async function serverTime(tx:Tx,clock?:Clock):Promise<Date>{return clock?clock.now():(await tx.query<{instant:Date}>('SELECT clock_timestamp() AS instant')).rows[0].instant;}
export async function createSeason(db:Pool,userId:string,guildId:string,input:SeasonInput,source:SeasonSource,clock?:Clock):Promise<{id:string;rounds:{id:string}[]}> {
 return inGuild(db,userId,guildId,async(tx,scope)=>{
  invariant(scope.membership.role==='administrator','forbidden','An active guild administrator publishes the season timetable');
  invariant(input.mode==='simulation'||(source.kind==='verified_catalog'&&source.gate0Passed),'provider_unavailable','A live season requires verified provider access, permissions and settlement evidence');
  parseId(input.division);parseId(input.rulesVersion);parseId(source.providerId);validateSeasonSchedule(input.schedules);
  invariant(source.expirations.length===4&&input.schedules.every((s,i)=>s.expiresAt===source.expirations[i]),'instrument_expiration','Each round must fit its actual catalog expiration');
  for(const e of source.expirations)parseUtc(e);
  const now=await serverTime(tx,clock);invariant(Date.parse(input.schedules[0].researchOpen)>now.getTime(),'schedule_started','Publish the entire timetable before research opens');
  const allocation=10000000000n,reserve=BigInt(unitsSchema.parse(source.kind==='synthetic'?'10000000':source.feeReserveLamports));invariant(reserve>0n&&reserve<allocation,'fee_reserve','Declare a positive uncovered SOL fee reserve below the reference allocation');
  const rules={allocationLamports:allocation.toString(),reserveLamports:reserve.toString(),candidateLimit:2,quorum:'strict_majority',ballotHours:12,executionMaxMinutes:60,source,ranking:source.kind==='synthetic'?'teaching_only':'eligible_subject_to_quality',liveCohort:'independent_registered_cohort',referenceLamports:(allocation-reserve).toString(),rosterPolicy:'active_linked_members_at_opening; accepted_before_opening_snapshot'};
  const season=(await tx.query<{id:string}>('INSERT INTO seasons(guild_id,mode,division,rules_version,rules) VALUES($1,$2,$3,$4,$5::jsonb) RETURNING id',[guildId,input.mode,input.division,input.rulesVersion,JSON.stringify(rules)])).rows[0];
  const rounds:{id:string}[]=[];
  for(const [i,s] of input.schedules.entries())rounds.push((await tx.query<{id:string}>("INSERT INTO rounds(guild_id,season_id,mode,number,state,schedule,expires_at) VALUES($1,$2,$3,$4,'research',$5::jsonb,$6) RETURNING id",[guildId,season.id,input.mode,i+1,JSON.stringify(s),s.expiresAt])).rows[0]);
  await audit(tx,{actorId:userId,guildId,kind:'season_published',recordId:season.id,reason:'Four fixed schedules and mode; source and comparison rules frozen',record:{mode:input.mode,providerId:source.providerId,rulesVersion:input.rulesVersion}});return {id:season.id,rounds};
 });
}
export async function changeRoundInTx(tx:Tx,row:RoundRecord,to:RoundState,operationId:string,reason:string,now:Date):Promise<void> {
 invariant(reason.trim().length>=3&&reason.length<=1000,'reason_required','A recorded transition requires a visible reason');
 const prior=(await tx.query('SELECT round_id,to_state,reason FROM round_events WHERE operation_id=$1',[operationId])).rows[0];
 if(prior){invariant(prior.round_id===row.id&&prior.to_state===to&&prior.reason===reason,'operation_conflict','This operation already refers to a different transition');return;}
 invariant(row.state!==to,'already_transitioned','Round already reached this state');transitionRound(row.state,to);
 await tx.query('INSERT INTO round_events(round_id,from_state,to_state,operation_id,reason,occurred_at,record) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)',[row.id,row.state,to,operationId,reason,now,JSON.stringify({scheduleRevision:1,rulesFromSeason:row.season_id})]);
 await tx.query('UPDATE rounds SET state=$2,revision=revision+1 WHERE id=$1',[row.id,to]);row.state=to;row.revision++;
}
// Internal service capability; not exposed as an arbitrary state/clock HTTP mutation.
export async function transitionRecorded(db:Pool,id:string,to:RoundState,operationId:string,reason:string,clock?:Clock):Promise<void>{await transaction(db,async tx=>{const row=(await tx.query<RoundRecord>('SELECT * FROM rounds WHERE id=$1 FOR UPDATE',[id])).rows[0];invariant(row,'round_unavailable','Round unavailable');await changeRoundInTx(tx,row,to,operationId,reason,await serverTime(tx,clock));});}
export async function advanceRoundInTx(tx:Tx,id:string,clock?:Clock):Promise<RoundRecord> {
  const row=(await tx.query<RoundRecord>('SELECT * FROM rounds WHERE id=$1 FOR UPDATE',[id])).rows[0];invariant(row,'round_unavailable','Round unavailable');const now=await serverTime(tx,clock),t=now.getTime(),s=row.schedule;
  if(!s.researchOpen)return row; // Pre-service legacy/synthetic constraint fixtures are not a published timetable.
  const step=async(to:RoundState,reason:string)=>changeRoundInTx(tx,row,to,`round:${row.id}:${to}`,reason,now);
  if(row.state==='research'&&t>=Date.parse(s.candidateLock))await step('candidate_lock','Published candidate lock reached');
  if(row.state==='candidate_lock'&&t>=Date.parse(s.voteOpen)) {
   if(t>=Date.parse(s.voteClose)){await step('unranked','Opening snapshot missed; no retroactive roster or favorable entry');return row;}
   await tx.query("INSERT INTO round_roster(round_id,user_id) SELECT $1,m.user_id FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.guild_id=$2 AND m.status='active' AND m.created_at<=$3 AND u.telegram_id IS NOT NULL ON CONFLICT DO NOTHING",[id,row.guild_id,s.voteOpen]);
   await step('voting','Opening roster frozen separately from live participation');
  }
  if(row.state==='voting'&&t>=Date.parse(s.voteClose)) {
   const ballots=(await tx.query("SELECT id FROM ballots WHERE round_id=$1 AND kind='opening' AND state='voting'",[id])).rows;
   for(const b of ballots)await enqueue(tx,{task:'close_ballot',operationId:`close:${b.id}`,payload:{ballotId:b.id}});
   // Ballot closure is authoritative; wall time alone cannot pick an outcome.
  }
  if(row.state==='execution_window'&&t>=Date.parse(s.executionClose))await step('open','Published individual execution window ended');
  if(row.state==='open'&&t>=Date.parse(s.midweekOpen))await step('midweek','Scheduled thesis reassessment window opened');
  if(row.state==='midweek'&&t>=Date.parse(s.expiresAt))await step('expired','Scheduled contract expiration reached; settlement remains unverified');
  if(row.state==='expired')await step('settlement_pending','Awaiting authoritative settlement records; expiration is not receipt of funds');
  return row;
}
export async function advanceRound(db:Pool,id:string,clock?:Clock):Promise<RoundRecord>{return transaction(db,tx=>advanceRoundInTx(tx,id,clock));}
export function nextRoundAction(row:RoundRecord,now:Date){
 const s=row.schedule,base=`/guilds/${row.guild_id}/rounds/${row.id}`;
 if(s.researchOpen&&now.getTime()<Date.parse(s.researchOpen))return {label:'Review the timetable',href:base,deadline:s.researchOpen};
 const actions:Record<RoundState,{label:string;href:string;deadline:string|null}>={research:{label:'Research and compare',href:base+'/research',deadline:s.candidateLock},candidate_lock:{label:'Review locked candidates',href:base,deadline:s.voteOpen},voting:{label:'Discuss and vote in Telegram',href:base,deadline:s.voteClose},execution_window:{label:row.mode==='simulation'?'Review automatic virtual booking':'Review your own decision',href:base,deadline:s.executionClose},open:{label:'Review your position',href:`/guilds/${row.guild_id}/positions`,deadline:s.midweekOpen},midweek:{label:'Reassess the thesis in Telegram',href:base,deadline:s.midweekClose},expired:{label:'Check settlement progress',href:`/guilds/${row.guild_id}/positions`,deadline:null},settlement_pending:{label:'Check settlement progress',href:`/guilds/${row.guild_id}/positions`,deadline:null},complete:{label:'Review results',href:`/guilds/${row.guild_id}/results`,deadline:null},cancelled:{label:'Review the cancellation',href:base,deadline:null},unranked:{label:'Review the data limitation',href:base,deadline:null}};
 return actions[row.state];
}
export function readRound(db:Pool,userId:string,guildId:string,id:string,clock?:Clock) {
 return inGuild(db,userId,guildId,async tx=>{const round=(await tx.query<RoundRecord>('SELECT * FROM rounds WHERE id=$1 AND guild_id=$2',[id,guildId])).rows[0];invariant(round,'round_unavailable','Round unavailable in this guild');const season=(await tx.query('SELECT mode,division,rules_version,rules FROM seasons WHERE id=$1',[round.season_id])).rows[0],events=(await tx.query('SELECT from_state,to_state,reason,occurred_at FROM round_events WHERE round_id=$1 ORDER BY created_at,id',[id])).rows;return {round,season,events,nextAction:nextRoundAction(round,await serverTime(tx,clock))};});
}
