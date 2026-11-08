import {tokenHash} from '../auth/crypto';
import type {Tx} from '../db/client';
import {executionGate} from '../providers/live-readiness';
import {createHash} from 'node:crypto';
import type {Pool} from 'pg';
import {canonicalJson} from '../../domain/proposals';
import {invariant} from '../../domain/errors';
import {parseSource,unitsSchema,assertSameMode,type SourceStamp,type TradingMode} from '../../domain/types';
import {availableAfterCommitments,type Commitment,type ReflectedCommitment} from '../../domain/order-policy';
import {inGuild} from '../db/repositories';
import {providerReadGate} from '../providers/read-access';
export interface AvailableAssetSnapshot {accountId:string;userId:string;providerId:string;mode:TradingMode;unencumberedLamports:string;reflectedCommitments:ReflectedCommitment[];source:SourceStamp}
export async function readOwnIntent(db:Pool,userId:string,id:string){
 const row=(await db.query(`SELECT g.name AS guild_name,i.id,i.guild_id,i.sleeve_id,i.user_id,i.account_id,i.mode,i.state,i.idempotency_key,i.review,i.review_hash,i.review_revision,i.external_order_id,
 (SELECT count(*)::int FROM reconciliation_issues x WHERE x.intent_id=i.id AND NOT EXISTS(SELECT FROM reconciliation_resolutions r WHERE r.issue_id=x.id)) AS verification_issues,
 (SELECT state FROM operations WHERE id='prepare:'||i.id::text||':'||i.review_revision::text) AS preparation_state,
 EXISTS(SELECT FROM reservations WHERE intent_id=i.id AND state<>'released' AND (state<>'reserved' OR provider_ref IS NOT NULL)) AS unsafe_reservation,
 COALESCE((SELECT jsonb_agg(o.record->'event') FROM operations o WHERE o.kind='provider_effect' AND o.record->>'intentId'=i.id::text),'[]') AS effect_events,
 COALESCE((SELECT jsonb_agg(f.record) FROM fills f WHERE f.intent_id=i.id),'[]') AS fill_records,
 (SELECT jsonb_build_object('state',r.state,'coveredLamports',r.covered_lamports::text,'feeReserveLamports',r.fee_reserve_lamports::text) FROM reservations r WHERE r.intent_id=i.id) AS commitment,
 COALESCE((SELECT jsonb_agg(jsonb_build_object('id',p.id,'state',p.state)) FROM positions p WHERE p.intent_id=i.id AND p.user_id=i.user_id),'[]') AS recorded_positions
 FROM order_intents i JOIN guilds g ON g.id=i.guild_id WHERE i.id=$1 AND i.user_id=$2`,[id,userId])).rows[0];invariant(row,'forbidden','This order intent belongs to another account or is unavailable');
 const {effect_events,fill_records,commitment,recorded_positions,verification_issues,preparation_state,unsafe_reservation,...intent}=row;
 type FillFact={quantityLamports:string;premiumUsdcMicros:string;observedAt:string};type FeeFact={currency:string;units:string};
 const effects=effect_events as ({kind:string}&Partial<FillFact>&Partial<FeeFact>)[],fills=effects.filter(e=>e.kind==='fill') as FillFact[],feeFacts=effects.filter(e=>e.kind==='fee') as FeeFact[];
 if(!fills.length)for(const record of fill_records){if(record.virtual===true&&record.opening?.quote&&record.coveredLamports){fills.push({quantityLamports:record.coveredLamports,premiumUsdcMicros:record.opening.quote.grossPremiumUsdcMicros,observedAt:record.bookingAt});feeFacts.push(...record.opening.quote.fees);}}
 const valid=(v:unknown):v is string=>typeof v==='string'&&/^\d{1,78}$/.test(v),sum=(key:keyof Pick<FillFact,'quantityLamports'|'premiumUsdcMicros'>)=>fills.length&&fills.every(f=>valid(f[key]))?fills.reduce((n,f)=>n+BigInt(f[key]),0n).toString():null;
 const fee=(currency:string)=>{const rows=feeFacts.filter(f=>f.currency===currency);return rows.length&&rows.every(f=>valid(f.units))?rows.reduce((n,f)=>n+BigInt(f.units),0n).toString():null;};
 const recordedExecution={requestedLamports:valid(intent.review?.quantityLamports)?intent.review.quantityLamports:null,filledLamports:sum('quantityLamports'),premiumUsdcMicros:sum('premiumUsdcMicros'),fees:feeFacts.length?{solLamports:fee('SOL'),usdcMicros:fee('USDC')}:null,commitment,positions:recorded_positions as {id:string;state:string}[],observedAt:fills.map(f=>f.observedAt).filter(v=>typeof v==='string').sort().at(-1)??null};
 return {...intent,recordedExecution,verificationIssues:verification_issues,preparationState:preparation_state??null,canDecline:intent.mode==='live'&&!preparation_state&&!intent.external_order_id&&!unsafe_reservation&&['intent','quote_requested','quoted','review_required','awaiting_authorization'].includes(intent.state)};
}
export async function assertCurrentReviewBindings(tx:Tx,userId:string,review:Record<string,unknown>,account:{id:string;provider_id:string;external_account_id:string;read_authorization_ref:string|null}):Promise<void>{
 invariant(account.read_authorization_ref&&review.userId===userId&&review.accountId===account.id&&review.providerId===account.provider_id&&review.externalAccountId===account.external_account_id&&review.readCredentialHash===tokenHash(account.read_authorization_ref),'review_scope','Provider account, owner or credential revision changed; review again');
 invariant(!review.walletRequired||typeof review.walletAddress==='string','wallet_required','The provider requires a linked address');if(review.walletAddress)invariant(typeof review.walletAddress==='string'&&(await tx.query('SELECT id FROM wallet_links WHERE user_id=$1 AND address=$2 FOR SHARE',[userId,review.walletAddress])).rowCount===1,'wallet_changed','The reviewed wallet is no longer linked to this owner');
}
// Internal allocation record only. Snapshot comes from the server's provider reader, never HTTP.
// Creating this reservation is neither custody nor a provider/member trading authorization.
export async function reserveReviewedIntentInTx(tx:Tx,userId:string,first:{id:string;account_id:string;sleeve_id:string},expectedReviewHash:string,snapshot:AvailableAssetSnapshot){const id=first.id;
  const account=(await tx.query('SELECT * FROM provider_accounts WHERE id=$1 AND user_id=$2 FOR UPDATE',[first.account_id,userId])).rows[0];invariant(account&&!account.revoked_at&&account.read_authorization_ref,'read_access_changed','Verify current provider ownership and read authorization before allocating SOL');
  const sleeve=(await tx.query('SELECT s.*,r.schedule,r.mode AS round_mode FROM sleeves s JOIN rounds r ON r.id=s.round_id WHERE s.id=$1 AND s.user_id=$2 FOR SHARE OF s',[first.sleeve_id,userId])).rows[0];const intent=(await tx.query('SELECT * FROM order_intents WHERE id=$1 AND user_id=$2 FOR UPDATE',[id,userId])).rows[0];
  const review=intent.review,actualHash=review?createHash('sha256').update(canonicalJson(review)).digest('hex'):null;invariant(review&&actualHash===intent.review_hash&&actualHash===expectedReviewHash,'review_changed','The amount, quote or terms changed. Review the current bound order again');
  await assertCurrentReviewBindings(tx,userId,review,account);
  invariant(intent.account_id===account.id&&intent.sleeve_id===sleeve.id&&review.userId===userId&&review.accountId===account.id&&review.providerId===account.provider_id&&review.roundId===sleeve.round_id&&review.mode===intent.mode&&sleeve.account_id===account.id,'review_scope','Review must bind the exact owner, account, provider, round and amount');assertSameMode(sleeve.mode,intent.mode);assertSameMode(sleeve.round_mode,intent.mode);assertSameMode(intent.mode,snapshot.mode);
  if(intent.mode==='live')invariant(process.env.GW_LIVE_PREPARATION_ENABLED==='true'&&executionGate.releaseApproved&&executionGate.gate0Passed&&executionGate.providerId===account.provider_id&&providerReadGate.gate0Passed&&providerReadGate.approvedProviderId===account.provider_id&&account.verified_at&&sleeve.verification?.dataClass==='verified_provider','live_unavailable','Live preparation is disabled until approved provider, release and registered starting-holdings gates pass');
  const prior=(await tx.query('SELECT * FROM reservations WHERE intent_id=$1',[id])).rows[0];if(prior)return prior;
  const unresolved=(await tx.query("SELECT i.id FROM reconciliation_issues i JOIN order_intents o ON o.id=i.intent_id WHERE o.account_id=$1 AND o.mode=$2 AND NOT EXISTS(SELECT FROM reconciliation_resolutions r WHERE r.issue_id=i.id) LIMIT 1",[account.id,intent.mode])).rowCount;invariant(!unresolved,'reconciliation_required','Provider records contain an unresolved discrepancy. Reconcile the existing account before allocating more SOL');
  invariant(intent.state==='awaiting_authorization','review_required','The member must explicitly review this intent before its allocation can be prepared');const now=(await tx.query<{t:Date}>('SELECT clock_timestamp() t')).rows[0].t;
  invariant(review.quoteExpiresAt&&now.getTime()<Date.parse(review.quoteExpiresAt),'quote_expired','The reviewed quote expired. Request and review a fresh quote');
  if(intent.mode==='live')invariant(sleeve.schedule.voteClose&&sleeve.schedule.executionClose&&now.getTime()>=Date.parse(sleeve.schedule.voteClose)&&now.getTime()<Date.parse(sleeve.schedule.executionClose),'execution_closed','New opening preparation is outside the published execution window');
  const source=parseSource(snapshot.source);invariant(snapshot.accountId===account.id&&snapshot.userId===userId&&snapshot.providerId===account.provider_id,'balance_scope','Available assets must belong to this exact provider account');invariant(source.receivedAt<=now.toISOString()&&now.getTime()-Date.parse(source.observedAt)<=60000,'balance_stale','Available-asset snapshot is stale or not yet received');invariant(intent.mode==='simulation'||!source.synthetic,'synthetic_live','Synthetic holdings cannot reserve real assets');
  const quantity=BigInt(unitsSchema.parse(review.quantityLamports)),reserve=BigInt(unitsSchema.parse(review.feeReserveLamports));invariant(quantity>0n&&reserve>=BigInt(sleeve.reserve_lamports),'fee_reserve','Reserve the full declared uncovered SOL fee amount');
  const active=(await tx.query<Commitment&{sleeveId:string}>('SELECT r.covered_lamports AS "coveredLamports",r.fee_reserve_lamports AS "feeReserveLamports",r.state,r.provider_ref AS "providerRef",i.sleeve_id AS "sleeveId" FROM reservations r JOIN order_intents i ON i.id=r.intent_id WHERE r.account_id=$1 AND r.mode=$2 AND r.state<>\'released\' ORDER BY r.id',[account.id,intent.mode])).rows;
  const available=BigInt(availableAfterCommitments(snapshot.unencumberedLamports,active,snapshot.reflectedCommitments));invariant(quantity+reserve<=available,'insufficient_available','Another pending, filled, partial or Unknown commitment uses this allocation. Reconcile before preparing another order');
  const localUsed=active.filter(r=>r.sleeveId===sleeve.id).reduce((n,r)=>n+BigInt(r.coveredLamports)+BigInt(r.feeReserveLamports),0n);invariant(localUsed+quantity+reserve<=BigInt(sleeve.allocation_lamports),'sleeve_overcommitted','These reviewed intents exceed the registered weekly sleeve');
  return (await tx.query('INSERT INTO reservations(intent_id,account_id,mode,covered_lamports,fee_reserve_lamports,state) VALUES($1,$2,$3,$4,$5,\'reserved\') RETURNING *',[id,account.id,intent.mode,quantity.toString(),reserve.toString()])).rows[0];

}
export async function reserveReviewedIntent(db:Pool,userId:string,id:string,expectedReviewHash:string,snapshot:AvailableAssetSnapshot){const first=await readOwnIntent(db,userId,id);return inGuild(db,userId,first.guild_id,tx=>reserveReviewedIntentInTx(tx,userId,first,expectedReviewHash,snapshot));}
