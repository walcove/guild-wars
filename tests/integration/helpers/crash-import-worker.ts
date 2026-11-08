import {Pool} from 'pg';
import {run} from 'graphile-worker';
import {requireTestDatabaseUrl} from '../../../src/server/db/test-target';
import {importProviderEvents,type ProviderImportContext} from '../../../src/server/services/import-provider-events';
import type {ProviderObservation} from '../../../src/server/providers/live/normalization';
const db=new Pool({connectionString:requireTestDatabaseUrl(process.env.TEST_DATABASE_URL),max:3});
const runner=await run({pgPool:db,concurrency:1,noHandleSignals:true,crontab:'',taskList:{['crash-import-'+process.env.GW_IMPORT_CRASH_OPERATION!.replace('provider-crash:','')]:async(payload:unknown)=>{
 const p=payload as {operationId:string;fixture:{context:ProviderImportContext;observations:ProviderObservation[]}};
 if(p.operationId!==process.env.GW_IMPORT_CRASH_OPERATION)throw Error('Not this isolated synthetic import fixture');
 await importProviderEvents(db,p.fixture.context,p.fixture.observations);process.send?.({state:'ledger_committed'});await new Promise(()=>{});
}}});await runner.promise;
