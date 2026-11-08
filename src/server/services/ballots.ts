import {membersAtOpening} from './opening-roster';
import {prepareMidweekHoldInTx} from './midweek';
import {queueBallotNotificationInTx,queueVoteReceiptInTx} from './ballot-notifications';
import {createHash,randomUUID} from 'node:crypto';
import type {Pool} from 'pg';
import type {Clock} from '../../domain/clock';
import {ballotDecision,type BallotDecision} from '../../domain/ballots';
import {canonicalJson} from '../../domain/proposals';
import {z} from 'zod';
import {opaqueToken} from '../auth/crypto';
import {enqueue} from '../jobs/queue';
import {invariant} from '../../domain/errors';
import {transaction,type Tx} from '../db/client';
import {inGuild} from '../db/repositories';
import type {CallbackActor,CallbackReceipt} from '../telegram/callbacks';
import {advanceRoundInTx,serverTime,changeRoundInTx,type RoundRecord} from './rounds';
import {configuredHouseInput,lockHouseInTx,inheritHouseInTx} from './house';
import {validateFrozenSeasonTerms} from './proposals';
import type {PlanContext} from '../../domain/proposals';
import {audit} from './audit';
interface BallotRules {botId?:string;candidateVersions?:{id:string;hash:string}[];holdChoiceId?:string;dataCutoff?:string;midweekHoldOnly?:boolean;parentOpeningBallotId?:string;originalProposalVersionId?:string|null}
export interface BallotOutcome extends Omit<BallotDecision,'choiceId'> {choiceId:string|null;strategy:'call'|'hold';counts:{choiceId:string;votes:number}[];closedAt:string;detail?:string}
export interface BallotRecord {id:string;guild_id:string;round_id:string;state:string;kind:string;opens_at:Date;closes_at:Date;rules:BallotRules;outcome:BallotOutcome|null;cancel_reason:string|null;superseded_by:string|null}
interface Choice {id:string;proposal_version_id:string|null;label:string;content_hash:string|null;content:unknown}
async function lockBallot(tx:Tx,id:string){
 const initial=(await tx.query<BallotRecord>('SELECT * FROM ballots WHERE id=$1',[id])).rows[0];invariant(initial,'ballot_unavailable','Ballot unavailable');
 // Shared binding -> round -> ballot is the common mutation lock order. No network I/O here.
 const binding=(await tx.query<{chat_id:string;bot_id:string|null;active:boolean}>('SELECT chat_id,bot_id,active FROM group_bindings WHERE guild_id=$1 FOR SHARE',[initial.guild_id])).rows[0];
 const round=(await tx.query<RoundRecord>('SELECT * FROM rounds WHERE id=$1 FOR UPDATE',[initial.round_id])).rows[0];
 const ballot=(await tx.query<BallotRecord>('SELECT * FROM ballots WHERE id=$1 FOR UPDATE',[id])).rows[0];return {ballot,round,binding};
}
async function ballotClock(tx:Tx,id:string,clock?:Clock){
 const row=(await tx.query<{instant:Date;savedAt:string;timely:boolean;hasClosed:boolean}>(`WITH t AS MATERIALIZED (SELECT COALESCE($2::timestamptz,clock_timestamp()) AS instant) SELECT t.instant,to_char(t.instant AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "savedAt",(t.instant>=b.opens_at AND t.instant<b.closes_at) AS timely,(t.instant>=b.closes_at) AS "hasClosed" FROM t,ballots b WHERE b.id=$1`,[id,clock?.now().toISOString()??null])).rows[0];return row;
}
async function choices(tx:Tx,id:string):Promise<Choice[]>{return (await tx.query<Choice>('SELECT c.id,c.proposal_version_id,c.label,v.content_hash,v.content FROM ballot_choices c LEFT JOIN proposal_versions v ON v.id=c.proposal_version_id WHERE c.ballot_id=$1 ORDER BY c.id',[id])).rows;}
function validChoices(ballot:BallotRecord,rows:Choice[]):boolean {try{
 if(!ballot.rules||!Array.isArray(ballot.rules.candidateVersions))return false;
 const calls=rows.filter(c=>c.proposal_version_id),hold=rows.filter(c=>!c.proposal_version_id),locked=ballot.rules.candidateVersions;
 if(ballot.kind==='midweek'&&ballot.rules.midweekHoldOnly)return hold.length===1&&calls.length===0&&locked.length===0&&hold[0].id===ballot.rules.holdChoiceId&&!!ballot.rules.parentOpeningBallotId;
 if(hold.length!==1||hold[0].id!==ballot.rules.holdChoiceId||!locked||locked.length<1||locked.length>2||new Set(locked.map(v=>v.id)).size!==locked.length||calls.length!==locked.length)return false;
 return calls.every(c=>locked.some(v=>v.id===c.proposal_version_id&&v.hash===c.content_hash)&&createHash('sha256').update(canonicalJson(c.content)).digest('hex')===c.content_hash);
 }catch{return false;}
}
export async function castVoteInTx(tx:Tx,token:string,actor:CallbackActor,botId:string,clock?:Clock):Promise<CallbackReceipt> {
 invariant(/^[A-Za-z0-9_-]{43}$/.test(token),'invalid_button','This ballot button is invalid');
 const button=(await tx.query<{ballot_id:string;choice_id:string;chat_id:string;proposal_version_id:string|null}>('SELECT token,ballot_id,choice_id,chat_id,proposal_version_id FROM callback_tokens WHERE token=$1',[token])).rows[0];invariant(button,'invalid_button','This ballot button is unavailable');
 invariant(['group','supergroup'].includes(actor.chatType)&&actor.chatId===button.chat_id,'callback_context','Open the ballot in its original guild group');
 const locked=await lockBallot(tx,button.ballot_id),{ballot,binding}=locked;let time=await ballotClock(tx,ballot.id,clock),round=locked.round;
 if(ballot.state==='prepared'){invariant(time.timely,'ballot_not_open',time.hasClosed?'This ballot window has closed':'Voting has not opened yet');round=await activateInTx(tx,ballot,round,clock);}
 invariant(ballot.state==='voting'&&!time.hasClosed,'ballot_closed',ballot.superseded_by?'This ballot was superseded; open the replacement record':'This ballot is closed; check the canonical result');
 invariant(time.timely,'ballot_not_open','Voting has not opened yet');
 invariant((await tx.query('SELECT h.ballot_id FROM house_decisions h JOIN ballots b ON b.id=h.ballot_id WHERE h.ballot_id=$1 AND h.precommitted_at<b.opens_at',[ballot.id])).rowCount===1,'house_unavailable','The original paper House snapshot is missing; no retrospective choice is permitted');
 invariant(binding?.active&&binding.chat_id===button.chat_id&&binding.bot_id===botId&&ballot.rules.botId===botId,'group_unavailable','Guild group or bot permissions changed; check the canonical ballot');
 const roster=(await tx.query<{id:string}>('SELECT u.id FROM ballot_roster r JOIN users u ON u.id=r.user_id JOIN memberships m ON m.user_id=u.id AND m.guild_id=$3 WHERE r.ballot_id=$1 AND u.telegram_id=$2 AND m.status=\'active\' FOR SHARE OF m',[ballot.id,actor.telegramId,ballot.guild_id])).rows[0];invariant(roster,'ineligible','Only active linked members in this ballot’s frozen roster may vote; research remains open to active members');
 const rows=await choices(tx,ballot.id),choice=rows.find(c=>c.id===button.choice_id);invariant(validChoices(ballot,rows)&&choice&&choice.proposal_version_id===button.proposal_version_id,'invalid_ballot','This ballot’s locked versions cannot be verified; Keep holding is the safe fallback');
 const previous=(await tx.query<{choice_id:string;revision:number;saved_at:Date}>('SELECT choice_id,revision,saved_at FROM votes WHERE ballot_id=$1 AND user_id=$2',[ballot.id,roster.id])).rows[0];
 time=await ballotClock(tx,ballot.id,clock);invariant(time.timely,'ballot_closed','This ballot has closed; the previous saved choice is unchanged');
 if(previous?.choice_id===choice.id)return {status:'saved',message:`Already saved: ${choice.label}. Check your private receipt.`,ballotId:ballot.id,choiceId:choice.id,revision:previous.revision,savedAt:previous.saved_at.toISOString(),proposalVersionId:choice.proposal_version_id,mode:round.mode};
 const revision=(previous?.revision??0)+1;await tx.query('INSERT INTO votes(ballot_id,user_id,choice_id,revision,saved_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT(ballot_id,user_id) DO UPDATE SET choice_id=EXCLUDED.choice_id,revision=EXCLUDED.revision,saved_at=EXCLUDED.saved_at',[ballot.id,roster.id,choice.id,revision,time.savedAt]);
 await tx.query('INSERT INTO vote_events(ballot_id,user_id,choice_id,revision,saved_at) VALUES($1,$2,$3,$4,$5)',[ballot.id,roster.id,choice.id,revision,time.savedAt]);
 await queueBallotNotificationInTx(tx,ballot.id);await queueVoteReceiptInTx(tx,ballot.id,roster.id,revision);
 return {status:'saved',message:`Saved: ${choice.label} · round ${round.number} · ${time.savedAt}. A vote is not a trade.`,ballotId:ballot.id,choiceId:choice.id,revision,savedAt:time.savedAt,proposalVersionId:choice.proposal_version_id,mode:round.mode};
}
export async function castVote(db:Pool,token:string,actor:CallbackActor,botId:string,clock?:Clock):Promise<CallbackReceipt>{return transaction(db,tx=>castVoteInTx(tx,token,actor,botId,clock));}
export async function closeBallot(db:Pool,id:string,clock?:Clock):Promise<BallotRecord>{return transaction(db,async tx=>{
 const {ballot,round,binding}=await lockBallot(tx,id);if(['closed','cancelled','superseded'].includes(ballot.state))return ballot;const time=await ballotClock(tx,id,clock);if(!time.hasClosed)return ballot;
 const rows=await choices(tx,id),hold=rows.find(c=>!c.proposal_version_id);
 const counts=(await tx.query<{choiceId:string;votes:number}>('SELECT c.id AS "choiceId",count(v.user_id)::int AS votes FROM ballot_choices c LEFT JOIN votes v ON v.choice_id=c.id AND v.ballot_id=c.ballot_id WHERE c.ballot_id=$1 GROUP BY c.id ORDER BY c.id',[id])).rows,n=(await tx.query<{n:number}>('SELECT count(*)::int n FROM ballot_roster WHERE ballot_id=$1',[id])).rows[0].n;
 let decision:Omit<BallotDecision,'choiceId'>&{choiceId:string|null}=hold?ballotDecision(n,counts,hold.id,ballot.kind==='midweek'&&ballot.rules.midweekHoldOnly===true):{choiceId:null,reason:'invalid',valid:false,quorum:Math.floor(n/2)+1,total:counts.reduce((sum,c)=>sum+c.votes,0)},detail:string|undefined;
 const house=(await tx.query('SELECT h.ballot_id FROM house_decisions h JOIN ballots b ON b.id=h.ballot_id WHERE h.ballot_id=$1 AND h.precommitted_at<b.opens_at',[id])).rows[0];
 if(!validChoices(ballot,rows)||!binding?.active||binding.bot_id!==ballot.rules.botId||!house){decision={...decision,choiceId:hold?.id??null,reason:'invalid',valid:false};detail='Locked versions, group binding or earlier House precommit unavailable';}
 const outcome:BallotOutcome={...decision,strategy:!decision.valid||decision.choiceId===hold?.id?'hold':'call',counts,closedAt:time.savedAt,...(detail?{detail}:{})};
 await tx.query("UPDATE ballots SET state='closed',outcome=$2::jsonb WHERE id=$1",[id,JSON.stringify(outcome)]);await tx.query("INSERT INTO operations(id,kind,state,record) VALUES($1,'close_ballot','complete',$2::jsonb)",['close:'+id,JSON.stringify({ballotId:id,outcome})]);
 if(round.state==='voting'&&ballot.kind==='opening')await changeRoundInTx(tx,round,decision.valid?'execution_window':'unranked',`ballot-close:${id}`,decision.valid?'Canonical ballot closed; individual authorization remains separate':'Invalid ballot: Keep holding; no ranked entry inferred',time.instant);
 await queueBallotNotificationInTx(tx,id);await queueBallotNotificationInTx(tx,id,'result');if(ballot.kind==='opening'&&round.mode==='simulation')await enqueue(tx,{task:'book_simulation',operationId:`virtual-book:${round.id}`,payload:{roundId:round.id}});
 if(ballot.kind==='opening'&&outcome.valid)await prepareMidweekHoldInTx(tx,{...ballot,state:'closed',outcome},round);
 return {...ballot,state:'closed',outcome};
 });}
export async function ballotView(db:Pool,userId:string,id:string){const initial=(await db.query<BallotRecord>('SELECT * FROM ballots WHERE id=$1',[id])).rows[0];invariant(initial,'ballot_unavailable','Ballot unavailable');return inGuild(db,userId,initial.guild_id,async tx=>{
 const ballot=(await tx.query<BallotRecord>('SELECT * FROM ballots WHERE id=$1',[id])).rows[0],time=await ballotClock(tx,id),participation=(await tx.query<{n:number}>('SELECT count(*)::int n FROM votes WHERE ballot_id=$1',[id])).rows[0].n;
 const ownReceipt=(await tx.query<{choiceId:string;label:string;revision:number;savedAt:Date;proposalVersionId:string|null;proposalId:string|null}>('SELECT v.choice_id AS "choiceId",c.label,v.revision,v.saved_at AS "savedAt",c.proposal_version_id AS "proposalVersionId",p.proposal_id AS "proposalId" FROM votes v JOIN ballot_choices c ON c.id=v.choice_id LEFT JOIN proposal_versions p ON p.id=c.proposal_version_id WHERE v.ballot_id=$1 AND v.user_id=$2',[id,userId])).rows[0]??null;
 const rosterCount=(await tx.query<{n:number}>('SELECT count(*)::int n FROM ballot_roster WHERE ballot_id=$1',[id])).rows[0].n;
 const context=(await tx.query<{guildName:string;roundNumber:number;mode:'simulation'|'live';stage:string}>('SELECT g.name AS "guildName",r.number AS "roundNumber",r.mode,r.state AS stage FROM rounds r JOIN guilds g ON g.id=r.guild_id WHERE r.id=$1',[ballot.round_id])).rows[0],eligible=(await tx.query('SELECT user_id FROM ballot_roster WHERE ballot_id=$1 AND user_id=$2',[id,userId])).rowCount===1;
 const originalProposal=ballot.kind==='midweek'&&ballot.rules.originalProposalVersionId?(await tx.query<{id:string;proposalId:string;version:number}>('SELECT id,proposal_id AS "proposalId",version FROM proposal_versions WHERE id=$1 AND guild_id=$2 AND round_id=$3',[ballot.rules.originalProposalVersionId,ballot.guild_id,ballot.round_id])).rows[0]??null:null;
 return {id,originalProposal,kind:ballot.kind,guildId:ballot.guild_id,roundId:ballot.round_id,...context,eligible,windowClosed:time.hasClosed,checkedAt:time.savedAt,state:ballot.state,opensAt:ballot.opens_at,closesAt:ballot.closes_at,participation,eligibleCount:rosterCount,quorum:Math.floor(rosterCount/2)+1,ownReceipt,counts:time.hasClosed&&ballot.state==='closed'?ballot.outcome?.counts??null:null,outcome:time.hasClosed&&ballot.state==='closed'?ballot.outcome:null,cancelReason:ballot.cancel_reason,supersededBy:ballot.superseded_by};
 });}
export async function cancelBallot(db:Pool,userId:string,id:string,reason:string):Promise<void>{invariant(reason.trim().length>=5&&reason.length<=1000,'reason_required','Cancellation requires a visible reason');const first=(await db.query<BallotRecord>('SELECT * FROM ballots WHERE id=$1',[id])).rows[0];invariant(first,'ballot_unavailable','Ballot unavailable');await inGuild(db,userId,first.guild_id,async(tx,scope)=>{
 invariant(['captain','administrator'].includes(scope.membership.role),'forbidden','A captain or administrator coordinates ballot cancellation');const {ballot,round}=await lockBallot(tx,id),time=await ballotClock(tx,id);invariant(['prepared','voting'].includes(ballot.state)&&!time.hasClosed,'ballot_closed','A closed ballot cannot be rewritten');await tx.query("UPDATE ballots SET state='cancelled',cancel_reason=$2 WHERE id=$1",[id,reason]);await audit(tx,{actorId:userId,guildId:ballot.guild_id,kind:'ballot_cancelled',recordId:id,reason});await queueBallotNotificationInTx(tx,id);if(round.state==='voting')await changeRoundInTx(tx,round,'unranked',`ballot-cancel:${id}`,'Ballot cancelled: '+reason,time.instant);
 });}

async function activateInTx(tx:Tx,ballot:BallotRecord,round:RoundRecord,clock?:Clock):Promise<RoundRecord>{
 invariant((await tx.query('SELECT h.ballot_id FROM house_decisions h JOIN ballots b ON b.id=h.ballot_id WHERE h.ballot_id=$1 AND h.precommitted_at<b.opens_at',[ballot.id])).rowCount===1,'house_unavailable','A verified earlier paper House precommit is required; no retrospective choice is allowed');
 const advanced=await advanceRoundInTx(tx,round.id,clock);invariant(advanced.state===(ballot.kind==='midweek'?'midweek':'voting'),'round_unavailable','The round cannot open this ballot');
 if(ballot.kind==='midweek'){
  const roster=await membersAtOpening(tx,round.guild_id,ballot.opens_at);
  invariant(roster!==null,'roster_unavailable','This opening predates recorded membership coverage; no retrospective denominator');
  await tx.query('INSERT INTO ballot_roster(ballot_id,user_id) SELECT $1,unnest($2::uuid[]) ON CONFLICT DO NOTHING',[ballot.id,roster]);
 }else await tx.query('INSERT INTO ballot_roster(ballot_id,user_id) SELECT $1,user_id FROM round_roster WHERE round_id=$2 ON CONFLICT DO NOTHING',[ballot.id,round.id]);
 const accepted=await ballotClock(tx,ballot.id,clock);invariant(accepted.timely,'ballot_closed','The ballot closed while its opening eligibility was being verified');
 await tx.query("UPDATE ballots SET state='voting' WHERE id=$1 AND state='prepared'",[ballot.id]);ballot.state='voting';return advanced;
}
export async function prepareBallot(db:Pool,userId:string,guildId:string,roundId:string,versionIds:string[],requestId:string):Promise<BallotRecord>{
 invariant(versionIds.length>=1&&versionIds.length<=2,'invalid_candidates','Select one or two exact shared proposals; Keep holding is always added');z.array(z.uuid()).max(2).parse(versionIds);z.uuid().parse(requestId);invariant(new Set(versionIds).size===versionIds.length,'invalid_candidates','Each candidate version may appear only once');
 return inGuild(db,userId,guildId,async(tx,scope)=>{
  invariant(['captain','administrator'].includes(scope.membership.role),'forbidden','A captain or administrator nominates the final candidates');
  const binding=(await tx.query('SELECT * FROM group_bindings WHERE guild_id=$1 FOR SHARE',[guildId])).rows[0];invariant(binding?.active&&binding.bot_id,'group_unavailable','Verify the current guild group and bot first');
  const round=(await tx.query<RoundRecord>('SELECT * FROM rounds WHERE id=$1 AND guild_id=$2 FOR UPDATE',[roundId,guildId])).rows[0];invariant(round,'round_unavailable','Round unavailable');
  const operationId=`ballot-prepare:${roundId}:${requestId}`,prior=(await tx.query<{record:{ballotId:string;versions:string[]}}>('SELECT record FROM operations WHERE id=$1',[operationId])).rows[0];
  if(prior){invariant(canonicalJson(prior.record.versions)===canonicalJson(versionIds),'operation_conflict','This request refers to different candidates');return (await tx.query<BallotRecord>('SELECT * FROM ballots WHERE id=$1',[prior.record.ballotId])).rows[0];}
  const now=await serverTime(tx);invariant(round.state==='research'&&round.schedule.candidateLock&&now.getTime()<Date.parse(round.schedule.candidateLock),'candidate_locked','Final candidates must be selected before the published lock');
  invariant(Date.parse(round.schedule.voteClose)-Date.parse(round.schedule.voteOpen)===43200000,'ballot_window','The published opening ballot must last twelve hours');
  const active=(await tx.query("SELECT id FROM ballots WHERE round_id=$1 AND kind='opening' AND state IN ('prepared','voting')",[roundId])).rows[0];invariant(!active,'ballot_exists','Cancel or supersede the existing canonical ballot before replacing it');
  const candidates=[];for(const id of versionIds){const row=(await tx.query<{id:string;content_hash:string;content:unknown;version:number;proposal_id:string}>('SELECT id,content_hash,content,version,proposal_id FROM proposal_versions WHERE id=$1 AND guild_id=$2 AND round_id=$3',[id,guildId,roundId])).rows[0];invariant(row&&createHash('sha256').update(canonicalJson(row.content)).digest('hex')===row.content_hash,'invalid_candidates','Choose exact shared versions from this round');const latest=(await tx.query('SELECT id FROM proposal_versions WHERE proposal_id=$1 ORDER BY version DESC LIMIT 1',[row.proposal_id])).rows[0];invariant(latest.id===row.id,'invalid_candidates','A selected version is superseded; review its current terms');await validateFrozenSeasonTerms(tx,row.content as PlanContext,round);candidates.push(row);}
  const ballot=(await tx.query<BallotRecord>("INSERT INTO ballots(guild_id,round_id,state,kind,opens_at,closes_at,rules) VALUES($1,$2,'prepared','opening',$3,$4,'{}') RETURNING *",[guildId,roundId,round.schedule.voteOpen,round.schedule.voteClose])).rows[0];
  for(const [i,candidate] of candidates.entries())await tx.query('INSERT INTO ballot_choices(ballot_id,guild_id,round_id,proposal_version_id,label) VALUES($1,$2,$3,$4,$5)',[ballot.id,guildId,roundId,candidate.id,`Call ${i+1} · proposal v${candidate.version}`]);
  const hold=(await tx.query<{id:string}>("INSERT INTO ballot_choices(ballot_id,guild_id,round_id,label) VALUES($1,$2,$3,'Keep holding SOL') RETURNING id",[ballot.id,guildId,roundId])).rows[0];
  const houseInput=await configuredHouseInput(tx,roundId,now.toISOString());
  const rules:BallotRules={botId:binding.bot_id,dataCutoff:houseInput.cutoff,candidateVersions:candidates.map(c=>({id:c.id,hash:c.content_hash})),holdChoiceId:hold.id};
  await tx.query('UPDATE ballots SET rules=$2::jsonb WHERE id=$1',[ballot.id,JSON.stringify(rules)]);await lockHouseInTx(tx,ballot.id,houseInput);
  for(const choice of await choices(tx,ballot.id))await tx.query('INSERT INTO callback_tokens(token,ballot_id,choice_id,chat_id,proposal_version_id) VALUES($1,$2,$3,$4,$5)',[opaqueToken(),ballot.id,choice.id,binding.chat_id,choice.proposal_version_id]);
  await tx.query("INSERT INTO operations(id,kind,state,record) VALUES($1,'prepare_ballot','complete',$2::jsonb)",[operationId,JSON.stringify({ballotId:ballot.id,versions:versionIds})]);
  await enqueue(tx,{task:'close_ballot',operationId:`close:${ballot.id}`,payload:{ballotId:ballot.id},runAt:round.schedule.voteClose});
  await queueBallotNotificationInTx(tx,ballot.id);await audit(tx,{actorId:userId,guildId,kind:'ballot_prepared',recordId:ballot.id,reason:'Exact candidate versions and original twelve-hour timetable locked; roster freezes at opening'});return {...ballot,rules};
 });
}
export async function activatePreparedBallot(db:Pool,id:string):Promise<void>{await transaction(db,async tx=>{const {ballot,round,binding}=await lockBallot(tx,id),time=await ballotClock(tx,id);if(ballot.state!=='prepared'||!time.timely||!binding?.active||binding.bot_id!==ballot.rules.botId)return;await activateInTx(tx,ballot,round);await queueBallotNotificationInTx(tx,id);});}
export async function supersedeBallot(db:Pool,userId:string,id:string,reason:string):Promise<BallotRecord>{
 invariant(reason.trim().length>=5&&reason.length<=1000,'reason_required','A visible replacement reason is required');const first=(await db.query<BallotRecord>('SELECT * FROM ballots WHERE id=$1',[id])).rows[0];invariant(first,'ballot_unavailable','Ballot unavailable');
 return inGuild(db,userId,first.guild_id,async(tx,scope)=>{
  invariant(['captain','administrator'].includes(scope.membership.role),'forbidden','A captain or administrator coordinates a replacement');const {ballot,binding}=await lockBallot(tx,id),time=await ballotClock(tx,id);
  if(ballot.state==='superseded'&&ballot.superseded_by){invariant(ballot.cancel_reason===reason,'operation_conflict','This ballot was replaced with a different recorded reason');return (await tx.query<BallotRecord>('SELECT * FROM ballots WHERE id=$1',[ballot.superseded_by])).rows[0];}
  invariant(['prepared','voting'].includes(ballot.state)&&!time.hasClosed,'ballot_closed','A closed ballot cannot be rewritten');invariant(binding?.active&&binding.bot_id,'group_unavailable','Verify the current group and bot first');
  const oldChoices=await choices(tx,id);invariant(validChoices(ballot,oldChoices),'invalid_ballot','The old versions cannot be verified; cancel with a reason instead');
  const replacementId=randomUUID();await tx.query("UPDATE ballots SET state='superseded',cancel_reason=$2,superseded_by=$3 WHERE id=$1",[id,reason,replacementId]);
  const replacement=(await tx.query<BallotRecord>("INSERT INTO ballots(id,guild_id,round_id,state,kind,opens_at,closes_at,rules) SELECT $2,guild_id,round_id,'prepared',kind,opens_at,closes_at,'{}' FROM ballots WHERE id=$1 RETURNING *",[id,replacementId])).rows[0];
  let holdId:string|null=null;for(const old of oldChoices){const choice=(await tx.query<{id:string}>('INSERT INTO ballot_choices(ballot_id,guild_id,round_id,proposal_version_id,label) VALUES($1,$2,$3,$4,$5) RETURNING id',[replacement.id,ballot.guild_id,ballot.round_id,old.proposal_version_id,old.label])).rows[0];if(!old.proposal_version_id)holdId=choice.id;await tx.query('INSERT INTO callback_tokens(token,ballot_id,choice_id,chat_id,proposal_version_id) VALUES($1,$2,$3,$4,$5)',[opaqueToken(),replacement.id,choice.id,binding.chat_id,old.proposal_version_id]);}
  const rules={...ballot.rules,botId:binding.bot_id,holdChoiceId:holdId!};await tx.query('UPDATE ballots SET rules=$2::jsonb WHERE id=$1',[replacement.id,JSON.stringify(rules)]);
  await inheritHouseInTx(tx,id,replacement.id);await tx.query('INSERT INTO ballot_roster(ballot_id,user_id) SELECT $1,user_id FROM ballot_roster WHERE ballot_id=$2',[replacement.id,id]);if(ballot.state==='voting'){await tx.query("UPDATE ballots SET state='voting' WHERE id=$1",[replacement.id]);replacement.state='voting';}
  await enqueue(tx,{task:'close_ballot',operationId:`close:${replacement.id}`,payload:{ballotId:replacement.id},runAt:ballot.closes_at.toISOString()});
  await queueBallotNotificationInTx(tx,id);await queueBallotNotificationInTx(tx,replacement.id);await audit(tx,{actorId:userId,guildId:ballot.guild_id,kind:'ballot_superseded',recordId:id,reason,record:{newBallotId:replacement.id,unchangedDeadline:ballot.closes_at.toISOString(),lockedVersionsUnchanged:true,votesNotTransferred:true}});return {...replacement,rules};
 });
}
export async function recoverMissingBallotForRound(db:Pool,roundId:string,clock?:Clock):Promise<boolean>{return transaction(db,async tx=>{
 const round=(await tx.query<RoundRecord>('SELECT * FROM rounds WHERE id=$1 FOR UPDATE',[roundId])).rows[0];if(!round||!['research','candidate_lock','voting'].includes(round.state)||!round.schedule.voteClose)return false;
 const now=await serverTime(tx,clock),exists=(await tx.query('SELECT id FROM ballots WHERE round_id=$1 AND kind=\'opening\' LIMIT 1',[roundId])).rowCount;
 if(exists||now.getTime()<Date.parse(round.schedule.voteClose))return false;
 await changeRoundInTx(tx,round,'unranked',`missing-opening:${roundId}`,'No opening ballot was prepared by the deadline: Keep holding; no ranked entry or vote tally inferred',now);
 await audit(tx,{guildId:round.guild_id,kind:'round_fallback_recorded',recordId:roundId,reason:'Missing opening ballot: explicit unranked holding fallback',record:{strategy:'hold',dataQuality:'unranked',notVoteOutcome:true}});return true;
 });}
export async function ballotCandidates(db:Pool,userId:string,guildId:string,roundId:string){return inGuild(db,userId,guildId,async(tx,scope)=>{
 const round=(await tx.query<RoundRecord>('SELECT * FROM rounds WHERE id=$1 AND guild_id=$2',[roundId,guildId])).rows[0];invariant(round,'round_unavailable','Round unavailable');
 const versions=(await tx.query<{id:string;proposalId:string;version:number;strike:string|null;denomination:string|null}>('SELECT DISTINCT ON (v.proposal_id) v.id,v.proposal_id AS "proposalId",v.version,v.content#>>\'{terms,strike,amount}\' AS strike,v.content#>>\'{terms,strike,denomination}\' AS denomination FROM proposal_versions v WHERE v.guild_id=$1 AND v.round_id=$2 ORDER BY v.proposal_id,v.version DESC LIMIT 50',[guildId,roundId])).rows;
 const ballot=(await tx.query<{id:string}>('SELECT id FROM ballots WHERE round_id=$1 ORDER BY CASE WHEN kind=\'midweek\' AND opens_at>clock_timestamp() THEN 1 ELSE 0 END,created_at DESC,id DESC LIMIT 1',[roundId])).rows[0];const delivery=ballot?(await tx.query("SELECT state FROM ballot_deliveries WHERE ballot_id=$1 AND kind='ballot' ORDER BY created_at DESC,operation_id DESC LIMIT 1",[ballot.id])).rows[0]:null;
 return {canCoordinate:['captain','administrator'].includes(scope.membership.role),canPrepare:round.state==='research'&&Date.now()<Date.parse(round.schedule.candidateLock),versions,ballotId:ballot?.id??null,deliveryState:delivery?.state??null};
});}
