import { describe, expect, it } from 'vitest';
import { parseUnits, formatUnits, fraction, multiply, round, convertUsdcToUsd } from './money';
describe('exact financial units', () => {
 it('preserves one lamport and micro USDC with a JSON string boundary', () => {
  expect(parseUnits('0.000000001',9)).toBe(1n);
  expect(formatUnits(1900000n,6)).toBe('1.9');
  expect(JSON.stringify({units:parseUnits('1.9',6).toString()})).toBe('{"units":"1900000"}');
 });
 it.each(['-1','NaN','Infinity','1e3','0.0000000001',' 1','1.','01',''])('rejects invalid SOL units %s', v => expect(() => parseUnits(v,9)).toThrow());
 it('keeps sub-cent fractions and declares negative rounding', () => {
  const tiny=multiply(fraction(1n,1000000000n),fraction(999999n,1000000n));
  expect(tiny).toEqual(fraction(999999n,1000000000000000n));
  expect(round(fraction(-15n,10n),'half_away')).toBe(-2n);
  expect(round(fraction(-11n,10n),'floor')).toBe(-2n);
  expect(round(fraction(-11n,10n),'toward_zero')).toBe(-1n);
 });
 it('never assumes USDC equals USD', () => {
  expect(convertUsdcToUsd(1900000n,null)).toEqual({status:'unpriced',reason:'USDC/USD conversion unavailable'});
  const result=convertUsdcToUsd(1900000n,{amount:'0.98',pair:'USD/USDC',observedAt:'2026-11-07T12:00:00.000Z',sourceId:'synthetic-fx',rounding:'half_away'});
  expect(result).toMatchObject({status:'priced',value:fraction(1862n,1000n)});
 });
});
