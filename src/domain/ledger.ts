import {invariant} from './errors';
export interface LedgerEvent {id:string;kind:'funding'|'fill'|'fee'|'settlement'|'correction';correctsId?:string;assetDeltaLamports:string;cashDeltaUsdcMicros:string;liabilityDeltaUsdcMicros:string}
function integer(value:string):bigint {invariant(typeof value==='string'&&value.length<=80&&/^-?(0|[1-9]\d*)$/.test(value),'ledger_units','Ledger units must be exact integer strings');return BigInt(value);}
const fields=['assetDeltaLamports','cashDeltaUsdcMicros','liabilityDeltaUsdcMicros'] as const;
export function projectLedger(events:readonly LedgerEvent[]):{assetLamports:bigint;cashUsdcMicros:bigint;liabilityUsdcMicros:bigint} {
 const seen=new Map<string,LedgerEvent>();const corrected=new Set<string>();const totals=[0n,0n,0n];
 for(const event of events) {
  invariant(event.id.length>0,'event_id','Event needs an idempotency key');
  for(const key of fields)integer(event[key]);
  const previous=seen.get(event.id);
  if(previous) {invariant(JSON.stringify([previous.kind,previous.correctsId,...fields.map(k=>previous[k])])===JSON.stringify([event.kind,event.correctsId,...fields.map(k=>event[k])]),'duplicate_changed','Changed duplicate needs an explicit correction');continue;}
  if(event.kind==='correction') {
   invariant(event.correctsId&&!corrected.has(event.correctsId),'correction','An original event may be reversed only once');
   const original=seen.get(event.correctsId);invariant(original,'correction','Correction must reference a prior event');
   for(const key of fields)invariant(integer(event[key])===-integer(original[key]),'correction','Correction must reverse the original before replacement');
   corrected.add(event.correctsId);
  }else invariant(!event.correctsId,'correction','Only explicit reversal events may correct an original');
  fields.forEach((key,index)=>totals[index]+=integer(event[key]));seen.set(event.id,event);
 }
 invariant(totals.every(n=>n>=0n),'negative_inventory','Negative inventory, cash or liability needs reconciliation');
 return {assetLamports:totals[0],cashUsdcMicros:totals[1],liabilityUsdcMicros:totals[2]};
}
