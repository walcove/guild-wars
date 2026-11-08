import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,expect,it} from 'vitest';
import type {Pool} from 'pg';
import {testPool} from './helpers/database';
import {marketCache} from '../../src/server/market/cache';
import {normalizeHistory,MarketRateLimit} from '../../src/server/market/coingecko';
import type {MarketRights} from '../../src/server/market/source-policy';
let db:Pool;beforeAll(()=>{db=testPool();});afterAll(async()=>{await db.end();});
const rights:MarketRights={approved:true,reference:'synthetic-'+randomUUID(),tier:'pro',display:true,freshSeconds:60,staleSeconds:300,retentionSeconds:600,attribution:'CoinGecko',maxDays:90};
const at=new Date('2026-11-07T12:00:00.000Z'),history=normalizeHistory({prices:[[at.getTime(),100]]},at.toISOString());
it('coalesces public history refreshes across database callers and rejects private records at the shared boundary',async()=>{
 let calls=0;const load=async()=>{calls++;return history;};
 await Promise.all(Array.from({length:10},()=>marketCache(db,rights,7,load,at)));
 expect(calls).toBe(1);expect(await marketCache(db,rights,7,load,at)).toMatchObject({status:'fresh',data:history});
 const poison=async()=>({...history,accountId:'private-account',apiKey:'never-store'});
 await expect(marketCache(db,{...rights,reference:randomUUID()},7,poison,at)).resolves.toMatchObject({status:'unavailable'});
 expect((await db.query("SELECT count(*)::int n FROM public_market_cache WHERE record::text LIKE '%never-store%' OR record::text LIKE '%private-account%' ")).rows[0].n).toBe(0);
});
it('labels bounded stale data, applies a rate-limit cooldown, and purges expired retained prices',async()=>{
 const policy={...rights,reference:randomUUID()};await marketCache(db,policy,7,async()=>history,at);let count=0;
 const fail=async()=>{count++;throw new MarketRateLimit(120);};
 expect(await marketCache(db,policy,7,fail,new Date(at.getTime()+61000))).toMatchObject({status:'stale',data:history});
 await marketCache(db,policy,7,fail,new Date(at.getTime()+62000));expect(count).toBe(1);
 expect(await marketCache(db,policy,7,fail,new Date(at.getTime()+700000))).toMatchObject({status:'unavailable'});
});
