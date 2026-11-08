import {z} from 'zod';
import {DomainError,invariant} from '../../domain/errors';
import {parseUtc} from '../../domain/types';
import {readLimitedText} from '../http/request-body';
import {assertMarketRights,type MarketRights} from './source-policy';
export interface MarketHistory {coin:'solana';currency:'USD';sourceId:'coingecko';observedAt:string;receivedAt:string;points:{time:number;value:number}[];minimumStepMs:number|null;maximumStepMs:number|null}
export const marketHistorySchema=z.object({coin:z.literal('solana'),currency:z.literal('USD'),sourceId:z.literal('coingecko'),observedAt:z.string(),receivedAt:z.string(),points:z.array(z.object({time:z.number().int().positive().safe(),value:z.number().positive().finite()}).strict()).min(1).max(10000),minimumStepMs:z.number().positive().nullable(),maximumStepMs:z.number().positive().nullable()}).strict();
export function normalizeHistory(input:unknown,receivedAt:string):MarketHistory {
 parseUtc(receivedAt);const raw=z.object({prices:z.array(z.tuple([z.number().int().positive().safe(),z.number().positive().finite()])).min(1).max(10000)}).parse(input);
 const points=raw.prices.map(([time,value])=>({time,value})),steps:number[]=[];
 for(let i=0;i<points.length;i++){invariant(points[i].time<=Date.parse(receivedAt),'market_timestamp','Market timestamps cannot be in the future');if(i){const step=points[i].time-points[i-1].time;invariant(step>0,'market_timestamp','Market timestamps must be strictly ordered');steps.push(step);}}
 return {coin:'solana',currency:'USD',sourceId:'coingecko',observedAt:new Date(points.at(-1)!.time).toISOString(),receivedAt,points,minimumStepMs:steps.length?Math.min(...steps):null,maximumStepMs:steps.length?Math.max(...steps):null};
}
export class MarketRateLimit extends DomainError {constructor(readonly retryAfterSeconds:number){super('market_rate_limit','Market source is rate limited; retained research data may be stale');}}
export class CoinGeckoClient {
 constructor(private readonly rights:MarketRights,private readonly key:string,private readonly fetcher:typeof fetch=fetch){}
 async history(days:number,receivedAt?:string):Promise<MarketHistory> {
  assertMarketRights(this.rights);invariant(this.key.length>=8,'market_unavailable','Market data is unavailable');invariant(Number.isInteger(days)&&days>=1&&days<=this.rights.maxDays,'market_range','History range is outside the permitted plan');
  const host=this.rights.tier==='pro'?'pro-api.coingecko.com':'api.coingecko.com',url=new URL(`https://${host}/api/v3/coins/solana/market_chart`);url.search=new URLSearchParams({vs_currency:'usd',days:days.toString(),precision:'full'}).toString();
  try {
   const response=await this.fetcher(url.toString(),{headers:{[this.rights.tier==='pro'?'x-cg-pro-api-key':'x-cg-demo-api-key']:this.key},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(8000)});
   if(response.status===429){const raw=response.headers.get('retry-after'),seconds=raw&&/^\d+$/.test(raw)?Number(raw):60;await response.body?.cancel();throw new MarketRateLimit(Math.min(900,Math.max(1,seconds)));}
   if(!response.ok){await response.body?.cancel();throw new DomainError('market_unavailable','Market data is unavailable');}
   return normalizeHistory(JSON.parse(await readLimitedText(response,2*1024*1024)),receivedAt??new Date().toISOString());
  }catch(error){if(error instanceof MarketRateLimit)throw error;throw new DomainError('market_unavailable','Market data is unavailable');}
 }
}
