import {expect,it} from 'vitest';
import {preparationFlags} from './feature-flags';
import {safeLogRecord} from './logging';
import {assessHealth} from './health';
it('pause disables only new live preparation, and environment alone cannot release trading',()=>{
 expect(preparationFlags({GW_LIVE_PREPARATION_ENABLED:'true'},{gate0Passed:false,releaseApproved:false,providerId:null}).newLivePreparation).toBe(false);
 const f=preparationFlags({GW_LIVE_PREPARATION_ENABLED:'true',GW_PAUSE_NEW_PREPARATION:'true'},{gate0Passed:true,releaseApproved:true,providerId:'permitted'});expect(f.newLivePreparation).toBe(false);expect(f.reconcileExisting).toBe(true);expect(f.directProviderManagement).toBe(true);
});
it('logging drops raw messages, payloads, addresses, credentials and exception text',()=>{
 const value=safeLogRecord('worker','job_failed',{durationMs:7,count:3,errorCode:'source_unavailable',message:'bot123:secret',token:'secret',payload:{cookie:'secret'},accountId:'private',stack:'private'});expect(JSON.stringify(value)).not.toMatch(/secret|private|cookie|bot123/);expect(value).toMatchObject({durationMs:7,count:3,errorCode:'source_unavailable'});
});
it('health distinguishes liveness from database, stale-worker and queue/reconciliation alerts',()=>{
 const good={database:true,workerAgeSeconds:10,criticalLagSeconds:0,failedJobs:0,unknownOrders:0,reconciliationLagSeconds:0};expect(assessHealth(good).ready).toBe(true);expect(assessHealth({...good,workerAgeSeconds:61}).alerts).toContain('worker_stale');expect(assessHealth({...good,criticalLagSeconds:31}).alerts).toContain('deadline_queue_lag');expect(assessHealth({...good,failedJobs:1,unknownOrders:1,reconciliationLagSeconds:121}).alerts).toEqual(expect.arrayContaining(['failed_jobs','uncertain_orders','reconciliation_lag']));expect(assessHealth({...good,database:false}).ready).toBe(false);
});
