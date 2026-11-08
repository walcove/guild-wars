import {z} from 'zod';
import {invariant} from './errors';
import {sourceUrl} from './source-url';
import {unitsSchema,parseContractTerms,parseSource,parseUtc,type ContractTerms,type TradingMode,type SourceStamp} from './types';
import type {OptionQuote} from '../server/providers/contracts';
import {assertEligibleQuote} from '../server/providers/quote-policy';
export interface PlanContext {guildId:string;roundId:string;mode:TradingMode;dataClass:'teaching_only'|'verified';terms:ContractTerms;allocationLamports:string;reserveLamports:string;referenceLamports:string;minimumLamports:string|null;incrementLamports:string|null;capacityLamports:string|null;quote:OptionQuote|null;acceptance:{minimumNetPremiumUsdcMicrosPerSol:string;maxFees:{currency:'SOL'|'USDC';units:string}[]};source:SourceStamp}
const words=z.string().trim().min(5).max(1500).refine(v=>!v.includes('\0'));
export const proposalDraftSchema=z.object({selection:z.string().min(1).max(128),why:words,mainRisk:words,sourceUrl:z.string().max(2048),changeOfView:words}).strict();
export type ProposalDraft=z.infer<typeof proposalDraftSchema>;
export interface ProposalContent extends PlanContext {schemaVersion:1;comparisonLamports:'1000000000';research:ProposalDraft}
export function validateProposal(input:unknown,context:PlanContext,now:string):ProposalContent {
 const draft=proposalDraftSchema.parse(input),terms=parseContractTerms(context.terms),source=parseSource(context.source);parseUtc(now);
 invariant(draft.selection===terms.instrumentId,'instrument','Choose a currently eligible strike from this round');
 const allocation=BigInt(unitsSchema.parse(context.allocationLamports)),reserve=BigInt(unitsSchema.parse(context.reserveLamports)),reference=BigInt(unitsSchema.parse(context.referenceLamports));
 invariant(allocation>reserve&&reserve>=0n&&reference===allocation-reserve,'reference_coverage','Core coverage must equal the fixed reference SOL allocation excluding its fee reserve');
 invariant(terms.expiresAt>now,'instrument_expired','The selected contract has expired');
 invariant(source.observedAt<=now,'source_time','Source snapshot is not yet observable');
 invariant(context.mode!=='live'||(!source.synthetic&&context.dataClass==='verified'),'synthetic_live','A synthetic assumption cannot become a live proposal');
 invariant(context.dataClass==='teaching_only'||!source.synthetic,'source_class','Verified proposals need authoritative provenance');
 const acceptance=z.object({minimumNetPremiumUsdcMicrosPerSol:unitsSchema,maxFees:z.array(z.object({currency:z.enum(['SOL','USDC']),units:unitsSchema}).strict()).min(1).max(4)}).strict().parse(context.acceptance);
 if(context.quote) {
  invariant(canonicalJson(context.quote.terms)===canonicalJson(terms)&&context.quote.coveredLamports===reference.toString()&&canonicalJson(context.quote.source)===canonicalJson(source),'quote_terms','The quote must match the exact contract, reference coverage and source');
  invariant(context.minimumLamports&&context.incrementLamports,'size_unavailable','Verified provider minimum and size increment are required');
  assertEligibleQuote(context.quote,{providerId:terms.providerId,mode:context.mode,instrumentId:terms.instrumentId,now,ranked:false,size:{minimumLamports:context.minimumLamports,incrementLamports:context.incrementLamports,capacityLamports:context.capacityLamports}});
 } else invariant(context.dataClass==='teaching_only'&&context.mode==='simulation'&&source.synthetic,'quote_unavailable','A verified plan needs its current source quote');
 return {...context,terms,source,acceptance,schemaVersion:1,comparisonLamports:'1000000000',research:{...draft,sourceUrl:sourceUrl(draft.sourceUrl)}};
}
export function canonicalJson(value:unknown):string {
 function sorted(v:unknown):unknown {
  if(v===null||typeof v==='boolean'||typeof v==='string')return v;
  if(typeof v==='number'){invariant(Number.isFinite(v),'canonical_json','Only finite JSON numbers are allowed');return v;}
  if(Array.isArray(v))return v.map(sorted);
  invariant(typeof v==='object'&&v!==null&&Object.getPrototypeOf(v)===Object.prototype,'canonical_json','Only plain JSON data can be hashed');return Object.fromEntries(Object.keys(v).sort().map(key=>[key,sorted((v as Record<string,unknown>)[key])]));
 }
 return JSON.stringify(sorted(value));
}
