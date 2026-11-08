import {expect,it} from 'vitest';
import {CoinGeckoClient,normalizeHistory,type MarketHistory} from '../../src/server/market/coingecko';
import {assertMarketRights,type MarketRights} from '../../src/server/market/source-policy';
export const permittedSyntheticPolicy:MarketRights={approved:true,reference:'synthetic-policy-not-a-real-license',tier:'pro',display:true,freshSeconds:60,staleSeconds:300,retentionSeconds:600,attribution:'CoinGecko',maxDays:90};
const observed='2026-11-07T12:00:00.000Z',t=Date.parse(observed);
it('preserves irregular source granularity and timestamped USD research history',()=>{
 const data=normalizeHistory({prices:[[t-7200000,100],[t-3600000,101],[t,102]],secret:'never-return'},observed);
 expect(data).toMatchObject({currency:'USD',coin:'solana',sourceId:'coingecko',observedAt:observed,minimumStepMs:3600000,maximumStepMs:3600000});
 expect(JSON.stringify(data)).not.toContain('secret');
 expect(normalizeHistory({prices:[[t-3600000,100],[t-600000,101],[t,102]]},observed)).toMatchObject({minimumStepMs:600000,maximumStepMs:3000000});
 expect(()=>normalizeHistory({prices:[[0,100],[0,102]]},observed)).toThrow();expect(()=>normalizeHistory({prices:[[t+1,100]]},observed)).toThrow();expect(()=>normalizeHistory({prices:[[null,100]]},observed)).toThrow();
});
it('fails closed before network access without reviewed rights and uses only server headers when enabled',async()=>{
 let count=0;const fetcher:typeof fetch=async(url,init)=>{count++;expect(String(url)).toBe('https://pro-api.coingecko.com/api/v3/coins/solana/market_chart?vs_currency=usd&days=7&precision=full');expect(new Headers(init?.headers).get('x-cg-pro-api-key')).toBe('synthetic-secret');return new Response(JSON.stringify({prices:[[t,100]]}));};
 expect(()=>assertMarketRights({...permittedSyntheticPolicy,approved:false})).toThrow();
 const denied=new CoinGeckoClient({...permittedSyntheticPolicy,approved:false},'synthetic-secret',fetcher);await expect(denied.history(7,observed)).rejects.toThrow();expect(count).toBe(0);
 const client=new CoinGeckoClient(permittedSyntheticPolicy,'synthetic-secret',fetcher);const result:MarketHistory=await client.history(7,observed);expect(count).toBe(1);expect(JSON.stringify(result)).not.toContain('synthetic-secret');
});
it('bounds error responses and reports rate limiting without leaking provider error bodies',async()=>{
 const c=new CoinGeckoClient(permittedSyntheticPolicy,'synthetic-secret',async()=>new Response('synthetic-secret',{status:429,headers:{'Retry-After':'120'}}));
 await expect(c.history(7,observed)).rejects.toMatchObject({code:'market_rate_limit',retryAfterSeconds:120});
 const bad=new CoinGeckoClient(permittedSyntheticPolicy,'synthetic-secret',async()=>new Response('synthetic-secret',{status:403}));await expect(bad.history(7,observed)).rejects.toThrow('Market data is unavailable');
});
