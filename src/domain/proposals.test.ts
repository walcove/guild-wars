import {expect,it} from 'vitest';
import {validateProposal,canonicalJson,type PlanContext} from './proposals';
const at='2026-11-08T00:00:00.000Z';
const context:PlanContext={guildId:'00000000-0000-4000-8000-000000000001',roundId:'00000000-0000-4000-8000-000000000002',mode:'simulation',dataClass:'teaching_only',terms:{underlying:'SOL',settlementCurrency:'USDC',strike:{amount:'110',denomination:'USD',per:'SOL'},expiresAt:'2026-11-14T08:00:00.000Z',settlement:'physical',custody:'protocol_escrow',location:'solana',instrumentId:'synthetic-call',providerId:'synthetic'},allocationLamports:'10000000000',reserveLamports:'10000000',referenceLamports:'9990000000',minimumLamports:null,incrementLamports:null,capacityLamports:null,quote:null,acceptance:{minimumNetPremiumUsdcMicrosPerSol:'0',maxFees:[{currency:'USDC',units:'1000000'}]},source:{sourceId:'synthetic-assumption',synthetic:true,observedAt:at,receivedAt:at}};
const draft={selection:'synthetic-call',why:'Synthetic thesis with evidence',mainRisk:'SOL may fall significantly',sourceUrl:'https://status.solana.com/',changeOfView:'Evidence of a network disruption'};
it('validates complete rationale and immutable full-reference terms without a personal size field',()=>{
 expect(validateProposal(draft,context,at)).toMatchObject({comparisonLamports:'1000000000',referenceLamports:'9990000000',dataClass:'teaching_only'});
 for(const change of [{why:''},{mainRisk:''},{sourceUrl:'javascript:alert(1)'},{changeOfView:''},{selection:'another-call'},{quantity:'1'}])expect(()=>validateProposal({...draft,...change},context,at)).toThrow();
 expect(()=>validateProposal(draft,{...context,mode:'live'},at)).toThrow(/synthetic|live|Live/);
});
it('rejects expired verified display quotes, wrong expiration, and noncanonical JSON differences',()=>{
 const terms=context.terms,source={...context.source,synthetic:false},quote={id:'fixture-quote',mode:'simulation' as const,kind:'historical' as const,terms,coveredLamports:'9990000000',grossPremiumUsdcMicros:'20000000',fees:[{currency:'USDC' as const,units:'1000000'}],validUntil:at,source};
 expect(()=>validateProposal(draft,{...context,dataClass:'verified',source,quote,minimumLamports:'1',incrementLamports:'1'},at)).toThrow(/expired/);
 expect(()=>validateProposal(draft,{...context,terms:{...terms,expiresAt:'bad'}},at)).toThrow();
 expect(canonicalJson({b:2,a:{z:'1',b:'2'}})).toBe(canonicalJson({a:{b:'2',z:'1'},b:2}));
});
