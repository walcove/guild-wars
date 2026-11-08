import type {Pool} from 'pg';
export interface HealthInputs {database:boolean;workerAgeSeconds:number|null;criticalLagSeconds:number;failedJobs:number;unknownOrders:number;reconciliationLagSeconds:number}
export function assessHealth(v:HealthInputs){
 const alerts:string[]=[];if(!v.database)alerts.push('database_unavailable');if(v.workerAgeSeconds===null||v.workerAgeSeconds>60)alerts.push('worker_stale');if(v.criticalLagSeconds>30)alerts.push('deadline_queue_lag');if(v.failedJobs>0)alerts.push('failed_jobs');if(v.unknownOrders>0)alerts.push('uncertain_orders');if(v.reconciliationLagSeconds>120)alerts.push('reconciliation_lag');
 return {ready:alerts.length===0,alerts};
}
export async function readHealth(db:Pool){
 try{const r=(await db.query<{age:number;metrics:Omit<HealthInputs,'database'|'workerAgeSeconds'>}>('SELECT extract(epoch FROM (clock_timestamp()-observed_at))::float8 age,metrics FROM worker_health WHERE component=\'worker\'')).rows[0];const inputs:HealthInputs={database:true,workerAgeSeconds:r?.age??null,criticalLagSeconds:r?.metrics.criticalLagSeconds??0,failedJobs:r?.metrics.failedJobs??0,unknownOrders:r?.metrics.unknownOrders??0,reconciliationLagSeconds:r?.metrics.reconciliationLagSeconds??0};return {...assessHealth(inputs),inputs};}
 catch{return {...assessHealth({database:false,workerAgeSeconds:null,criticalLagSeconds:0,failedJobs:0,unknownOrders:0,reconciliationLagSeconds:0}),inputs:null};}
}
// Worker role reads the library's documented public jobs view; web never gets queue access.
export async function recordWorkerHealth(db:Pool){
 await db.query(`WITH queue AS (
 SELECT greatest(0,coalesce(max(extract(epoch FROM(clock_timestamp()-run_at))) FILTER(WHERE task_identifier IN ('close_ballot','recover_due') AND attempts<max_attempts),0)) critical_lag,
 count(*) FILTER(WHERE attempts>=max_attempts) failed FROM graphile_worker.jobs
 ), orders AS (
 SELECT count(*) FILTER(WHERE i.state='unknown') uncertain,
 greatest(0,coalesce(max(extract(epoch FROM(clock_timestamp()-coalesce(o.created_at,i.created_at)))),0)) source_age
 FROM order_intents i LEFT JOIN LATERAL(SELECT created_at FROM provider_observations WHERE intent_id=i.id ORDER BY created_at DESC LIMIT 1)o ON true
 WHERE i.mode='live' AND i.state IN ('submitted','pending_confirmation','partially_filled','unknown')
 ) INSERT INTO worker_health(component,observed_at,metrics)
 SELECT 'worker',clock_timestamp(),jsonb_build_object('criticalLagSeconds',q.critical_lag,'failedJobs',q.failed,'unknownOrders',o.uncertain,'reconciliationLagSeconds',o.source_age) FROM queue q CROSS JOIN orders o
 ON CONFLICT(component) DO UPDATE SET observed_at=excluded.observed_at,metrics=excluded.metrics`);
}
