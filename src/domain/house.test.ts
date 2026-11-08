import {expect,it} from 'vitest';
import {chooseHouse,type HouseInput} from './house';
import type {OptionQuote} from '../server/providers/contracts';
const cutoff='2026-11-08T00:00:30.000Z',source={sourceId:'synthetic-classifier-fixture',observedAt:'2026-11-08T00:00:00.000Z',receivedAt:'2026-11-08T00:00:01.000Z',synthetic:false};
function quote(strike:string,id:string):OptionQuote{return {id,mode:'simulation',kind:'historical',terms:{underlying:'SOL',settlementCurrency:'USDC',strike:{amount:strike,denomination:'USD',per:'SOL'},expiresAt:'2026-11-14T08:00:00.000Z',settlement:'physical',custody:'protocol_escrow',location:'solana',instrumentId:id,providerId:'synthetic'},coveredLamports:'1000000000',grossPremiumUsdcMicros:'2000000',fees:[{currency:'USDC',units:'100000'}],validUntil:'2026-11-08T00:01:00.000Z',source};}
const input:HouseInput={policyVersion:'highest-strike-v1',mode:'simulation',providerId:'synthetic',expiresAt:'2026-11-14T08:00:00.000Z',referenceLamports:'1000000000',cutoff,spot:{usdPerSol:'100',source},usdPerUsdc:null,fxSource:null,limits:{minimumNetPremiumUsdcMicrosPerSol:'1000000',maximumFees:[{currency:'USDC',units:'100000'}]},candidates:[{quote:quote('110','a'),size:{minimumLamports:'1000000000',incrementLamports:'1000000000',capacityLamports:'1000000000'}},{quote:quote('115','b'),size:{minimumLamports:'1000000000',incrementLamports:'1000000000',capacityLamports:'1000000000'}}]};
// Provenance classifier toggles below exercise policy only; all records are original synthetic fixtures, never provider evidence.
it('selects the highest qualifying strike above spot with deterministic tie handling',()=>{
 expect(chooseHouse(input)).toMatchObject({kind:'call',instrumentId:'b',policyVersion:'highest-strike-v1'});
 expect(chooseHouse({...input,candidates:[...input.candidates].reverse()})).toEqual(chooseHouse(input));
 expect(chooseHouse({...input,candidates:input.candidates.map(c=>({...c,quote:{...c.quote,terms:{...c.quote.terms,strike:{amount:'99',denomination:'USD',per:'SOL'}}}}))})).toMatchObject({kind:'hold'});
});
it.each([{spot:null},{limits:null},{candidates:[]},{cutoff:'2026-11-08T00:01:01.000Z'},{spot:{usdPerSol:'100',source:{...source,synthetic:true}}}])('keeps holding with missing/stale/synthetic decision inputs %j',change=>expect(chooseHouse({...input,...change})).toMatchObject({kind:'hold'}));
it('rejects unavailable capacity, unsupported minimums and insufficient net premium',()=>{
 for(const transform of [(c:HouseInput['candidates'][number])=>({...c,size:{...c.size,capacityLamports:null}}),(c:HouseInput['candidates'][number])=>({...c,size:{...c.size,minimumLamports:'2000000000'}}),(c:HouseInput['candidates'][number])=>({...c,quote:{...c.quote,grossPremiumUsdcMicros:'500000'}})])expect(chooseHouse({...input,candidates:input.candidates.map(transform)})).toMatchObject({kind:'hold'});
});
it('requires observed FX for USDC strikes and native fee conversion rather than assuming a peg',()=>{
 const candidates=input.candidates.map(c=>({...c,quote:{...c.quote,terms:{...c.quote.terms,strike:{...c.quote.terms.strike,denomination:'USDC' as const}},fees:[{currency:'SOL' as const,units:'1000000'}]}}));
 expect(chooseHouse({...input,candidates})).toMatchObject({kind:'hold'});
 expect(chooseHouse({...input,candidates,limits:{minimumNetPremiumUsdcMicrosPerSol:'1000000',maximumFees:[{currency:'SOL',units:'1000000'}]},fxSource:source,usdPerUsdc:{amount:'0.98',pair:'USD/USDC',observedAt:source.observedAt,sourceId:'synthetic-fx',rounding:'half_away'}})).toMatchObject({kind:'call',instrumentId:'b'});
});
it('uses declared code-unit ordering for equal strikes, independent of the server locale',()=>{
 const a=input.candidates[0];expect(chooseHouse({...input,candidates:[{...a,quote:quote('110','a')},{...a,quote:quote('110','A')}]})).toMatchObject({instrumentId:'A'});
});
