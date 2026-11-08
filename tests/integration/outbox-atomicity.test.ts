import { afterAll, beforeAll, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { runMigrations } from 'graphile-worker';
import { testPool } from './helpers/database';
import { transaction } from '../../src/server/db/client';
import { enqueue } from '../../src/server/jobs/queue';
import { applyEffect } from '../../src/server/jobs/outbox';
let db: Pool;
beforeAll(async () => { db=testPool(); await runMigrations({pgPool:db}); });
afterAll(async () => { await db.end(); });
it('rolls back both domain write and the real Graphile SQL enqueue', async () => {
 const id=randomUUID();
 await expect(transaction(db, async tx => {
  await tx.query("INSERT INTO operations(id,kind,state,record) VALUES($1,'synthetic','pending','{}')",[id]);
  await enqueue(tx,{task:'resolve_research',operationId:id,payload:{synthetic:true}});
  throw new Error('synthetic rollback');
 })).rejects.toThrow('synthetic rollback');
 expect((await db.query('SELECT id FROM operations WHERE id=$1',[id])).rowCount).toBe(0);
 expect((await db.query('SELECT id FROM graphile_worker.jobs WHERE key=$1',[`resolve_research:${id}`])).rowCount).toBe(0);
});
it('deduplicates committed effects independently of a library job key',async()=>{
 const id=randomUUID(); let effects=0;
 for(let n=0;n<2;n++) await transaction(db,tx=>applyEffect(tx,id,'synthetic',async()=>{effects++;await tx.query("INSERT INTO audit_events(kind,record_id,reason,record) VALUES('synthetic',$1,'effect replay test','{}')",[id]);}));
 expect(effects).toBe(1);
 expect((await db.query('SELECT id FROM audit_events WHERE record_id=$1',[id])).rowCount).toBe(1);
});
it('retains an uncertain delivery and never claims it can be blindly sent again',async()=>{
 const {syntheticGuild}=await import('./helpers/fixtures');const {beginDelivery,saveDelivery,recoverUncertainDeliveries}=await import('../../src/server/jobs/outbox');
 const f=await syntheticGuild(db),operation=randomUUID(),id=randomUUID();
 await db.query("INSERT INTO operations(id,kind,state,record) VALUES($1,'telegram','pending','{}')",[operation]);
 await db.query("INSERT INTO telegram_deliveries(id,operation_id,proposal_version_id,chat_id,state) VALUES($1,$2,$3,'-1001','pending')",[id,operation,f.versionId]);
 expect(await transaction(db,tx=>beginDelivery(tx,id))).toBe(true);
 // Restart after a send began: we cannot know whether the remote side accepted it.
 await transaction(db,recoverUncertainDeliveries);
 expect(await transaction(db,tx=>beginDelivery(tx,id))).toBe(false);
 await expect(transaction(db,tx=>saveDelivery(tx,id,{state:'published',messageId:'123'}))).rejects.toThrow(/reconcile/);
 expect((await db.query('SELECT state FROM telegram_deliveries WHERE id=$1',[id])).rows[0].state).toBe('unknown');
});
it('enqueues atomically using the least-privilege web role rather than a database owner',async()=>{
 const {Pool}=await import('pg');const url=new URL(process.env.TEST_DATABASE_URL!);url.username='guild_wars_app';url.password='local_app_only';
 const app=new Pool({connectionString:url.toString(),max:1});const id=randomUUID();
 try {
  await transaction(app,async tx=>{await tx.query("INSERT INTO operations(id,kind,state,record) VALUES($1,'synthetic','pending','{}')",[id]);await enqueue(tx,{task:'resolve_research',operationId:id,payload:{synthetic:true},runAt:'2100-01-01T00:00:00.000Z'});});
  expect((await db.query('SELECT id FROM graphile_worker.jobs WHERE key=$1',[`resolve_research:${id}`])).rowCount).toBe(1);
 }finally{await app.end();}
});
