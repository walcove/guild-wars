import {expect,it} from 'vitest';
import {assertEligibleQuote} from '../server/providers/quote-policy';
import type {OptionQuote} from '../server/providers/contracts';
const quote:OptionQuote={id:'synthetic-quote',mode:'simulation',kind:'historical',terms:{underlying:'SOL',settlementCurrency:'USDC',strike:{amount:'110',denomination:'USD',per:'SOL'},expiresAt:'2026-11-14T08:00:00.000Z',settlement:'physical',custody:'protocol_escrow',location:'solana',instrumentId:'call',providerId:'synthetic'},coveredLamports:'1000000000',grossPremiumUsdcMicros:'2000000',fees:[{currency:'USDC',units:'100000'}],validUntil:'2026-11-07T12:01:00.000Z',source:{sourceId:'fixture',observedAt:'2026-11-07T12:00:00.000Z',receivedAt:'2026-11-07T12:00:00.000Z',synthetic:false}};
// Constructed synthetic classifier boundary; no provider record, permission or ranked fill is asserted.
const context={providerId:'synthetic',mode:'simulation' as const,instrumentId:'call',now:'2026-11-07T12:00:30.000Z',ranked:true,size:{minimumLamports:'1000000000',incrementLamports:'1000000000',capacityLamports:'10000000000'}};
it('requires real provenance, exact size and the shorter snapshot/provider TTL',()=>{
 expect(assertEligibleQuote(quote,context)).toEqual(quote);
 for(const change of [{validUntil:context.now},{source:{...quote.source,observedAt:'2026-11-07T11:59:00.000Z'}},{coveredLamports:'1000000001'},{source:{...quote.source,synthetic:true}},{fees:[{currency:'ETH',units:'1'}]}]) expect(()=>assertEligibleQuote({...quote,...change} as OptionQuote,context)).toThrow();
 expect(()=>assertEligibleQuote(quote,{...context,size:{...context.size,capacityLamports:null}})).toThrow();
});
it('cannot relabel a model or a synthetic quote as executable live',()=>{
 expect(()=>assertEligibleQuote({...quote,mode:'live',kind:'model'},{...context,mode:'live'})).toThrow();
 expect(()=>assertEligibleQuote({...quote,mode:'live',kind:'executable',source:{...quote.source,synthetic:true}},{...context,mode:'live'})).toThrow();
 expect(()=>assertEligibleQuote(quote,{...context,mode:'live'})).toThrow();
});
it('permits clearly synthetic teaching data only outside ranked/live execution',()=>expect(assertEligibleQuote({...quote,kind:'model',source:{...quote.source,synthetic:true}},{...context,ranked:false,size:{...context.size,capacityLamports:null}})).toMatchObject({kind:'model'}));

it('rejects another provider even when the instrument identifier matches',()=>expect(()=>assertEligibleQuote({...quote,terms:{...quote.terms,providerId:'other-provider'}},context)).toThrow(/provider/i));
it('requires explicit known fees and never accepts a synthetic executable claim',()=>{
 expect(()=>assertEligibleQuote({...quote,fees:[]},context)).toThrow();
 expect(()=>assertEligibleQuote({...quote,kind:'executable',source:{...quote.source,synthetic:true}},{...context,ranked:false})).toThrow();
});
