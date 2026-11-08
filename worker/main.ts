import {Pool} from 'pg';
import {budgets} from '../src/server/jobs/budgets';
import {startJobRunners} from '../src/server/jobs/handlers';
import {transaction,observePool} from '../src/server/db/client';
import {recoverDue} from '../src/server/jobs/scheduler';
import {recoverUncertainDeliveries} from '../src/server/jobs/outbox';
if(process.env.GW_LIVE_PREPARATION_ENABLED==='true')throw new Error('Live preparation has not passed release gates');
if(process.argv.includes('--check'))console.info(JSON.stringify({component:'worker',configurationValid:true,livePreparation:false,budgets}));
else {
 const connectionString=process.env.WORKER_DATABASE_URL??process.env.DATABASE_URL;
 if(!connectionString)throw new Error('Worker database is not configured');
 const startup=observePool(new Pool({connectionString,max:1,connectionTimeoutMillis:1000}),'worker-startup');
 try {
  const {rows}=await startup.query("SELECT current_user=pg_get_userbyid(nspowner) AS owns_queue FROM pg_namespace WHERE nspname='graphile_worker'");
  if(!rows[0]?.owns_queue)throw new Error('Worker role must own its dedicated Graphile schema; run explicit worker setup');
  await transaction(startup,async tx=>{await recoverUncertainDeliveries(tx);await recoverDue(tx);});}finally{await startup.end();}
 const runners=await startJobRunners(connectionString);
 console.info(JSON.stringify({component:'worker',ready:true,livePreparation:false}));
 for(const signal of ['SIGTERM','SIGINT'] as const)process.once(signal,()=>{void runners.stop();});
 await runners.promise;
}
