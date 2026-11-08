import { expect,it } from 'vitest';
import { parseContractTerms, assertSameMode, parseId, parseUtc, parseSource } from './types';
const terms={underlying:'SOL',settlementCurrency:'USDC',strike:{amount:'110',denomination:'USD',per:'SOL'},expiresAt:'2026-11-14T08:00:00.000Z',settlement:'physical',custody:'protocol_escrow',location:'solana',instrumentId:'synthetic-call',providerId:'synthetic'};
it('validates supported terms and fixed season mode',()=>{
 expect(parseContractTerms(terms)).toEqual(terms);
 expect(()=>assertSameMode('simulation','live')).toThrow(/mode/i);
 expect(()=>parseContractTerms({...terms,underlying:'ETH'})).toThrow();
 expect(()=>parseContractTerms({...terms,strike:{...terms.strike,amount:'Infinity'}})).toThrow();
 expect(()=>parseContractTerms({...terms,strike:{...terms.strike,amount:'-10'}})).toThrow();
 expect(()=>parseContractTerms({...terms,settlementCurrency:'BTC'})).toThrow();
});
it('rejects unsafe IDs and noncanonical or impossible UTC instants',()=>{
 expect(parseId('round-1')).toBe('round-1');
 expect(()=>parseId('../other')).toThrow();
 for(const value of ['2026-02-30T00:00:00.000Z','2026-11-07','2026-11-07T00:00:00-05:00']) expect(()=>parseUtc(value)).toThrow();
 expect(()=>parseSource({sourceId:'x',observedAt:terms.expiresAt,receivedAt:terms.expiresAt,synthetic:'false'})).toThrow();
});
