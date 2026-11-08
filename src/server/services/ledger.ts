import type {Pool} from 'pg';
import {z} from 'zod';
import {invariant} from '../../domain/errors';
import {projectLedger,type LedgerEvent} from '../../domain/ledger';
import {parseSource,parseUtc,assertSameMode,type SourceStamp,type TradingMode} from '../../domain/types';
import {transaction,type Tx} from '../db/client';
export type LedgerInput=LedgerEvent&{observedAt:string;source:SourceStamp};
const signed=z.string().max(80).regex(/^-?(0|[1-9]\d*)$/),operation=z.string().regex(/^[A-Za-z0-9:_-]{1,180}$/);
const eventSchema=z.object({id:operation,kind:z.enum(['funding','fill','fee','settlement','correction']),correctsId:operation.optional(),assetDeltaLamports:signed,cashDeltaUsdcMicros:signed,liabilityDeltaUsdcMicros:signed,observedAt:z.string(),source:z.unknown()}).strict();
function normalize(input:LedgerInput):LedgerInput {const event=eventSchema.parse(input);return {...event,observedAt:parseUtc(event.observedAt),source:parseSource(event.source)};}
function fingerprint(e:LedgerInput):string{return JSON.stringify([e.id,e.kind,e.correctsId??null,e.assetDeltaLamports,e.cashDeltaUsdcMicros,e.liabilityDeltaUsdcMicros,e.observedAt,e.source.sourceId,e.source.observedAt,e.source.receivedAt,e.source.synthetic]);}
async function events(tx:Tx,id:string){const rows=(await tx.query<{id:string;operation_id:string;record:LedgerInput}>('SELECT id,operation_id,record FROM ledger_events WHERE sleeve_id=$1 ORDER BY sequence LIMIT 10001',[id])).rows;invariant(rows.length<=10000,'ledger_limit','Ledger requires a verified checkpoint before further projection');return rows;}
export async function appendLedgerInTx(tx:Tx,sleeveId:string,mode:TradingMode,inputs:LedgerInput[]):Promise<void> {
 invariant(inputs.length>=1&&inputs.length<=100,'ledger_batch','Ledger batch must contain 1–100 events');
 const sleeve=(await tx.query<{mode:TradingMode}>('SELECT mode FROM sleeves WHERE id=$1 FOR UPDATE',[sleeveId])).rows[0];invariant(sleeve,'sleeve_unavailable','Sleeve unavailable');assertSameMode(sleeve.mode,mode);
 const existing=await events(tx,sleeveId),byId=new Map(existing.map(e=>[e.operation_id,e])),all=existing.map(e=>e.record);
 for(const input of inputs) {
  const event=normalize(input);invariant(mode!=='live'||!event.source.synthetic,'synthetic_live','Synthetic evidence cannot enter a real-money ledger');
  const prior=byId.get(event.id);if(prior){invariant(fingerprint(prior.record)===fingerprint(event),'duplicate_changed','Changed duplicate needs an explicit reversal and replacement');continue;}
  const corrected=event.correctsId?byId.get(event.correctsId):undefined;
  invariant(!event.correctsId||corrected,'correction','Correction must refer to an existing event in this sleeve');
  all.push(event); // Final projection validates exact reversals, negative inventory and changed duplicates.
  const row=(await tx.query<{id:string}>('INSERT INTO ledger_events(sleeve_id,operation_id,kind,record,corrects_event_id,observed_at) VALUES($1,$2,$3,$4::jsonb,$5,$6) RETURNING id',[sleeveId,event.id,event.kind,JSON.stringify(event),corrected?.id??null,event.observedAt])).rows[0];byId.set(event.id,{...row,operation_id:event.id,record:event});
 }
 projectLedger(all); // A failed invariant rolls back the entire batch, including corrections.
}
// Internal accounting boundary. HTTP and bot callers cannot submit ledger events.
export async function appendLedger(db:Pool,sleeveId:string,mode:TradingMode,inputs:LedgerInput[]):Promise<void>{await transaction(db,tx=>appendLedgerInTx(tx,sleeveId,mode,inputs));}
export async function readLedger(db:Pool,userId:string,sleeveId:string):Promise<{assetLamports:string;cashUsdcMicros:string;liabilityUsdcMicros:string}> {
 return transaction(db,async tx=>{const sleeve=(await tx.query('SELECT id FROM sleeves WHERE id=$1 AND user_id=$2',[sleeveId,userId])).rows[0];invariant(sleeve,'forbidden','This ledger belongs to another account or is unavailable');const result=projectLedger((await events(tx,sleeveId)).map(e=>e.record));return {assetLamports:result.assetLamports.toString(),cashUsdcMicros:result.cashUsdcMicros.toString(),liabilityUsdcMicros:result.liabilityUsdcMicros.toString()};});
}
