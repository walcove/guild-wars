import type {Tx} from '../db/client';
import {invariant} from '../../domain/errors';
import {parseUtc} from '../../domain/types';
import {budgets,lane,queueName} from './budgets';
export const tasks=['close_ballot','recover_due','capture_quote','midweek_notice','reconcile_settlement','resolve_research','deliver_telegram'] as const;
export interface JobRequest {task:typeof tasks[number];operationId:string;payload:Record<string,unknown>;runAt?:string}
// Domain write -> supported add_job SQL -> COMMIT. Job keys never prove an effect ran once.
export async function enqueue(tx:Tx,request:JobRequest):Promise<string> {
 invariant(tasks.includes(request.task)&&/^[A-Za-z0-9:_-]{1,180}$/.test(request.operationId),'invalid_job','Invalid canonical job identity');
 if(request.runAt)parseUtc(request.runAt);
 const payload=JSON.stringify({...request.payload,operationId:request.operationId});
 invariant(Buffer.byteLength(payload)<=65536,'job_size','Job payload exceeds its bounded size');
 const {rows}=await tx.query<{id:string}>(`SELECT public.gw_enqueue_job($1,$2::json,$3,COALESCE($4::timestamptz,clock_timestamp()),$5::smallint,$6,$7::smallint)::text AS id`,[request.task,payload,queueName(request.task,request.operationId),request.runAt??null,budgets.attempts,`${request.task}:${request.operationId}`,lane(request.task)==='critical'?-10:0]);
 invariant(rows[0]?.id,'enqueue_failed','Job enqueue returned no identifier; roll back the domain write');return rows[0].id;
}
