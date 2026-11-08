import {expect,it} from 'vitest';
import {projectLedger} from './ledger';
import type {LedgerEvent} from './ledger';
const events:LedgerEvent[]=[{id:'initial',kind:'funding',assetDeltaLamports:'1000000000',cashDeltaUsdcMicros:'0',liabilityDeltaUsdcMicros:'0'}, {id:'premium',kind:'fill',assetDeltaLamports:'0',cashDeltaUsdcMicros:'2000000',liabilityDeltaUsdcMicros:'2000000'}, {id:'assignment',kind:'settlement',assetDeltaLamports:'-1000000000',cashDeltaUsdcMicros:'110000000',liabilityDeltaUsdcMicros:'-2000000'}];
it('removes delivered SOL and books sale proceeds once, without counting cash plus sold SOL',()=>{
 expect(projectLedger([...events,events[2]])).toMatchObject({assetLamports:0n,cashUsdcMicros:112000000n,liabilityUsdcMicros:0n});
});
it('rejects changed duplicate events and negative inventory rather than silently accepting corrections',()=>{
 expect(()=>projectLedger([...events,{...events[2],cashDeltaUsdcMicros:'120000000'}])).toThrow(/correction|duplicate/i);
 expect(()=>projectLedger([events[2]])).toThrow(/negative/i);
});
it('applies explicit reversal/replacement events without erasing originals',()=>{
 const revised:LedgerEvent[]=[...events,{id:'reverse-assignment',kind:'correction',correctsId:'assignment',assetDeltaLamports:'1000000000',cashDeltaUsdcMicros:'-110000000',liabilityDeltaUsdcMicros:'2000000'},{...events[2],id:'amended-assignment',cashDeltaUsdcMicros:'109000000'}];
 expect(projectLedger(revised)).toMatchObject({assetLamports:0n,cashUsdcMicros:111000000n,liabilityUsdcMicros:0n});
});
