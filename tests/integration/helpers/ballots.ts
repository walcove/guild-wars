import {randomUUID} from 'node:crypto';
import type {Pool} from 'pg';
import {syntheticProposal} from './proposals';
import {snapshotProposal} from '../../../src/server/services/proposals';
import {opaqueToken} from '../../../src/server/auth/crypto';
export async function syntheticBallot(db:Pool,milliseconds=60000,missingHold=false,extraMembers:{userId:string;telegramId:string}[]=[]){
 const f=await syntheticProposal(db),v=await snapshotProposal(db,f.userId,f.proposal.id,1,f.proposal.reviewHash),at=(await db.query<{t:Date}>('SELECT clock_timestamp() t')).rows[0].t,close=new Date(at.getTime()+milliseconds),open=new Date(close.getTime()-43200000),id=randomUUID(),call=randomUUID(),hold=randomUUID(),callToken=opaqueToken(),holdToken=opaqueToken();
 await db.query("UPDATE rounds SET state='voting' WHERE id=$1",[f.roundId]);await db.query('INSERT INTO round_roster(round_id,user_id) VALUES($1,$2)',[f.roundId,f.userId]);
 await db.query("INSERT INTO ballots(id,guild_id,round_id,state,kind,opens_at,closes_at,rules) VALUES($1,$2,$3,'prepared','opening',$4,$5,'{}')",[id,f.guildId,f.roundId,open,close]);
 for(const m of extraMembers){await db.query("INSERT INTO memberships(guild_id,user_id,role,status) VALUES($1,$2,'member','active')",[f.guildId,m.userId]);await db.query('INSERT INTO round_roster(round_id,user_id) VALUES($1,$2)',[f.roundId,m.userId]);}
 await db.query('INSERT INTO ballot_roster(ballot_id,user_id) VALUES($1,$2)',[id,f.userId]);
 for(const m of extraMembers)await db.query('INSERT INTO ballot_roster(ballot_id,user_id) VALUES($1,$2)',[id,m.userId]);
 await db.query("INSERT INTO ballot_choices(id,ballot_id,guild_id,round_id,proposal_version_id,label) VALUES($1,$2,$3,$4,$5,'Call A')",[call,id,f.guildId,f.roundId,v.id]);
 if(!missingHold)await db.query("INSERT INTO ballot_choices(id,ballot_id,guild_id,round_id,label) VALUES($1,$2,$3,$4,'Keep holding SOL')",[hold,id,f.guildId,f.roundId]);
 await db.query('INSERT INTO callback_tokens(token,ballot_id,choice_id,chat_id,proposal_version_id) VALUES($1,$2,$3,$4,$5)',[callToken,id,call,f.chatId,v.id]);
 if(!missingHold)await db.query('INSERT INTO callback_tokens(token,ballot_id,choice_id,chat_id) VALUES($1,$2,$3,$4)',[holdToken,id,hold,f.chatId]);
 await db.query("UPDATE ballots SET rules=$2::jsonb,state='voting' WHERE id=$1",[id,JSON.stringify({botId:'9001',candidateVersions:[{id:v.id,hash:v.contentHash}],holdChoiceId:hold})]);
 // Restored synthetic prior-state fixture, not a claim of native or provider evidence.
 await db.query("INSERT INTO house_decisions(ballot_id,policy_version,cutoff_at,precommitted_at,input_hash,input,decision) VALUES($1,'highest-strike-v1',$2,$2,'synthetic','{\"syntheticPriorState\":true}','{\"kind\":\"hold\",\"reason\":\"Synthetic prior state\",\"policyVersion\":\"highest-strike-v1\"}')",[id,new Date(open.getTime()-1000)]);
 return {...f,id,call,hold,callToken,holdToken,close,actor:{telegramId:f.telegramId,chatId:f.chatId,chatType:'supergroup',messageId:'500'}};
}
