import {beforeAll,afterAll,it,expect} from 'vitest';
import {Pool} from 'pg';
import {testPool} from './helpers/database';
import {recordWorkerHealth,readHealth} from '../../src/server/operations/health';
let db:Pool;beforeAll(()=>{db=testPool();});afterAll(async()=>{await db.end();});
it('records aggregate health through the worker role, and app reads but cannot forge it or query queue payloads',async()=>{
 const u=new URL(process.env.TEST_DATABASE_URL!);u.username='guild_wars_worker';u.password='local_worker_only';const worker=new Pool({connectionString:u.toString(),max:1});u.username='guild_wars_app';u.password='local_app_only';const app=new Pool({connectionString:u.toString(),max:1});
 try{await recordWorkerHealth(worker);const result=await readHealth(app);expect(result.inputs?.database).toBe(true);expect(result.inputs?.workerAgeSeconds).toBeLessThan(5);expect(JSON.stringify(result)).not.toMatch(/account_id|external_order|token|cookie|last_error|payload/);await expect(app.query("UPDATE worker_health SET metrics='{}' WHERE component='worker'")).rejects.toThrow(/permission denied/);await expect(app.query('SELECT * FROM graphile_worker.jobs')).rejects.toThrow(/permission denied/);}finally{await Promise.all([worker.end(),app.end()]);}
});
it('database loss gives an explicit failed readiness without an exception body',async()=>{
 const broken=new Pool({connectionString:'postgresql://guild_wars_app:local_app_only@127.0.0.1:1/guild_wars_test',connectionTimeoutMillis:100,max:1});try{const r=await readHealth(broken);expect(r.ready).toBe(false);expect(r.inputs).toBeNull();expect(r.alerts).toContain('database_unavailable');}finally{await broken.end();}
});
