import {afterAll,beforeAll,expect,it} from 'vitest';
import {randomUUID} from 'node:crypto';
import {runMigrations,runOnce} from 'graphile-worker';
import type {Pool} from 'pg';
import {testPool} from './helpers/database';
import {transaction} from '../../src/server/db/client';
import {enqueue} from '../../src/server/jobs/queue';
import {applyEffect} from '../../src/server/jobs/outbox';
let db:Pool;
beforeAll(async()=>{db=testPool();await runMigrations({pgPool:db});});
afterAll(async()=>{await db.end();});
it('restarts the actual library after an effect committed and a handler failed',async()=>{
 const id=randomUUID();let crash=true;
 const taskList={resolve_research:async(payload:unknown)=>{
  const p=payload as {operationId:string};
  await transaction(db,tx=>applyEffect(tx,p.operationId,'synthetic',async()=>{await tx.query("INSERT INTO audit_events(kind,record_id,reason,record) VALUES('synthetic',$1,'worker replay','{}')",[p.operationId]);}));
  if(crash&&p.operationId===id){crash=false;throw new Error('synthetic interruption after commit');}
 }};
 await transaction(db,tx=>enqueue(tx,{task:'resolve_research',operationId:id,payload:{synthetic:true}}));
 await runOnce({pgPool:db,taskList,noHandleSignals:true});
 expect((await db.query('SELECT id FROM graphile_worker.jobs WHERE key=$1',[`resolve_research:${id}`])).rowCount).toBe(1);
 // Supported replacement scheduling, never a mutation of Graphile private tables.
 await transaction(db,tx=>enqueue(tx,{task:'resolve_research',operationId:id,payload:{synthetic:true}}));
 await runOnce({pgPool:db,taskList,noHandleSignals:true});
 expect((await db.query('SELECT id FROM audit_events WHERE record_id=$1',[id])).rowCount).toBe(1);
 expect((await db.query('SELECT id FROM graphile_worker.jobs WHERE key=$1',[`resolve_research:${id}`])).rowCount).toBe(0);
});
it('recovers after a real worker process is killed without applying its committed effect twice',async()=>{
 const {fork}=await import('node:child_process');const {resolve}=await import('node:path');const {makeWorkerUtils}=await import('graphile-worker');
 const id=randomUUID();
 await transaction(db,tx=>enqueue(tx,{task:'resolve_research',operationId:id,payload:{synthetic:true}}));
 const child=fork(resolve('tests/integration/helpers/crash-worker.ts'),[],{execArgv:['--import','tsx'],env:{...process.env,GW_CRASH_OPERATION:id},stdio:['ignore','ignore','pipe','ipc']});
 try {
  await new Promise<void>((done,reject)=>{child.once('message',()=>done());child.once('error',reject);child.once('exit',code=>reject(new Error(`Worker exited before committed signal: ${code}`)));});
  const locked=(await db.query('SELECT locked_by FROM graphile_worker.jobs WHERE key=$1',[`resolve_research:${id}`])).rows[0].locked_by as string;
  expect(locked).toBeTruthy();
  const exited=new Promise<void>(done=>child.once('exit',()=>done()));child.kill('SIGKILL');await exited;
  const utils=await makeWorkerUtils({pgPool:db});try {await utils.forceUnlockWorkers([locked]);}finally{await utils.release();}
  await runOnce({pgPool:db,noHandleSignals:true,taskList:{resolve_research:async()=>{await transaction(db,tx=>applyEffect(tx,id,'synthetic',async()=>{await tx.query("INSERT INTO audit_events(kind,record_id,reason,record) VALUES('synthetic',$1,'duplicate attempt','{}')",[id]);}));}}});
  expect((await db.query('SELECT id FROM audit_events WHERE record_id=$1',[id])).rowCount).toBe(1);
 }finally{if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');}
});
