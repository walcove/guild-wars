import {invariant} from './errors';
import {add,compare,convertUsdcToUsd,decimal,fraction,multiply,negate,type Fraction,type FxObservation} from './money';
export type OutcomeFee={currency:'USDC';units:bigint;fx:FxObservation|null}|{currency:'SOL';units:bigint;usdPerSol:string};
export interface DeliveredInput {quantityLamports:bigint;entryUsdPerSol:string;terminalUsdPerSol:string;strike:{amount:string;denomination:'USD'|'USDC'};settlement:'physical'|'cash';grossPremiumUsdcMicros:bigint;premiumFx:FxObservation|null;settlementFx:FxObservation|null;fees:readonly OutcomeFee[]}
export type Outcome={status:'unpriced';reason:string}|{status:'priced';covered:Fraction;holding:Fraction;premium:Fraction;fees:Fraction;currency:'USD'};
export function coveredCallUsd(input:DeliveredInput):Outcome {
 invariant(input.settlement==='physical','unsupported_settlement','Unsupported settlement: cash contracts require verified contract-specific payoff rules');
 invariant(input.quantityLamports>0n&&input.grossPremiumUsdcMicros>=0n,'quantity','Covered quantity must be positive and premium nonnegative');
 const entry=decimal(input.entryUsdPerSol),terminal=decimal(input.terminalUsdPerSol),quantity=fraction(input.quantityLamports,1000000000n);
 let strike=decimal(input.strike.amount);invariant(strike.numerator>0n,'strike','Strike must be positive');
 invariant(['USD','USDC'].includes(input.strike.denomination),'currency','Unsupported strike denomination');
 if(input.strike.denomination==='USDC') {
  if(!input.settlementFx)return {status:'unpriced',reason:'Strike USDC/USD conversion unavailable'};
  // Convert one USDC to USD without rounding the strike to token micro-units.
  const unit=convertUsdcToUsd(1000000n,input.settlementFx);if(unit.status==='unpriced')return unit;strike=multiply(strike,unit.value);
 }
 const premium=convertUsdcToUsd(input.grossPremiumUsdcMicros,input.premiumFx);if(premium.status==='unpriced')return premium;
 let fees=fraction(0n);
 for(const fee of input.fees) {
  invariant(fee.units>=0n,'fee','Fees cannot be negative');
  if(fee.currency==='USDC') {const converted=convertUsdcToUsd(fee.units,fee.fx);if(converted.status==='unpriced')return converted;fees=add(fees,converted.value);}
  else {invariant(fee.currency==='SOL','fee_currency','Unsupported fee currency');fees=add(fees,multiply(fraction(fee.units,1000000000n),decimal(fee.usdPerSol)));}
 }
 const capped=compare(terminal,strike)<0?terminal:strike;
 return {status:'priced',covered:add(add(multiply(quantity,add(capped,negate(entry))),premium.value),negate(fees)),holding:multiply(quantity,add(terminal,negate(entry))),premium:premium.value,fees,currency:'USD'};
}
