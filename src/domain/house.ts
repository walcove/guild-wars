import {parseSource,parseUtc,unitsSchema,type TradingMode,type SourceStamp} from './types';
import {decimal,fraction,add,multiply,negate,compare,convertUsdcToUsd} from './money';
import {assertEligibleQuote} from '../server/providers/quote-policy';
import type {FxObservation} from './money';
import type {OptionQuote,SizePolicy} from '../server/providers/contracts';
export interface HouseInput {policyVersion:'highest-strike-v1';mode:TradingMode;providerId:string;expiresAt:string;referenceLamports:string;cutoff:string;spot:{usdPerSol:string;source:SourceStamp}|null;usdPerUsdc:FxObservation|null;fxSource:SourceStamp|null;limits:{minimumNetPremiumUsdcMicrosPerSol:string;maximumFees:{currency:'SOL'|'USDC';units:string}[]}|null;candidates:{quote:OptionQuote;size:SizePolicy}[]}
export type HouseDecision={kind:'hold';reason:string;policyVersion:'highest-strike-v1'}|{kind:'call';instrumentId:string;quoteId:string;reason:string;policyVersion:'highest-strike-v1'};
export function chooseHouse(input:HouseInput):HouseDecision {
 const policyVersion='highest-strike-v1' as const,hold=(reason:string):HouseDecision=>({kind:'hold',reason,policyVersion});
 try {
  parseUtc(input.cutoff);parseUtc(input.expiresAt);const cutoff=Date.parse(input.cutoff),reference=BigInt(unitsSchema.parse(input.referenceLamports));
  if(input.policyVersion!==policyVersion||reference<=0n)return hold('The reference or policy is unavailable');
  if(!input.spot)return hold('No permitted current SOL reference is available');
  const spotSource=parseSource(input.spot.source),spot=decimal(input.spot.usdPerSol);
  const timely=(stamp:SourceStamp)=>!stamp.synthetic&&stamp.observedAt<=input.cutoff&&stamp.receivedAt<=input.cutoff&&cutoff-Date.parse(stamp.observedAt)<=60000;
  if(!timely(spotSource)||spot.numerator<=0n)return hold('The SOL reference is stale, synthetic or unverified');
  if(!input.limits)return hold('No predeclared premium and fee limits are available');
  const minimum=fraction(BigInt(unitsSchema.parse(input.limits.minimumNetPremiumUsdcMicrosPerSol))),caps=new Map<string,bigint>();
  for(const fee of input.limits.maximumFees)caps.set(fee.currency,(caps.get(fee.currency)??0n)+BigInt(unitsSchema.parse(fee.units)));
  let fx:ReturnType<typeof decimal>|null=null;
  if(input.usdPerUsdc&&input.fxSource&&timely(parseSource(input.fxSource))&&input.usdPerUsdc.observedAt<=input.cutoff&&cutoff-Date.parse(input.usdPerUsdc.observedAt)<=60000){const converted=convertUsdcToUsd(1000000n,input.usdPerUsdc);if(converted.status==='priced')fx=converted.value;}
  const eligible:{quote:OptionQuote;strike:ReturnType<typeof decimal>}[]=[];
  for(const candidate of input.candidates){try{
   const q=assertEligibleQuote(candidate.quote,{providerId:input.providerId,mode:input.mode,instrumentId:candidate.quote.terms.instrumentId,now:input.cutoff,ranked:true,size:candidate.size});
   if(q.coveredLamports!==reference.toString()||q.terms.expiresAt!==input.expiresAt||q.source.receivedAt>input.cutoff)continue;
   let strike=decimal(q.terms.strike.amount);if(q.terms.strike.denomination==='USDC'){if(!fx)continue;strike=multiply(strike,fx);}if(compare(strike,spot)<=0)continue;
   const fees=new Map<string,bigint>();for(const f of q.fees)fees.set(f.currency,(fees.get(f.currency)??0n)+BigInt(f.units));
   if([...fees].some(([currency,units])=>!caps.has(currency)||units>caps.get(currency)!))continue;
   let cost=fraction(fees.get('USDC')??0n);const native=fees.get('SOL')??0n;
   if(native>0n){if(!fx)continue;cost=add(cost,multiply(fraction(native,1000000000n),multiply(spot,fraction(1000000n*fx.denominator,fx.numerator))));}
   const netPerSol=multiply(add(fraction(BigInt(q.grossPremiumUsdcMicros)),negate(cost)),fraction(1000000000n,reference));if(compare(netPerSol,minimum)<0)continue;
   eligible.push({quote:q,strike});
  }catch{/* An ineligible or unsupported contract cannot make the paper House trade. */}}
  const lexical=(a:string,b:string)=>a<b?-1:a>b?1:0;
  eligible.sort((a,b)=>compare(b.strike,a.strike)||lexical(a.quote.terms.instrumentId,b.quote.terms.instrumentId)||lexical(a.quote.id,b.quote.id));
  const winner=eligible[0];return winner?{kind:'call',instrumentId:winner.quote.terms.instrumentId,quoteId:winner.quote.id,reason:'Highest eligible agreed sale price above the SOL reference, within the frozen premium/fee/capacity policy',policyVersion}:hold('No call meets the same source, size, premium, fee and capacity limits');
 }catch{return hold('Required source or policy inputs could not be verified');}
}
