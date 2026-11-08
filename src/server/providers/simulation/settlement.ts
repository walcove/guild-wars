import {invariant} from '../../../domain/errors';
import {parseSource,decimalSchema} from '../../../domain/types';
import {decimal,compare,fraction,multiply,round} from '../../../domain/money';
import {virtualFill,type SimulationOpening,type SimulationTerminal} from './fill-policy';
export function virtualSettlement(opening:SimulationOpening,terminal:SimulationTerminal){
 const fill=virtualFill(opening),terms=fill.quote.terms,source=parseSource(terminal.source);decimalSchema.parse(terminal.price);
 invariant(source.sourceId===opening.settlementPolicy.priceSourceId&&source.observedAt===terms.expiresAt&&source.synthetic===fill.quote.source.synthetic,'settlement_source','Terminal source, contract expiration timestamp and data class must match the frozen settlement rule');invariant(terminal.denomination===terms.strike.denomination,'settlement_currency','Terminal price must use the contract strike denomination');
 const exercised=compare(decimal(terminal.price),decimal(terms.strike.amount))>0;let cash=0n;
 if(exercised){let proceeds=multiply(decimal(terms.strike.amount),fraction(BigInt(fill.coveredLamports),1000000000n));if(terms.strike.denomination==='USD'){
   invariant(terminal.usdPerUsdc&&terminal.fxSource&&opening.settlementPolicy.fxSourceId,'fx_unavailable','Observed settlement USD/USDC FX is required; no implicit peg');const fx=parseSource(terminal.fxSource);invariant(fx.sourceId===opening.settlementPolicy.fxSourceId&&fx.observedAt===terms.expiresAt&&fx.synthetic===source.synthetic,'fx_source','FX must match the frozen contract-specific source and timestamp');const rate=decimal(terminal.usdPerUsdc);invariant(rate.numerator>0n,'fx_rate','FX must be positive');proceeds=multiply(proceeds,fraction(rate.denominator,rate.numerator));
  }cash=round(multiply(proceeds,fraction(1000000n)),'floor');
 }
 const sum=(currency:'SOL'|'USDC')=>opening.settlementPolicy.fees.filter(f=>f.currency===currency).reduce((n,f)=>n+BigInt(f.units),0n);
 return {exercised,assetDeltaLamports:(-(exercised?BigInt(fill.coveredLamports):0n)-sum('SOL')).toString(),cashDeltaUsdcMicros:(cash-sum('USDC')).toString(),liabilityDeltaUsdcMicros:(-BigInt(fill.liabilityDeltaUsdcMicros)).toString(),deliveryCashUsdcMicros:cash.toString(),solFee:sum('SOL').toString(),usdcFee:sum('USDC').toString(),source};
}
