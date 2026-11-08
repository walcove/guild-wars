import {Pool} from 'pg';
import {run} from 'graphile-worker';
import {requireTestDatabaseUrl} from '../../../src/server/db/test-target';
import {transaction} from '../../../src/server/db/client';
import {applyEffect} from '../../../src/server/jobs/outbox';
const db=new Pool({connectionString:requireTestDatabaseUrl(process.env.TEST_DATABASE_URL),max:3});
const id=process.env.GW_CRASH_OPERATION!;
const runner=await run({pgPool:db,concurrency:1,noHandleSignals:true,taskList:{resolve_research:async(payload:unknown)=>{
 const p=payload as {operationId:string};if(p.operationId!==id)throw new Error('Not this isolated crash fixture');
 await transaction(db,tx=>applyEffect(tx,id,'synthetic',async()=>{await tx.query("INSERT INTO audit_events(kind,record_id,reason,record) VALUES('synthetic',$1,'hard crash test','{}')",[id]);}));
 process.send?.({state:'effect_committed'});await new Promise(()=>{});
}},crontab:''});
await runner.promise;
