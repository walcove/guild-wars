import type {SourceStamp} from '../../domain/types';
export interface ProviderReadRequest {userId:string;providerId:string;externalAccountId:string;readAuthorizationRef:string;allocationLamports:string;reserveLamports:string}
export type ProviderReadEvidence={status:'unavailable';reason:string}|{status:'fixture'|'verified';userId:string;providerId:string;externalAccountId:string;readAuthorizationRef:string;canonicalAllocationRef:string;ownershipVerified:boolean;segregatedSleeve:boolean;availableLamports:string;investmentCashUsdcMicros:string;minimumLamports:string;incrementLamports:string;requiredReserveLamports:string;source:SourceStamp;recordReference:string};
// Internal adapter contract, not an invented external API. Only the approved Task 20 adapter can supply verified evidence.
export interface ProviderReadVerifier {read:(request:ProviderReadRequest)=>Promise<ProviderReadEvidence>}
export const providerReadGate:{approvedProviderId:string|null;gate0Passed:boolean}={approvedProviderId:null,gate0Passed:false};
export const unavailableReadVerifier:ProviderReadVerifier={read:async()=>({status:'unavailable',reason:'No provider has passed permissions, custody, ownership/balance, data-rights and settlement validation'})};
