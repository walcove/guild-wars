import {expect,it} from 'vitest';
import {coveredCallUsd} from './payoff';
import {fraction} from './money';
const fx={amount:'1',pair:'USD/USDC' as const,observedAt:'2026-11-07T12:00:00.000Z',sourceId:'synthetic-fx',rounding:'half_away' as const};
const input={quantityLamports:1000000000n,entryUsdPerSol:'100',terminalUsdPerSol:'100',strike:{amount:'110',denomination:'USD' as const},settlement:'physical' as const,grossPremiumUsdcMicros:2000000n,premiumFx:fx,settlementFx:fx,fees:[{currency:'USDC' as const,units:100000n,fx}]};
it.each([['0',-9810n,-10000n],['80',-1810n,-2000n],['100',190n,0n],['110',1190n,1000n],['130',1190n,3000n]])('independent 1 SOL delivered outcome at $%s', (terminal,covered,holding)=>{
 const result=coveredCallUsd({...input,terminalUsdPerSol:terminal});
 expect(result).toMatchObject({status:'priced',covered:fraction(covered,100n),holding:fraction(holding,100n)});
});
it('keeps fractional SOL, one-lamport and sub-cent results exact',()=>{
 expect(coveredCallUsd({...input,quantityLamports:1n,grossPremiumUsdcMicros:0n,fees:[],terminalUsdPerSol:'99.999999'})).toMatchObject({covered:fraction(-1n,1000000000000000n)});
 expect(coveredCallUsd({...input,quantityLamports:500000000n,grossPremiumUsdcMicros:1000000n,fees:[{currency:'USDC',units:50000n,fx}],terminalUsdPerSol:'80'})).toMatchObject({covered:fraction(-905n,100n)});
});
it('converts real currencies explicitly and never assumes a peg or omits native fees',()=>{
 expect(coveredCallUsd({...input,grossPremiumUsdcMicros:1900000n,premiumFx:{...fx,amount:'0.98'},fees:[]})).toMatchObject({covered:fraction(1862n,1000n)});
 expect(coveredCallUsd({...input,premiumFx:null})).toMatchObject({status:'unpriced'});
 expect(coveredCallUsd({...input,fees:[{currency:'SOL',units:1000000n,usdPerSol:'100'}]})).toMatchObject({covered:fraction(190n,100n)});
 expect(()=>coveredCallUsd({...input,settlement:'cash'})).toThrow(/settlement/);
 expect(()=>coveredCallUsd({...input,quantityLamports:-1n})).toThrow();
});
it('caps gains but does not floor falling-asset losses',()=>{
 const a=coveredCallUsd({...input,terminalUsdPerSol:'110'}),b=coveredCallUsd({...input,terminalUsdPerSol:'999999'});
 expect(a).toMatchObject({status:'priced'});if(a.status==='priced'&&b.status==='priced')expect(a.covered).toEqual(b.covered);
 expect(coveredCallUsd({...input,terminalUsdPerSol:'0'})).toMatchObject({covered:fraction(-981n,10n)});
});
