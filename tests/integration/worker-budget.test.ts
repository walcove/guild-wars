import {afterAll,beforeAll,expect,it} from 'vitest';
import {randomUUID} from 'node:crypto';
import {run,makeWorkerUtils} from 'graphile-worker';
import type {Pool} from 'pg';
import {testPool} from './helpers/database';
import {workerPools,budgets,lane} from '../../src/server/jobs/budgets';
let db:Pool;beforeAll(()=>{db=testPool();});afterAll(async()=>{await db.end();});
it('reserves deadline capacity while three background handlers are saturated',async()=>{
 const marker=randomUUID(),pools=workerPools(process.env.TEST_DATABASE_URL!),utils=await makeWorkerUtils({pgPool:db}),ids:string[]=[];
 let release!:()=>void,started!:()=>void,critical!:()=>void,count=0;
 const blocked=new Promise<void>(r=>release=r),allStarted=new Promise<void>(r=>started=r),done=new Promise<void>(r=>critical=r);
 // Unique supported task identifiers avoid consuming another fixture's real recovery work.
 for(let i=0;i<3;i++)ids.push((await utils.addJob('budget_fixture_background',{marker},{queueName:`budget-${marker}-${i}`,maxAttempts:1})).id);
 const background=await run({pgPool:pools.background,concurrency:budgets.backgroundHandlers,noHandleSignals:true,pollInterval:50,parsedCronItems:[],taskList:{budget_fixture_background:async p=>{expect(p).toEqual({marker});if(++count===3)started();await blocked;}}});
 const reserved=await run({pgPool:pools.critical,concurrency:budgets.criticalHandlers,noHandleSignals:true,pollInterval:50,parsedCronItems:[],taskList:{budget_fixture_critical:async p=>{expect(p).toEqual({marker});critical();}}});
 try{
  await Promise.race([allStarted,new Promise((_,reject)=>setTimeout(()=>reject(Error('Background fixture failed to start')),3000))]);
  ids.push((await utils.addJob('budget_fixture_critical',{marker},{queueName:`budget-critical-${marker}`,maxAttempts:1})).id);
  await Promise.race([done,new Promise((_,reject)=>setTimeout(()=>reject(Error('Critical capacity starved for one second')),1000))]);
  expect(lane('close_ballot')).toBe('critical');expect(lane('resolve_research')).toBe('background');
  expect((await db.query("SELECT count(*)::int n FROM pg_stat_activity WHERE application_name IN ('guild-wars-critical','guild-wars-background')")).rows[0].n).toBeLessThanOrEqual(5);
 }finally{release();await Promise.all([background.stop(),reserved.stop()]);await utils.completeJobs(ids);await utils.release();await Promise.all([pools.critical.end(),pools.background.end()]);}
});
