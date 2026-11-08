import {afterAll,beforeAll,expect,it} from 'vitest';
import {randomUUID} from 'node:crypto';
import {runMigrations} from 'graphile-worker';
import type {Pool} from 'pg';
import {testPool} from './helpers/database';
import {transaction} from '../../src/server/db/client';
import {enqueue} from '../../src/server/jobs/queue';
import {startJobRunners} from '../../src/server/jobs/handlers';
let db:Pool;
beforeAll(async()=>{db=testPool();await runMigrations({pgPool:db});});
afterAll(async()=>{await db.end();});
it('reserves deadline capacity while three background handlers are saturated',async()=>{
 const prefix=randomUUID();let release!:()=>void,started!:()=>void,critical!:()=>void,count=0;
 const blocked=new Promise<void>(r=>release=r),allStarted=new Promise<void>(r=>started=r),done=new Promise<void>(r=>critical=r);
 for(let i=0;i<3;i++)await transaction(db,tx=>enqueue(tx,{task:'resolve_research',operationId:`${prefix}:${i}`,payload:{synthetic:true}}));
 const runners=await startJobRunners(process.env.TEST_DATABASE_URL!,{
  resolve_research:async()=>{if(++count===3)started();await blocked;},close_ballot:async()=>{critical();}
 });
 try {
  await allStarted;
  await transaction(db,tx=>enqueue(tx,{task:'close_ballot',operationId:prefix,payload:{synthetic:true}}));
  await Promise.race([done,new Promise((_,reject)=>setTimeout(()=>reject(new Error('critical capacity starved for one second')),1000))]);
  const {rows}=await db.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE application_name IN ('guild-wars-critical','guild-wars-background')");
  expect(rows[0].n).toBeLessThanOrEqual(5);
 } finally {release();await runners.stop();}
});
