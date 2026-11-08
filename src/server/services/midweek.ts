import type {Pool} from 'pg';
import {transaction,type Tx} from '../db/client';
import {invariant} from '../../domain/errors';
import {opaqueToken} from '../auth/crypto';
import {enqueue} from '../jobs/queue';
import {queueBallotNotificationInTx} from './ballot-notifications';
import type {BallotRecord} from './ballots';
import type {RoundRecord} from './rounds';
import {positionView} from './positions';
import {audit} from './audit';
export async function prepareMidweekHoldInTx(tx:Tx,opening:BallotRecord,round:RoundRecord):Promise<string|null>{
 const s=round.schedule;if(!s.midweekOpen||!s.midweekClose)return null;
 const prior=(await tx.query<{id:string}>("SELECT id FROM ballots WHERE round_id=$1 AND kind='midweek' AND state<>'superseded' ORDER BY created_at DESC LIMIT 1",[round.id])).rows[0];if(prior)return prior.id;
 const now=(await tx.query<{t:Date}>('SELECT clock_timestamp() t')).rows[0].t;if(now.getTime()>=Date.parse(s.midweekOpen))return null;
 invariant(opening.kind==='opening'&&opening.state==='closed'&&opening.outcome?.valid&&opening.round_id===round.id,'opening_unavailable','A canonical closed opening decision is required');
 invariant(Date.parse(s.midweekClose)-Date.parse(s.midweekOpen)===43200000,'ballot_window','The published midweek window must last twelve hours');
 const binding=(await tx.query('SELECT * FROM group_bindings WHERE guild_id=$1 FOR SHARE',[round.guild_id])).rows[0];if(!binding?.active||!binding.bot_id)return null;
 const house=(await tx.query('SELECT h.* FROM house_decisions h WHERE h.ballot_id=$1 AND h.precommitted_at<$2',[opening.id,opening.opens_at])).rows[0];if(!house)return null;
 const originalVersion=(await tx.query('SELECT proposal_version_id FROM ballot_choices WHERE ballot_id=$1 AND id=$2',[opening.id,opening.outcome.choiceId])).rows[0]?.proposal_version_id??null;
 const b=(await tx.query<{id:string}>("INSERT INTO ballots(guild_id,round_id,state,kind,opens_at,closes_at,rules) VALUES($1,$2,'prepared','midweek',$3,$4,'{}') RETURNING id",[round.guild_id,round.id,s.midweekOpen,s.midweekClose])).rows[0];
 const choice=(await tx.query<{id:string}>("INSERT INTO ballot_choices(ballot_id,guild_id,round_id,label) VALUES($1,$2,$3,'Keep the original plan; no trade change') RETURNING id",[b.id,round.guild_id,round.id])).rows[0];
 await tx.query('UPDATE ballots SET rules=$2::jsonb WHERE id=$1',[b.id,JSON.stringify({botId:binding.bot_id,candidateVersions:[],holdChoiceId:choice.id,dataCutoff:opening.rules.dataCutoff,midweekHoldOnly:true,parentOpeningBallotId:opening.id,originalProposalVersionId:originalVersion,managementCapabilities:'unavailable-or-locked'})]);
 // The original paper House stays unchanged. This is truthful inherited context, not a new selection.
 await tx.query('INSERT INTO house_decisions(ballot_id,policy_version,cutoff_at,precommitted_at,input_hash,input,decision,inherited_from_ballot) SELECT $2,policy_version,cutoff_at,precommitted_at,input_hash,input,decision,$1 FROM house_decisions WHERE ballot_id=$1',[opening.id,b.id]);
 await tx.query('INSERT INTO callback_tokens(token,ballot_id,choice_id,chat_id) VALUES($1,$2,$3,$4)',[opaqueToken(),b.id,choice.id,binding.chat_id]);
 await enqueue(tx,{task:'midweek_notice',operationId:`midweek:${b.id}`,payload:{ballotId:b.id},runAt:s.midweekOpen});await enqueue(tx,{task:'close_ballot',operationId:`close:${b.id}`,payload:{ballotId:b.id},runAt:s.midweekClose});
 await audit(tx,{guildId:round.guild_id,kind:'midweek_confirmation_prepared',recordId:b.id,reason:'Original plan confirmation only; no verified management trade capability, new order or House re-selection'});return b.id;
}
export async function requestPositionManagement(db:Pool,userId:string,positionId:string,action:string,requestId:string):Promise<void>{
 const view=await positionView(db,userId,positionId);invariant(action==='hold','unsupported_action',view.management.reason);invariant(/^[A-Za-z0-9:_-]{1,128}$/.test(requestId),'invalid_request','Invalid saved reassessment request');
 await transaction(db,async tx=>{const operationId=`position-hold:${positionId}:${requestId}`,prior=(await tx.query('SELECT id FROM operations WHERE id=$1',[operationId])).rows[0];if(prior)return;const saved=await tx.query("INSERT INTO operations(id,kind,state,record) VALUES($1,'position_reassessment','complete',$2::jsonb) ON CONFLICT DO NOTHING RETURNING id",[operationId,JSON.stringify({positionId,userId,action:'hold',noTradeChange:true})]);if(!saved.rowCount)return;await audit(tx,{actorId:userId,guildId:view.guildId,kind:'member_kept_position_plan',recordId:positionId,reason:'Member recorded no app-requested management change; no provider action or actual holding status is inferred'});});
}
export async function notifyMidweek(db:Pool,ballotId:string):Promise<void>{const {activatePreparedBallot}=await import('./ballots');await activatePreparedBallot(db,ballotId);await transaction(db,tx=>queueBallotNotificationInTx(tx,ballotId));}
