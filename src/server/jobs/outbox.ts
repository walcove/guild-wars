import type {Tx} from '../db/client';
import {invariant} from '../../domain/errors';
// This callback is database-only. A network send requires its separate uncertain-delivery state.
export async function applyEffect(tx:Tx,id:string,kind:string,effect:()=>Promise<void>):Promise<boolean> {
 const inserted=await tx.query("INSERT INTO operations(id,kind,state,record) VALUES($1,$2,'applying','{}') ON CONFLICT DO NOTHING RETURNING id",[id,kind]);
 if(!inserted.rowCount) {
  const {rows}=await tx.query('SELECT kind,state FROM operations WHERE id=$1 FOR UPDATE',[id]);
  invariant(rows[0]?.kind===kind&&rows[0]?.state==='complete','effect_uncertain','Existing operation is not a completed matching effect');return false;
 }
 await effect();await tx.query("UPDATE operations SET state='complete' WHERE id=$1",[id]);return true;
}
export async function beginDelivery(tx:Tx,id:string):Promise<boolean> {
 const result=await tx.query("UPDATE telegram_deliveries SET state='sending', attempts=attempts+1,last_attempt_at=clock_timestamp() WHERE id=$1 AND state IN ('pending','failed') RETURNING id",[id]);
 return result.rowCount===1;
}
export async function saveDelivery(tx:Tx,id:string,result:{state:'published';messageId:string}|{state:'failed'|'unknown'}):Promise<void> {
 const messageId=result.state==='published'?result.messageId:null;
 if(result.state==='published')invariant(/^[1-9]\d*$/.test(messageId!),'message_id','Published requires an acknowledged Telegram message reference');
 const saved=await tx.query("UPDATE telegram_deliveries SET state=$2,message_id=$3 WHERE id=$1 AND state='sending' RETURNING id",[id,result.state,messageId]);
 invariant(saved.rowCount===1,'delivery_state','Delivery changed; reconcile the canonical publication');
}
export async function recoverUncertainDeliveries(tx:Tx):Promise<number> {
 // Called only at startup after the prior deployment is known stopped; never blindly resend.
 const result=await tx.query("UPDATE telegram_deliveries SET state='unknown' WHERE state='sending'");return result.rowCount??0;
}
