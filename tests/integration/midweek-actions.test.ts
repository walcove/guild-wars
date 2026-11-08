import {afterAll,beforeAll,expect,it} from 'vitest';
import type {Pool} from 'pg';
import {testPool} from './helpers/database';
import {syntheticBallot} from './helpers/ballots';
import {castVote,closeBallot,ballotView} from '../../src/server/services/ballots';
import {requestPositionManagement} from '../../src/server/services/midweek';
import {syntheticReviewedIntents} from './helpers/orders';
let db:Pool;beforeAll(()=>{db=testPool();});afterAll(async()=>{await db.end();});
it('uses a scheduled Hold-only confirmation, original House and strict quorum without making another order or virtual booking',async()=>{
 const now=(await db.query<{t:Date}>('SELECT clock_timestamp() t')).rows[0].t,open=new Date(now.getTime()+259200000),end=new Date(open.getTime()+43200000);
 const schedule={researchOpen:new Date(now.getTime()-60000).toISOString(),candidateLock:new Date(now.getTime()+86460000).toISOString(),voteOpen:new Date(now.getTime()+86460000).toISOString(),voteClose:new Date(now.getTime()+129660000).toISOString(),executionClose:new Date(now.getTime()+131400000).toISOString(),midweekOpen:open.toISOString(),midweekClose:end.toISOString(),expiresAt:new Date(end.getTime()+86400000).toISOString()};
 // Restored original synthetic timetable; injected internal clocks are not native elapsed-time evidence.
 const f=await syntheticBallot(db,60000,false,[],schedule);
 await castVote(db,f.holdToken,f.actor,'9001',{now:()=>new Date(f.close.getTime()-1000)});await closeBallot(db,f.id,{now:()=>f.close});
 const b=(await db.query("SELECT * FROM ballots WHERE round_id=$1 AND kind='midweek'",[f.roundId])).rows[0];expect(b.rules.parentOpeningBallotId).toBe(f.id);expect(b.rules.originalProposalVersionId).toBeNull();
 const button=(await db.query('SELECT token FROM callback_tokens WHERE ballot_id=$1',[b.id])).rows[0];
 const receipt=await castVote(db,button.token,f.actor,'9001',{now:()=>new Date(open.getTime()+1)});expect(receipt.status).toBe('saved');
 const closed=await closeBallot(db,b.id,{now:()=>end});expect(closed.outcome).toMatchObject({valid:true,strategy:'hold',quorum:1,total:1});
 expect((await ballotView(db,f.userId,b.id)).counts).toBeNull(); // Actual deadline still controls public release.
 expect((await db.query('SELECT count(*)::int n FROM order_intents i JOIN sleeves s ON s.id=i.sleeve_id WHERE s.round_id=$1',[f.roundId])).rows[0].n).toBe(0);
 expect((await db.query("SELECT count(*)::int n FROM operations WHERE id=$1",['virtual-book:'+b.id])).rows[0].n).toBe(0);
 expect((await db.query('SELECT h.precommitted_at=h0.precommitted_at same FROM house_decisions h JOIN house_decisions h0 ON h0.ballot_id=$2 WHERE h.ballot_id=$1',[b.id,f.id])).rows[0].same).toBe(true);
});
it('rejects unsupported direct management and records a repeatable Hold without provider or ledger mutation',async()=>{
 const f=await syntheticReviewedIntents(db),i=await f.intent(),p=(await db.query("INSERT INTO positions(intent_id,user_id,mode,provider_id,account_id,external_position_id,state,record) VALUES($1,$2,'simulation','synthetic',$3,$4,'open','{}') RETURNING id",[i.id,f.userId,'synthetic-'+f.accountId,'hold-position-'+i.id])).rows[0];
 for(const action of ['roll','buy_to_close','long_call','protective_put'])await expect(requestPositionManagement(db,f.userId,p.id,action,'management-test')).rejects.toMatchObject({code:'unsupported_action'});
 await requestPositionManagement(db,f.userId,p.id,'hold','management-test');await requestPositionManagement(db,f.userId,p.id,'hold','management-test');
 expect((await db.query('SELECT count(*)::int n FROM operations WHERE id=$1',[`position-hold:${p.id}:management-test`])).rows[0].n).toBe(1);
 expect((await db.query('SELECT count(*)::int n FROM ledger_events WHERE sleeve_id=$1',[f.sleeveId])).rows[0].n).toBe(0);expect((await db.query('SELECT state FROM order_intents WHERE id=$1',[i.id])).rows[0].state).toBe('awaiting_authorization');
});
