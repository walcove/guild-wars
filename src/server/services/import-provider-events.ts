import {createHash} from 'node:crypto';
import type {Pool} from 'pg';
import {transaction,type Tx} from '../db/client';
import {canonicalJson} from '../../domain/proposals';
import {invariant} from '../../domain/errors';
import {assertSameMode} from '../../domain/types';
import {classifyFillTime,classifyAmendment,mergeObservedOrderState} from '../../domain/reconciliation';
import {tokenHash} from '../auth/crypto';
import {providerReadGate} from '../providers/read-access';
import {parseProviderObservation,eventFingerprint,type ProviderObservation} from '../providers/live/normalization';
import type {VerifiedExecutionEvent} from '../providers/contracts';
import {appendLedgerInTx,type LedgerInput} from './ledger';
import {readOwnIntent} from './order-intents';
export interface ProviderImportContext {userId:string;intentId:string;credentialHash:string;relationshipEvidenceRef:string}
interface Observation {id:string;intentId?:string;record:ProviderObservation;fingerprint:string}
interface Effect {intentId:string;revision:string;fingerprint:string;observationId:string;event:VerifiedExecutionEvent;ledger:LedgerInput|null}
const hash=(v:unknown)=>createHash('sha256').update(canonicalJson(v)).digest('hex');
function family(e:VerifiedExecutionEvent):string{const ref=e.kind==='fill'?e.externalFillId:e.kind==='fee'?e.externalEventId:e.kind==='order'?e.externalOrderId:e.externalPositionId;return 'provider-effect:'+hash([e.providerId,e.accountId,e.kind,ref]);}
async function effect(tx:Tx,key:string):Promise<Effect|null>{return (await tx.query<{record:Effect}>("SELECT record FROM operations WHERE id=$1 AND kind='provider_effect'",[key])).rows[0]?.record??null;}
async function issue(tx:Tx,intentId:string,obs:Observation,kind:string,detail:Record<string,unknown>={}){await tx.query('INSERT INTO reconciliation_issues(intent_id,observation_id,issue_key,kind,record) VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT(issue_key) DO NOTHING',[intentId,obs.id,hash([obs.id,kind,detail]),kind,JSON.stringify(detail)]);}
function ledgerEvent(id:string,e:VerifiedExecutionEvent,kind:LedgerInput['kind'],asset:string,cash:string,liability:string):LedgerInput{return {id,kind,assetDeltaLamports:asset,cashDeltaUsdcMicros:cash,liabilityDeltaUsdcMicros:liability,observedAt:e.kind==='fill'?(e.filledAt??e.observedAt):e.observedAt,source:e.source};}
function reverse(old:LedgerInput,obs:Observation):LedgerInput{return {...old,id:'provider-reversal:'+obs.id,kind:'correction',correctsId:old.id,assetDeltaLamports:(-BigInt(old.assetDeltaLamports)).toString(),cashDeltaUsdcMicros:(-BigInt(old.cashDeltaUsdcMicros)).toString(),liabilityDeltaUsdcMicros:(-BigInt(old.liabilityDeltaUsdcMicros)).toString(),observedAt:obs.record.event.receivedAt,source:obs.record.event.source};}
async function saveEffect(tx:Tx,intentId:string,obs:Observation,ledger:LedgerInput|null){const record:Effect={intentId,revision:obs.record.event.revision,fingerprint:obs.fingerprint,observationId:obs.id,event:obs.record.event,ledger};await tx.query("INSERT INTO operations(id,kind,state,record) VALUES($1,'provider_effect','complete',$2::jsonb) ON CONFLICT(id) DO UPDATE SET record=EXCLUDED.record",[family(obs.record.event),JSON.stringify(record)]);}
async function complete(tx:Tx,obs:Observation){await tx.query("UPDATE operations SET state='complete' WHERE id=$1",['provider-import:'+obs.id]);await tx.query("INSERT INTO reconciliation_resolutions(issue_id,source_reference,reason) SELECT id,$2,'Validated dependencies are now present and the recorded effect was applied' FROM reconciliation_issues WHERE observation_id=$1 AND kind IN ('waiting_for_fill','waiting_for_position','complete_correction_required') ON CONFLICT(issue_id) DO NOTHING",[obs.id,obs.id]);}
async function activeFills(tx:Tx,intentId:string){return (await tx.query<{record:Effect}>("SELECT record FROM operations WHERE kind='provider_effect' AND record->>'intentId'=$1 AND record#>>'{event,kind}'='fill' ORDER BY id",[intentId])).rows.map(r=>r.record);}
const sum=(events:Effect[],field:'quantityLamports'|'premiumUsdcMicros')=>events.reduce((n,r)=>n+(r.event.kind==='fill'?BigInt(r.event[field]):0n),0n);
const finalized=(o:ProviderObservation)=>['fixture','provider_final','solana_finalized'].includes(o.finality);
// Internal read-only source ingestion. No public route accepts these records, evidence flags or balances.
export async function importProviderEvents(db:Pool,context:ProviderImportContext,raw:unknown[]):Promise<void>{
 invariant(Array.isArray(raw)&&raw.length>=1&&raw.length<=100&&Buffer.byteLength(JSON.stringify(raw))<=2097152,'provider_batch','Provider record batch is outside its bounds');
 const incoming=raw.map(parseProviderObservation),first=await readOwnIntent(db,context.userId,context.intentId);
 await transaction(db,async tx=>{
  // Common economic lock order: account -> intent -> sleeve. No network I/O in this transaction.
  const account=(await tx.query('SELECT * FROM provider_accounts WHERE id=$1 AND user_id=$2 FOR UPDATE',[first.account_id,context.userId])).rows[0];
  const intent=(await tx.query('SELECT * FROM order_intents WHERE id=$1 AND user_id=$2 FOR UPDATE',[first.id,context.userId])).rows[0];
  invariant(account&&intent&&!account.revoked_at&&account.read_authorization_ref&&context.credentialHash===tokenHash(account.read_authorization_ref),'read_access_changed','Provider ownership or read authorization changed');
  invariant(context.relationshipEvidenceRef.length>0&&context.relationshipEvidenceRef.length<=256,'relationship_unverified','An approved source must prove the account/order/position relationship');
  if(intent.mode==='live')invariant(providerReadGate.gate0Passed&&providerReadGate.approvedProviderId===account.provider_id&&account.verified_at,'provider_unavailable','An approved authoritative provider reader is unavailable');
  const sleeve=(await tx.query('SELECT s.*,r.schedule FROM sleeves s JOIN rounds r ON r.id=s.round_id WHERE s.id=$1 AND s.user_id=$2 FOR UPDATE OF s',[intent.sleeve_id,context.userId])).rows[0];
  const now=(await tx.query<{t:Date}>('SELECT clock_timestamp() t')).rows[0].t.toISOString();
  const expectedInstrument=intent.review?.quote?.terms?.instrumentId??(intent.mode==='simulation'?intent.review?.instrumentId:null);
  invariant(sleeve&&intent.account_id===account.id&&sleeve.account_id===account.id,'attribution','Intent and sleeve must belong to the exact verified provider account');
  for(const observation of incoming){const e=observation.event;assertSameMode(intent.mode,e.mode);
   invariant(e.providerId===account.provider_id&&e.accountId===account.external_account_id,'provider_scope','Provider account reference does not match this owner');
   invariant(e.receivedAt<=now&&e.observedAt<=e.receivedAt&&e.source.receivedAt<=now,'provider_time','Provider records must already have been observed and received');
   invariant(intent.mode==='simulation'?e.source.synthetic&&observation.finality==='fixture':!e.source.synthetic&&observation.finality!=='fixture','source_class','Fixtures can never verify real fills or settlement');
   if(intent.mode==='live'&&e.kind!=='order'){const location=intent.review?.quote?.terms?.location;invariant(location==='solana'?['solana_confirmed','solana_finalized'].includes(observation.finality):location==='off_chain'&&observation.finality==='provider_final','record_finality','Economic record finality must match the actual provider execution location');}
   if(e.kind==='fill'||e.kind==='order')invariant(intent.external_order_id&&e.externalOrderId===intent.external_order_id,'attribution','An external order must be authoritatively associated with this exact intent');
   if(e.kind==='fill'||e.kind==='position')invariant(expectedInstrument&&e.instrumentId===expectedInstrument,'instrument','Provider instrument differs from the reviewed contract');
   const fingerprint=eventFingerprint(e),prior=(await tx.query<Observation>('SELECT id,intent_id AS "intentId",record,fingerprint FROM provider_observations WHERE provider_id=$1 AND account_id=$2 AND external_event_id=$3 AND provider_revision=$4 AND finality=$5',[e.providerId,e.accountId,e.externalEventId,e.revision,observation.finality])).rows[0];
   if(prior){invariant(prior.intentId===intent.id,'attribution','An existing provider observation belongs to another intent');invariant(prior.record.event.mode===intent.mode,'mode_immutable','Existing observation cannot change mode');if(prior.fingerprint!==fingerprint)await issue(tx,intent.id,prior,'changed_payload_same_revision',{candidate:observation,candidateFingerprint:fingerprint});continue;}
   const stored=(await tx.query<{id:string}>('INSERT INTO provider_observations(intent_id,provider_id,account_id,external_event_id,provider_revision,finality,fingerprint,record) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb) RETURNING id',[intent.id,e.providerId,e.accountId,e.externalEventId,e.revision,observation.finality,fingerprint,JSON.stringify(observation)])).rows[0];
   await tx.query("INSERT INTO operations(id,kind,state,record) VALUES($1,'provider_import','pending',$2::jsonb)",['provider-import:'+stored.id,JSON.stringify({intentId:intent.id,observationId:stored.id})]);
  }
  const pending=(await tx.query<Observation>("SELECT p.id,p.record,p.fingerprint FROM provider_observations p JOIN operations o ON o.id='provider-import:'||p.id::text WHERE p.intent_id=$1 AND o.state='pending' ORDER BY p.created_at,p.id LIMIT 100",[intent.id])).rows;
  const entries:LedgerInput[]=[];let correctedFillSet=false;
  // Fills precede dependent fees; position sources precede settlement. Corrections carry explicit lineage.
  const priority=(o:Observation)=>({fill:0,fee:1,order:2,position:3,settlement:4}[o.record.event.kind]);pending.sort((a,b)=>priority(a)-priority(b));
  for(const obs of pending){const e=obs.record.event,key=family(e),old=await effect(tx,key);invariant(!old||old.intentId===intent.id,'attribution','A provider fill/position cannot be counted in two intents or sleeves');
   if(e.kind==='order'){
    if(old&&(e.observedAt<old.event.observedAt||(old.event.kind==='order'&&['cancelled','rejected'].includes(old.event.state)&&['submitted','pending_confirmation'].includes(e.state)))){await complete(tx,obs);continue;}
    await saveEffect(tx,intent.id,obs,null);const fills=await activeFills(tx,intent.id),state=mergeObservedOrderState(intent.state,e.state,sum(fills,'quantityLamports').toString(),intent.review.quantityLamports);await tx.query('UPDATE order_intents SET state=$2 WHERE id=$1',[intent.id,state]);intent.state=state;await complete(tx,obs);continue;
   }
   if(e.kind==='position'){
    if(old&&old.event.kind==='position'&&(e.coveredLamports!==old.event.coveredLamports||e.instrumentId!==old.event.instrumentId)&&classifyAmendment({revision:old.revision,fingerprint:old.fingerprint},{revision:e.revision,fingerprint:obs.fingerprint,correctsRevision:obs.record.correctsRevision})!=='amendment'){await issue(tx,intent.id,obs,'position_amendment_required');continue;}
    if(old&&e.observedAt<old.event.observedAt){await complete(tx,obs);continue;}
    const prior=(await tx.query('SELECT * FROM positions WHERE provider_id=$1 AND account_id=$2 AND external_position_id=$3 FOR UPDATE',[e.providerId,e.accountId,e.externalPositionId])).rows[0];invariant(!prior||prior.intent_id===intent.id,'attribution','This verified provider position already belongs to another sleeve');
    const state=prior&&['settled','withdrawn'].includes(prior.state)?prior.state:e.state==='settled'?'settlement_pending':e.state;
    const record={providerReportedState:e.state,coveredLamports:e.coveredLamports,instrumentId:e.instrumentId,source:e.source,finality:obs.record.finality,dataClass:intent.mode==='simulation'?'teaching_only':'provider_record',relationshipEvidenceRef:context.relationshipEvidenceRef,notWithdrawalProof:true};
    if(prior)await tx.query('UPDATE positions SET state=$2,record=record||$3::jsonb WHERE id=$1',[prior.id,state,JSON.stringify(record)]);else await tx.query('INSERT INTO positions(intent_id,user_id,mode,provider_id,account_id,external_position_id,state,record) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb)',[intent.id,context.userId,intent.mode,e.providerId,e.accountId,e.externalPositionId,state,JSON.stringify(record)]);
    await saveEffect(tx,intent.id,obs,null);await complete(tx,obs);continue;
   }
   if(e.kind==='settlement'&&['pending','claimable','withdrawn'].includes(e.state)){
    const p=(await tx.query('SELECT * FROM positions WHERE provider_id=$1 AND account_id=$2 AND external_position_id=$3 AND intent_id=$4 FOR UPDATE',[e.providerId,e.accountId,e.externalPositionId,intent.id])).rows[0];if(!p){await issue(tx,intent.id,obs,'waiting_for_position');continue;}
    if(e.state==='withdrawn'){
     if(!p.record.settlement||e.assetDeltaLamports!=='0'||e.cashDeltaUsdcMicros!=='0'){await issue(tx,intent.id,obs,'withdrawal_requires_verified_transfer',{reason:'Withdrawal is a location change, not a second settlement payment'});continue;}
     await tx.query("UPDATE positions SET state='withdrawn',record=record||$2::jsonb WHERE id=$1",[p.id,JSON.stringify({withdrawal:{observationId:obs.id,source:e.source,finality:obs.record.finality}})]);
    }else if(!['settled','withdrawn'].includes(p.state))await tx.query('UPDATE positions SET state=$2,record=record||$3::jsonb WHERE id=$1',[p.id,e.state==='claimable'?'claimable':'settlement_pending',JSON.stringify({pendingSettlement:{observationId:obs.id,event:e},noReceiptInferred:true})]);
    await complete(tx,obs);continue;
   }
   const classification=classifyAmendment(old?{revision:old.revision,fingerprint:old.fingerprint}:null,{revision:e.revision,fingerprint:obs.fingerprint,correctsRevision:obs.record.correctsRevision});
   if(classification==='discrepancy'){await issue(tx,intent.id,obs,'unrelated_revision',{currentRevision:old?.revision??null,candidateRevision:e.revision});continue;}
   if(classification==='duplicate'){if(e.kind==='settlement'&&e.state==='settled'&&finalized(obs.record))await tx.query("UPDATE positions SET record=jsonb_set(jsonb_set(record,'{settlement,finality}',$4::jsonb),'{settlement,finalityObservationId}',$6::jsonb) WHERE provider_id=$1 AND account_id=$2 AND external_position_id=$3 AND intent_id=$5 AND record ? 'settlement'",[e.providerId,e.accountId,e.externalPositionId,JSON.stringify(obs.record.finality),intent.id,JSON.stringify(obs.id)]);await complete(tx,obs);continue;}
   let next:LedgerInput|null=null;
   if(e.kind==='fill'){
    invariant(BigInt(e.quantityLamports)>0n,'fill_quantity','A fill requires a positive authoritative quantity');
    const existing=(await tx.query('SELECT * FROM fills WHERE provider_id=$1 AND account_id=$2 AND external_fill_id=$3',[e.providerId,e.accountId,e.externalFillId])).rows[0];invariant(!existing||existing.intent_id===intent.id,'attribution','The same provider fill cannot be imported into two sleeves');
    const settlements=(await tx.query<{record:Effect}>("SELECT record FROM operations WHERE kind='provider_effect' AND record->>'intentId'=$1 AND record#>>'{event,kind}'='settlement'",[intent.id])).rows.map(r=>r.record);
    if(old&&old.fingerprint!==obs.fingerprint&&settlements.length){
     const currentFills=await activeFills(tx,intent.id),plannedQuantity=sum(currentFills,'quantityLamports')-(old.event.kind==='fill'?BigInt(old.event.quantityLamports):0n)+BigInt(e.quantityLamports),positions=(await tx.query('SELECT * FROM positions WHERE intent_id=$1',[intent.id])).rows;
     let coverageComplete=positions.length===1&&positions[0].record.coveredLamports===plannedQuantity.toString();
     if(!coverageComplete&&positions.length===1){const p=positions[0],oldPosition=await effect(tx,'provider-effect:'+hash([e.providerId,e.accountId,'position',p.external_position_id]));coverageComplete=!!oldPosition&&pending.some(candidate=>candidate.record.event.kind==='position'&&candidate.record.event.externalPositionId===p.external_position_id&&candidate.record.event.coveredLamports===plannedQuantity.toString()&&candidate.record.correctsRevision===oldPosition.revision);}
     const settlementComplete=settlements.every(s=>pending.some(candidate=>candidate.record.event.kind==='settlement'&&candidate.record.event.state==='settled'&&family(candidate.record.event)===family(s.event)&&candidate.record.correctsRevision===s.revision));
     if(!coverageComplete||!settlementComplete){await issue(tx,intent.id,obs,'complete_correction_required',{reason:'A settled fill amendment requires its authoritative corrected settlement and position coverage set'});await tx.query("UPDATE reservations SET state='unknown' WHERE intent_id=$1 AND state='released'",[intent.id]);continue;}
    }
    if(old?.event.kind==='fill'&&old.event.quantityLamports!==e.quantityLamports)correctedFillSet=true;
    next=ledgerEvent('provider-fill:'+obs.id,e,'fill','0',e.premiumUsdcMicros,e.premiumUsdcMicros);
    const timingQuality=sleeve.schedule.voteClose&&sleeve.schedule.executionClose?classifyFillTime(e.filledAt,e.receivedAt,{opensAt:sleeve.schedule.voteClose,closesAt:sleeve.schedule.executionClose}):'unverifiable';
    const fill=existing??(await tx.query('INSERT INTO fills(intent_id,provider_id,account_id,external_fill_id,record) VALUES($1,$2,$3,$4,$5::jsonb) RETURNING *',[intent.id,e.providerId,e.accountId,e.externalFillId,JSON.stringify({event:e,virtual:intent.mode==='simulation',relationshipEvidenceRef:context.relationshipEvidenceRef})])).rows[0];
    await tx.query('INSERT INTO fill_revisions(fill_id,provider_revision,fingerprint,record) VALUES($1,$2,$3,$4::jsonb) ON CONFLICT(fill_id,provider_revision) DO NOTHING',[fill.id,e.revision,obs.fingerprint,JSON.stringify({event:e,observationId:obs.id,ledgerEventId:next.id,timingQuality,finality:obs.record.finality,dataClass:intent.mode==='simulation'?'teaching_only':'provider_record',correctsRevision:obs.record.correctsRevision})]);
   }else if(e.kind==='fee'){
    const parent=(await tx.query('SELECT intent_id FROM fills WHERE provider_id=$1 AND account_id=$2 AND external_fill_id=$3',[e.providerId,e.accountId,e.externalFillId])).rows[0];if(!parent){await issue(tx,intent.id,obs,'waiting_for_fill');continue;}invariant(parent.intent_id===intent.id,'attribution','Fee belongs to another intent’s fill');next=ledgerEvent('provider-fee:'+obs.id,e,'fee',e.currency==='SOL'?'-'+e.units:'0',e.currency==='USDC'?'-'+e.units:'0','0');
   }else if(e.kind==='settlement'){
    const pendingFillAmendments=(await tx.query("SELECT p.id FROM provider_observations p JOIN operations o ON o.id='provider-import:'||p.id::text WHERE p.intent_id=$1 AND o.state='pending' AND p.record#>>'{event,kind}'='fill' AND p.record->>'correctsRevision' IS NOT NULL LIMIT 1",[intent.id])).rowCount;
    if(pendingFillAmendments){await issue(tx,intent.id,obs,'complete_correction_required',{reason:'Do not apply one side of an incomplete financial correction set'});continue;}
    const p=(await tx.query('SELECT * FROM positions WHERE provider_id=$1 AND account_id=$2 AND external_position_id=$3 AND intent_id=$4 FOR UPDATE',[e.providerId,e.accountId,e.externalPositionId,intent.id])).rows[0];if(!p){await issue(tx,intent.id,obs,'waiting_for_position');continue;}
    const fills=await activeFills(tx,intent.id),quantity=sum(fills,'quantityLamports'),premium=sum(fills,'premiumUsdcMicros');
    if(quantity===0n||p.record.coveredLamports!==quantity.toString()){await issue(tx,intent.id,obs,'position_fill_mapping_required',{reason:'Settlement requires complete authoritative position-to-fill coverage, not a guessed allocation'});continue;}
    const other=(await tx.query("SELECT id FROM positions WHERE intent_id=$1 AND id<>$2",[intent.id,p.id])).rowCount;if(other){await issue(tx,intent.id,obs,'position_fill_mapping_required',{reason:'Multiple positions need provider-specific fill attribution before accounting'});continue;}
    next=ledgerEvent('provider-settlement:'+obs.id,e,'settlement',e.assetDeltaLamports,e.cashDeltaUsdcMicros,(-premium).toString());
    await tx.query("UPDATE positions SET state='settled',record=record||$2::jsonb WHERE id=$1",[p.id,JSON.stringify({settlement:{observationId:obs.id,event:e,ledgerEventId:next.id,finality:obs.record.finality},noWithdrawalInferred:true})]);
   }
   if(next){if(old?.ledger)entries.push(reverse(old.ledger,obs));entries.push(next);await saveEffect(tx,intent.id,obs,next);await complete(tx,obs);}
  }
  if(entries.length)await appendLedgerInTx(tx,sleeve.id,intent.mode,entries);
  const fills=await activeFills(tx,intent.id),filled=sum(fills,'quantityLamports');
  if(filled>0n){const state=mergeObservedOrderState(correctedFillSet?'unknown':intent.state,'partially_filled',filled.toString(),intent.review.quantityLamports);await tx.query('UPDATE order_intents SET state=$2 WHERE id=$1',[intent.id,state]);await tx.query("UPDATE reservations SET covered_lamports=GREATEST(covered_lamports,$2::numeric),state=$3 WHERE intent_id=$1 AND state<>'released'",[intent.id,filled.toString(),state==='filled'?'filled':'partially_filled']);}
  // No clock/quote-based release. Even cancellation needs a complete source-supported fill set.
  const positions=(await tx.query('SELECT state,record FROM positions WHERE intent_id=$1',[intent.id])).rows;
  const unresolved=(await tx.query('SELECT id FROM reconciliation_issues i WHERE intent_id=$1 AND NOT EXISTS(SELECT FROM reconciliation_resolutions r WHERE r.issue_id=i.id) LIMIT 1',[intent.id])).rowCount;
  if(!unresolved&&filled>=BigInt(intent.review.quantityLamports)&&positions.length===1&&positions.every(p=>['settled','withdrawn'].includes(p.state)&&p.record.settlement&&finalized({event:p.record.settlement.event,correctsRevision:null,finality:p.record.settlement.finality}))){await tx.query("UPDATE reservations SET state='released' WHERE intent_id=$1",[intent.id]);}
 });
}
