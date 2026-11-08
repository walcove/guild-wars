import { invariant } from './errors';
import { parseUtc, parseId, decimalSchema } from './types';
export const SOL_SCALE=9;
export const USDC_SCALE=6;
export type Rounding = 'half_away' | 'floor' | 'toward_zero';
export type Fraction = Readonly<{ numerator: bigint; denominator: bigint }>;
const abs=(n:bigint)=>n<0n?-n:n;
function gcd(a:bigint,b:bigint):bigint { while(b!==0n) [a,b]=[b,a%b]; return a; }
export function fraction(numerator:bigint,denominator=1n):Fraction {
 invariant(denominator!==0n,'zero_denominator','A financial denominator cannot be zero');
 if(denominator<0n) { numerator=-numerator; denominator=-denominator; }
 const divisor=gcd(abs(numerator),denominator); return {numerator:numerator/divisor,denominator:denominator/divisor};
}
export function add(a:Fraction,b:Fraction):Fraction { return fraction(a.numerator*b.denominator+b.numerator*a.denominator,a.denominator*b.denominator); }
export function multiply(a:Fraction,b:Fraction):Fraction { return fraction(a.numerator*b.numerator,a.denominator*b.denominator); }
export function negate(a:Fraction):Fraction { return fraction(-a.numerator,a.denominator); }
export function compare(a:Fraction,b:Fraction):number { const n=a.numerator*b.denominator-b.numerator*a.denominator; return n<0n?-1:n>0n?1:0; }
export function round(a:Fraction,policy:Rounding):bigint {
 invariant(['half_away','floor','toward_zero'].includes(policy),'rounding','Unknown rounding policy');
 const value=fraction(a.numerator,a.denominator);const q=value.numerator/value.denominator;const rem=value.numerator%value.denominator;
 if(policy==='floor' && rem<0n) return q-1n;
 if(policy==='half_away' && abs(rem)*2n>=value.denominator) return q+(value.numerator<0n?-1n:1n);
 return q;
}
export function parseUnits(value:string,scale:number):bigint {
 invariant(Number.isInteger(scale) && scale>=0 && scale<=18,'precision','Unsupported unit scale');
 invariant(typeof value==='string' && value.length<=80 && /^(0|[1-9]\d*)(\.\d+)?$/.test(value),'amount','Use a nonnegative plain decimal amount');
 const [whole,part='']=value.split('.');invariant(part.length<=scale,'precision','Too many fractional digits');
 return BigInt(whole)*10n**BigInt(scale)+BigInt(part.padEnd(scale,'0')||'0');
}
export function formatUnits(units:bigint,scale:number):string {
 invariant(Number.isInteger(scale) && scale>=0 && scale<=18,'precision','Unsupported unit scale');
 const sign=units<0n?'-':'';const factor=10n**BigInt(scale);const part=(abs(units)%factor).toString().padStart(scale,'0').replace(/0+$/,'');
 return sign+(abs(units)/factor).toString()+(part?'.'+part:'');
}
export function decimal(value:string):Fraction { decimalSchema.parse(value);const [whole,part='']=value.split('.');return fraction(BigInt(whole+part),10n**BigInt(part.length)); }
export interface FxObservation { amount:string; pair:'USD/USDC'; observedAt:string; sourceId:string; rounding:Rounding }
export function convertUsdcToUsd(micros:bigint,fx:FxObservation|null):{status:'unpriced';reason:string}|{status:'priced';value:Fraction;conversion:FxObservation} {
 if(!fx) return {status:'unpriced',reason:'USDC/USD conversion unavailable'};
 invariant(fx.pair==='USD/USDC','fx_pair','Expected USD per USDC');parseUtc(fx.observedAt);parseId(fx.sourceId);
 const rate=decimal(fx.amount);invariant(rate.numerator>0n,'fx_rate','FX must be positive');
 invariant(['half_away','floor','toward_zero'].includes(fx.rounding),'rounding','Unknown conversion rounding');
 return {status:'priced',value:multiply(fraction(micros,1000000n),rate),conversion:fx};
}
export function serializeFraction(value:Fraction):{numerator:string;denominator:string} { return {numerator:value.numerator.toString(),denominator:value.denominator.toString()}; }
