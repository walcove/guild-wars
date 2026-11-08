import {z} from 'zod';
import {invariant} from '../../domain/errors';
import {parseContractTerms,parseSource,parseUtc,idSchema,modeSchema,quoteKindSchema,unitsSchema,assertSameMode,type TradingMode} from '../../domain/types';
import type {OptionQuote,SizePolicy} from './contracts';
const quoteSchema=z.object({id:idSchema,mode:modeSchema,kind:quoteKindSchema,terms:z.unknown(),coveredLamports:unitsSchema,grossPremiumUsdcMicros:unitsSchema,fees:z.array(z.object({currency:z.enum(['SOL','USDC']),units:unitsSchema}).strict()).min(1).max(10),validUntil:z.string(),source:z.unknown()}).strict();
export function assertEligibleQuote(input:OptionQuote,context:{providerId:string;mode:TradingMode;instrumentId:string;now:string;ranked:boolean;size:SizePolicy}):OptionQuote {
 const parsed=quoteSchema.parse(input);const quote:OptionQuote={...parsed,terms:parseContractTerms(parsed.terms),source:parseSource(parsed.source)};
 invariant(!(quote.source.synthetic&&quote.kind==='executable'),'not_executable','Synthetic data cannot claim to be an executable quote');
 parseUtc(context.now);parseUtc(quote.validUntil);assertSameMode(context.mode,quote.mode);
 invariant(quote.terms.providerId===context.providerId,'provider_mismatch','Quote provider does not match the server-owned round provider');
 invariant(quote.terms.instrumentId===context.instrumentId,'instrument','Quote instrument does not match this plan');
 invariant(quote.validUntil>context.now&&quote.terms.expiresAt>context.now&&quote.source.observedAt<=context.now,'quote_expired','Quote is expired or not yet observable');
 const quantity=BigInt(quote.coveredLamports),minimum=BigInt(unitsSchema.parse(context.size.minimumLamports)),increment=BigInt(unitsSchema.parse(context.size.incrementLamports));
 invariant(quantity>0n&&minimum>0n&&increment>0n&&quantity>=minimum&&(quantity-minimum)%increment===0n,'unsupported_size','Amount must match the exact provider minimum/increment');
 if(context.mode==='live') invariant(quote.kind==='executable'&&!quote.source.synthetic,'not_executable','A live order needs an authoritative executable quote');
 if(context.ranked) {
  invariant(!quote.source.synthetic&&['historical','executable'].includes(quote.kind),'teaching_only','Synthetic or indicative inputs are teaching-only');
  invariant(Date.parse(context.now)-Date.parse(quote.source.observedAt)<=60000,'stale_snapshot','Ranked opening snapshot is older than 60 seconds');
 }
 if(context.ranked||context.mode==='live') {
  invariant(context.size.capacityLamports!==null,'unknown_capacity','Size/depth is unavailable; teaching-only');
  invariant(quantity<=BigInt(unitsSchema.parse(context.size.capacityLamports)),'capacity','Insufficient verified capacity');
 }
 return quote;
}
