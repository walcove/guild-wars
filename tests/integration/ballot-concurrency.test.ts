import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,expect,it} from 'vitest';
import type {Pool} from 'pg';
import {testPool} from './helpers/database';
import {syntheticProposal} from './helpers/proposals';
import {syntheticGuild} from './helpers/fixtures';
import {snapshotProposal} from '../../src/server/services/proposals';
import {opaqueToken} from '../../src/server/auth/crypto';
import {castVote,castVoteInTx,closeBallot,ballotView,cancelBallot} from '../../src/server/services/ballots';
let db:Pool;beforeAll(()=>{db=testPool();});afterAll(async()=>{await db.end();});
async function ballot(milliseconds=60000,missingHold=false){
 const f=await syntheticProposal(db),v=await snapshotProposal(db,f.userId,f.proposal.id,1,f.proposal.reviewHash),at=(await db.query<{t:Date}>('SELECT clock_timestamp() t')).rows[0].t,close=new Date(at.getTime()+milliseconds),open=new Date(close.getTime()-43200000),id=randomUUID(),call=randomUUID(),hold=randomUUID(),callToken=opaqueToken(),holdToken=opaqueToken();
 await db.query("UPDATE rounds SET state='voting' WHERE id=$1",[f.roundId]);await db.query('INSERT INTO round_roster(round_id,user_id) VALUES($1,$2)',[f.roundId,f.userId]);
 await db.query("INSERT INTO ballots(id,guild_id,round_id,state,kind,opens_at,closes_at,rules) VALUES($1,$2,$3,'prepared','opening',$4,$5,'{}')",[id,f.guildId,f.roundId,open,close]);
 await db.query('INSERT INTO ballot_roster(ballot_id,user_id) VALUES($1,$2)',[id,f.userId]);
 await db.query("INSERT INTO ballot_choices(id,ballot_id,guild_id,round_id,proposal_version_id,label) VALUES($1,$2,$3,$4,$5,'Call A')",[call,id,f.guildId,f.roundId,v.id]);
 if(!missingHold)await db.query("INSERT INTO ballot_choices(id,ballot_id,guild_id,round_id,label) VALUES($1,$2,$3,$4,'Keep holding SOL')",[hold,id,f.guildId,f.roundId]);
 await db.query('INSERT INTO callback_tokens(token,ballot_id,choice_id,chat_id,proposal_version_id) VALUES($1,$2,$3,$4,$5)',[callToken,id,call,f.chatId,v.id]);
 if(!missingHold)await db.query('INSERT INTO callback_tokens(token,ballot_id,choice_id,chat_id) VALUES($1,$2,$3,$4)',[holdToken,id,hold,f.chatId]);
 await db.query("UPDATE ballots SET rules=$2::jsonb,state='voting' WHERE id=$1",[id,JSON.stringify({botId:'9001',candidateVersions:[{id:v.id,hash:v.contentHash}],holdChoiceId:hold})]);
 return {...f,id,call,hold,callToken,holdToken,close,actor:{telegramId:f.telegramId,chatId:f.chatId,chatType:'supergroup',messageId:'500'}};
}
it('serializes concurrent changes, hides choice totals and preserves departed votes while blocking new changes',async()=>{
 const f=await ballot(),outsider=await syntheticGuild(db);
 await expect(castVote(db,f.callToken,{...f.actor,telegramId:outsider.telegramId},'9001')).rejects.toMatchObject({code:'ineligible'});
 const late=await syntheticGuild(db);await db.query("INSERT INTO memberships(guild_id,user_id,role,status) VALUES($1,$2,'member','active')",[f.guildId,late.userId]);
 await expect(castVote(db,f.callToken,{...f.actor,telegramId:late.telegramId},'9001')).rejects.toMatchObject({code:'ineligible'});
 await expect(castVote(db,f.callToken,{...f.actor,chatId:'-123'},'9001')).rejects.toMatchObject({code:'callback_context'});
 await Promise.all(Array.from({length:10},(_,i)=>castVote(db,i%2?f.callToken:f.holdToken,f.actor,'9001')));
 const before=await ballotView(db,f.userId,f.id);expect(before.participation).toBe(1);expect(before.counts).toBeNull();expect(before.ownReceipt?.revision).toBeGreaterThan(0);
 await db.query("UPDATE memberships SET status='departed' WHERE guild_id=$1 AND user_id=$2",[f.guildId,f.userId]);await expect(castVote(db,f.callToken,f.actor,'9001')).rejects.toMatchObject({code:'ineligible'});
 const result=await closeBallot(db,f.id,{now:()=>f.close});expect(result.state).toBe('closed');expect(result.outcome?.total).toBe(1);expect((await db.query('SELECT count(*)::int n FROM votes WHERE ballot_id=$1',[f.id])).rows[0].n).toBe(1);
 expect((await db.query('SELECT count(*)::int n FROM vote_events WHERE ballot_id=$1',[f.id])).rows[0].n).toBe(before.ownReceipt?.revision);
});
it('accepts just before, rejects exactly at/after the deadline and closes once despite a delayed worker',async()=>{
 const f=await ballot();await castVote(db,f.callToken,f.actor,'9001',{now:()=>new Date(f.close.getTime()-1)});
 for(const delta of [0,1])await expect(castVote(db,f.holdToken,f.actor,'9001',{now:()=>new Date(f.close.getTime()+delta)})).rejects.toMatchObject({code:'ballot_closed'});
 const results=await Promise.all([closeBallot(db,f.id,{now:()=>f.close}),closeBallot(db,f.id,{now:()=>f.close})]);expect(results[0].outcome).toEqual(results[1].outcome);
 expect((await db.query("SELECT count(*)::int n FROM operations WHERE id=$1",['close:'+f.id])).rows[0].n).toBe(1);
});
it('rejects a transaction begun before closing when it acquires the ballot lock after closing',async()=>{
 const f=await ballot(1400),blocker=await db.connect(),voter=await db.connect(),application='ballot-race-'+randomUUID();
 try{
  await blocker.query('BEGIN');await blocker.query('SELECT id FROM ballots WHERE id=$1 FOR UPDATE',[f.id]);await voter.query('BEGIN');await voter.query("SELECT set_config('application_name',$1,true)",[application]);
  const pending=castVoteInTx(voter,f.callToken,f.actor,'9001').then(value=>({value,error:null}),error=>({value:null,error}));
  let blocked=false;for(let i=0;i<60;i++){const s=(await db.query("SELECT cardinality(pg_blocking_pids(pid))>0 AS blocked FROM pg_stat_activity WHERE application_name=$1",[application])).rows[0];if(s?.blocked){blocked=true;break;}await new Promise(r=>setTimeout(r,10));}expect(blocked).toBe(true);
  await blocker.query('SELECT pg_sleep(1.6)');await blocker.query('COMMIT');const result=await pending;expect(result.error).toMatchObject({code:'ballot_closed'});await voter.query('ROLLBACK');
  expect((await db.query('SELECT * FROM votes WHERE ballot_id=$1',[f.id])).rowCount).toBe(0);
 }finally{await blocker.query('ROLLBACK');await voter.query('ROLLBACK');blocker.release();voter.release();}
});
it('cancels with a visible reason and old tokens cannot create a new ballot or vote',async()=>{
 const f=await ballot();await cancelBallot(db,f.userId,f.id,'Synthetic cancellation reason');await expect(castVote(db,f.callToken,f.actor,'9001')).rejects.toMatchObject({code:'ballot_closed'});expect((await ballotView(db,f.userId,f.id)).state).toBe('cancelled');expect((await db.query('SELECT id FROM ballots WHERE round_id=$1',[f.roundId])).rowCount).toBe(1);
});
it('prepares exact versions before candidate lock, freezes the opening roster and rejects same-round outsiders',async()=>{
 const {prepareBallot}=await import('../../src/server/services/ballots'),{saveDraft}=await import('../../src/server/services/proposals'),{syntheticDraft,syntheticPlanCatalog}=await import('./helpers/proposals');
 const f=await syntheticProposal(db),at=(await db.query<{t:Date}>('SELECT clock_timestamp() t')).rows[0].t,iso=(hours:number)=>new Date(at.getTime()+hours*3600000).toISOString(),id=randomUUID();
 const schedule={researchOpen:iso(-24),candidateLock:iso(1),voteOpen:iso(1),voteClose:iso(13),executionClose:iso(14),midweekOpen:iso(48),midweekClose:iso(60),expiresAt:iso(120)};
 await db.query("INSERT INTO rounds(id,guild_id,season_id,mode,number,state,schedule,expires_at) VALUES($1,$2,$3,'simulation',2,'research',$4::jsonb,$5)",[id,f.guildId,f.seasonId,JSON.stringify(schedule),schedule.expiresAt]);
 const draft=await saveDraft(db,f.userId,f.guildId,id,{requestId:randomUUID(),draft:syntheticDraft},syntheticPlanCatalog(db)),v=await snapshotProposal(db,f.userId,draft.id,1,draft.reviewHash);
 await expect(prepareBallot(db,f.userId,f.guildId,id,[f.versionId],randomUUID())).rejects.toMatchObject({code:'invalid_candidates'});
 const prepared=await prepareBallot(db,f.userId,f.guildId,id,[v.id],randomUUID());expect(prepared.state).toBe('prepared');
 const token=(await db.query('SELECT token FROM callback_tokens WHERE ballot_id=$1 LIMIT 1',[prepared.id])).rows[0].token;
 await expect(castVote(db,token,{telegramId:f.telegramId,chatId:f.chatId,chatType:'supergroup',messageId:'501'},'9001')).rejects.toMatchObject({code:'ballot_not_open'});
 await castVote(db,token,{telegramId:f.telegramId,chatId:f.chatId,chatType:'supergroup',messageId:'501'},'9001',{now:()=>new Date(schedule.voteOpen)});
 expect((await ballotView(db,f.userId,prepared.id)).eligibleCount).toBe(1);
});

it('records a corrupt missing-Hold ballot as unranked holding without inventing a winning choice',async()=>{
 const f=await ballot(60000,true),result=await closeBallot(db,f.id,{now:()=>f.close});expect(result.outcome).toMatchObject({valid:false,strategy:'hold',choiceId:null,reason:'invalid'});expect((await db.query('SELECT state FROM rounds WHERE id=$1',[f.roundId])).rows[0].state).toBe('unranked');
});
it('supersedes with the same locked versions, roster and deadline; members must recast on the new identifier',async()=>{
 const {supersedeBallot}=await import('../../src/server/services/ballots'),f=await ballot();await castVote(db,f.callToken,f.actor,'9001');
 const replacement=await supersedeBallot(db,f.userId,f.id,'Synthetic replacement reason');expect(replacement.closes_at).toEqual(f.close);expect(replacement.id).not.toBe(f.id);
 await expect(castVote(db,f.callToken,f.actor,'9001')).rejects.toMatchObject({code:'ballot_closed'});expect((await ballotView(db,f.userId,replacement.id)).participation).toBe(0);
 expect((await db.query('SELECT user_id FROM ballot_roster WHERE ballot_id=$1',[replacement.id])).rowCount).toBe(1);expect((await supersedeBallot(db,f.userId,f.id,'Synthetic replacement reason')).id).toBe(replacement.id);
});
it('deduplicates committed webhook votes even if callback feedback fails, and never confirms a timed-out database write',async()=>{
 const {processUpdate}=await import('../../src/server/telegram/webhook'),f=await ballot(),config={botId:'9001',secret:'s'.repeat(40),username:'synthetic_bot',origin:'http://127.0.0.1:3000'},id=Date.now(),transport={send:async()=>{throw Error('Never send');},answer:async()=>{throw Error('Synthetic feedback failure');}};
 const update=(n:number,token:string)=>({update_id:n,callback_query:{id:'synthetic-'+n,from:{id:Number(f.telegramId)},message:{message_id:500,chat:{id:Number(f.chatId),type:'supergroup'}},data:'b:'+token}}),services={castBallot:(tx:import('../../src/server/db/client').Tx,t:string,a:import('../../src/server/telegram/callbacks').CallbackActor)=>castVoteInTx(tx,t,a,config.botId)};
 const receipt=await processUpdate(db,config.secret,update(id,f.callToken),config,transport,services);expect(receipt.status).toBe('saved');expect(await processUpdate(db,config.secret,update(id,f.callToken),config,transport,services)).toEqual(receipt);
 expect((await db.query('SELECT count(*)::int n FROM vote_events WHERE ballot_id=$1',[f.id])).rows[0].n).toBe(1);
 const blocker=await db.connect();try{await blocker.query('BEGIN');await blocker.query('SELECT id FROM ballots WHERE id=$1 FOR UPDATE',[f.id]);await expect(processUpdate(db,config.secret,update(id+1,f.holdToken),config,transport,services)).rejects.toMatchObject({code:'55P03'});expect((await db.query('SELECT * FROM consumed_updates WHERE bot_id=$1 AND update_id=$2',[config.botId,(id+1).toString()])).rowCount).toBe(0);}finally{await blocker.query('ROLLBACK');blocker.release();}
 expect((await ballotView(db,f.userId,f.id)).ownReceipt?.choiceId).toBe(f.call);
});
it('enforces frozen timetable, sealed choices/roster and immutable closure in PostgreSQL',async()=>{
 const f=await ballot(),other=await syntheticGuild(db);
 await expect(db.query("UPDATE ballots SET closes_at=closes_at+interval '1 second' WHERE id=$1",[f.id])).rejects.toThrow(/timetable is immutable/);
 await expect(db.query("INSERT INTO ballot_choices(ballot_id,guild_id,round_id,label) VALUES($1,$2,$3,'Unapproved choice')",[f.id,f.guildId,f.roundId])).rejects.toThrow(/choices are locked/);
 await expect(db.query('INSERT INTO ballot_roster(ballot_id,user_id) VALUES($1,$2)',[f.id,other.userId])).rejects.toThrow(/roster is locked/);
 await closeBallot(db,f.id,{now:()=>f.close});await expect(db.query("UPDATE ballots SET outcome='{}' WHERE id=$1",[f.id])).rejects.toThrow(/closed ballot is immutable/);
});
