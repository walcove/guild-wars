import {afterAll,beforeAll,expect,it} from 'vitest';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {testPool} from './helpers/database';
import {syntheticBallot} from './helpers/ballots';
import {priorSyntheticRound} from './helpers/simulation-round';
import {castVote,castVoteInTx} from '../../src/server/services/ballots';
import {freezeSimulationSnapshot} from '../../src/server/jobs/book-simulation';
let db:Pool;beforeAll(()=>{db=testPool();});afterAll(async()=>{await db.end();});
async function blocked(name:string){for(let n=0;n<60;n++){if((await db.query('SELECT cardinality(pg_blocking_pids(pid))>0 blocked FROM pg_stat_activity WHERE application_name=$1',[name])).rows.some(r=>r.blocked))return;await new Promise(r=>setTimeout(r,10));}throw Error('Expected the actual database lock wait');}
it('rejects a changed vote after a membership lock crosses closing, preserving its earlier receipt',async()=>{
 const f=await syntheticBallot(db,1500),original=await castVote(db,f.callToken,f.actor,'9001'),holder=await db.connect(),voter=await db.connect(),name='final-member-'+randomUUID();
 try{await holder.query('BEGIN');await holder.query('SELECT user_id FROM memberships WHERE guild_id=$1 AND user_id=$2 FOR UPDATE',[f.guildId,f.userId]);await voter.query('BEGIN');await voter.query("SELECT set_config('application_name',$1,true)",[name]);const pending=castVoteInTx(voter,f.holdToken,f.actor,'9001').then(value=>({value,error:null}),error=>({value:null,error}));await blocked(name);await holder.query('SELECT pg_sleep(GREATEST(0,extract(epoch FROM($1::timestamptz-clock_timestamp())))+0.04)',[f.close]);await holder.query('COMMIT');const result=await pending;expect(result.error).toMatchObject({code:'ballot_closed'});await voter.query('ROLLBACK');const saved=(await db.query('SELECT choice_id,revision FROM votes WHERE ballot_id=$1',[f.id])).rows[0];expect(saved).toEqual({choice_id:f.call,revision:original.revision});expect((await db.query('SELECT count(*)::int n FROM vote_events WHERE ballot_id=$1',[f.id])).rows[0].n).toBe(1);
 }finally{await holder.query('ROLLBACK');await voter.query('ROLLBACK');holder.release();voter.release();}
});
it('rejects a first snapshot after its round-row lock crosses the fixed booking cutoff',async()=>{
 const f=await priorSyntheticRound(db,false),holder=await db.connect(),name='final-snapshot-'+randomUUID(),waiter=new Pool({connectionString:process.env.TEST_DATABASE_URL,max:1,application_name:name,statement_timeout:5000});
 try{await holder.query('BEGIN');await holder.query('SELECT id FROM rounds WHERE id=$1 FOR UPDATE',[f.roundId]);const pending=freezeSimulationSnapshot(waiter,f.roundId,f.input).then(()=>({error:null}),error=>({error}));await blocked(name);await holder.query('SELECT pg_sleep(GREATEST(0,extract(epoch FROM($1::timestamptz-clock_timestamp())))+0.04)',[f.booking]);await holder.query('COMMIT');expect((await pending).error).toMatchObject({code:'snapshot_late'});expect((await db.query('SELECT round_id FROM simulation_snapshots WHERE round_id=$1',[f.roundId])).rowCount).toBe(0);
 }finally{await holder.query('ROLLBACK');holder.release();await waiter.end();}
});
