import type {ContractTerms,SourceStamp,TradingMode,QuoteKind} from '../../domain/types';
export interface OptionQuote {id:string;mode:TradingMode;kind:QuoteKind;terms:ContractTerms;coveredLamports:string;grossPremiumUsdcMicros:string;fees:Array<{currency:'SOL'|'USDC';units:string}>;validUntil:string;source:SourceStamp}
interface EventBase {mode:TradingMode;providerId:string;accountId:string;externalEventId:string;observedAt:string;receivedAt:string;revision:string;source:SourceStamp}
export type VerifiedExecutionEvent=EventBase & (
 | {kind:'order';externalOrderId:string;state:'submitted'|'pending_confirmation'|'rejected'|'cancelled'|'unknown'}
 | {kind:'fill';externalOrderId:string;externalFillId:string;instrumentId:string;quantityLamports:string;premiumUsdcMicros:string;filledAt:string|null;fingerprint:string}
 | {kind:'position';externalPositionId:string;instrumentId:string;coveredLamports:string;state:'open'|'expired'|'settlement_pending'|'settled'}
 | {kind:'fee';currency:'SOL'|'USDC';units:string;externalFillId:string}
 | {kind:'settlement';externalPositionId:string;assetDeltaLamports:string;cashDeltaUsdcMicros:string;state:'pending'|'claimable'|'settled'|'withdrawn'}
);
export interface ExecutionAdapter {readonly mode:TradingMode;listInstruments(roundId:string):Promise<ContractTerms[]>;quote(intentId:string):Promise<OptionQuote>;reconcile(externalReference:string):Promise<VerifiedExecutionEvent[]>}
export interface SimulationAdapter extends ExecutionAdapter {readonly mode:'simulation';bookVirtual(intentId:string):Promise<VerifiedExecutionEvent[]>}
export interface LiveAdapter extends ExecutionAdapter {readonly mode:'live';prepareMemberAuthorization(intentId:string,reviewHash:string):Promise<{kind:'hosted'|'wallet';reference:string}>}
export interface SizePolicy {minimumLamports:string;incrementLamports:string;capacityLamports:string|null}
