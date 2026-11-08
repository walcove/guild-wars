import {z} from 'zod';
import {invariant} from '../../../domain/errors';
import {unitsSchema,parseUtc,type SourceStamp} from '../../../domain/types';
import {assertEligibleQuote} from '../quote-policy';
import type {OptionQuote,SizePolicy} from '../contracts';
export interface SimulationOpening {policyVersion:'virtual-covered-call-v1';bookingAt:string;dataClass:'teaching_only'|'verified';allocationLamports:string;reserveLamports:string;size:SizePolicy;quote:OptionQuote;settlementPolicy:{priceSourceId:string;fxSourceId:string|null;exercise:'strictly_above';rounding:'floor';fees:{currency:'SOL'|'USDC';units:string}[]}}
export interface SimulationTerminal {price:string;denomination:'USD'|'USDC';source:SourceStamp;usdPerUsdc:string|null;fxSource:SourceStamp|null}
const fee=z.object({currency:z.enum(['SOL','USDC']),units:unitsSchema}).strict();
export function virtualFill(input:SimulationOpening){
 invariant(input.policyVersion==='virtual-covered-call-v1','simulation_policy','Unsupported frozen fill policy');parseUtc(input.bookingAt);invariant(['verified','teaching_only'].includes(input.dataClass),'data_class','Unknown simulation data class');
 const policy=z.object({priceSourceId:z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),fxSourceId:z.string().regex(/^[A-Za-z0-9_-]{1,128}$/).nullable(),exercise:z.literal('strictly_above'),rounding:z.literal('floor'),fees:z.array(fee).max(10)}).strict().parse(input.settlementPolicy);
 const total=BigInt(unitsSchema.parse(input.allocationLamports)),reserve=BigInt(unitsSchema.parse(input.reserveLamports));invariant(total===10000000000n&&reserve>0n&&reserve<total,'allocation','Virtual weekly allocation must be 10 SOL including a declared reserve');invariant(BigInt(input.quote.coveredLamports)===total-reserve,'reference_coverage','Coverage must exclude the entire fixed fee reserve');
 const quote=assertEligibleQuote(input.quote,{providerId:input.quote.terms.providerId,mode:'simulation',instrumentId:input.quote.terms.instrumentId,now:input.bookingAt,ranked:input.dataClass==='verified',size:input.size});
 invariant(quote.source.receivedAt<=input.bookingAt&&Date.parse(input.bookingAt)-Date.parse(quote.source.observedAt)<=60000,'stale_snapshot','Opening snapshot must be observed and ingested within 60 seconds before the fixed booking timestamp');
 invariant(quote.terms.settlement==='physical','unsupported_settlement','This frozen policy supports documented physical delivery only');
 invariant(input.size.capacityLamports!==null&&BigInt(unitsSchema.parse(input.size.capacityLamports))>=BigInt(quote.coveredLamports),'capacity','Known sufficient capacity is required for a virtual fill; absent depth is unranked teaching data');
 if(input.dataClass==='teaching_only')invariant(quote.source.synthetic,'source_class','Teaching fixtures require explicit synthetic provenance');
 const sum=(fees:typeof quote.fees,currency:'SOL'|'USDC')=>fees.filter(f=>f.currency===currency).reduce((n,f)=>n+BigInt(f.units),0n),solFee=sum(quote.fees,'SOL'),usdcFee=sum(quote.fees,'USDC');
 invariant(solFee+sum(policy.fees,'SOL')<=reserve,'fee_reserve','Opening and settlement SOL fees exceed the fixed uncovered reserve');invariant(usdcFee+sum(policy.fees,'USDC')<=BigInt(quote.grossPremiumUsdcMicros),'cash_required','The virtual sleeve cannot assume additional investment cash to pay fees');
 return {coveredLamports:quote.coveredLamports,cashDeltaUsdcMicros:(BigInt(quote.grossPremiumUsdcMicros)-usdcFee).toString(),assetDeltaLamports:(-solFee).toString(),liabilityDeltaUsdcMicros:quote.grossPremiumUsdcMicros,solFee:solFee.toString(),usdcFee:usdcFee.toString(),quote,settlementPolicy:policy};
}
