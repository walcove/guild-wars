import {createHash,randomUUID} from 'node:crypto';
import type {Pool} from 'pg';
import {assertMarketRights,type MarketRights} from './source-policy';
import {marketHistorySchema,normalizeHistory,MarketRateLimit,type MarketHistory} from './coingecko';
import {invariant} from '../../domain/errors';
interface CacheRow {record:MarketHistory|null;fresh_until:Date|null;stale_until:Date|null;retain_until:Date|null}
export interface MarketStatus {status:'fresh'|'stale'|'unavailable';data?:MarketHistory;message?:string}
function key(rights:MarketRights,days:number):string {assertMarketRights(rights);invariant(Number.isInteger(days)&&days>=1&&days<=rights.maxDays,'market_range','History range is outside the permitted plan');return 'coingecko:solana:usd:'+days+':'+createHash('sha256').update(JSON.stringify(rights)).digest('hex');}
function visible(row:CacheRow|undefined,now:Date):MarketStatus {
 if(row?.record&&row.stale_until&&row.stale_until>now&&row.retain_until&&row.retain_until>now)return {status:row.fresh_until&&row.fresh_until>now?'fresh':'stale',data:marketHistorySchema.parse(row.record)};
 return {status:'unavailable',message:'No permitted current history is available; comparisons remain hypothetical'};
}
export async function purgeMarketCache(db:Pool,now=new Date()):Promise<void>{await db.query('UPDATE public_market_cache SET record=NULL WHERE retain_until<=$1 AND record IS NOT NULL',[now]);}
export async function readMarketStatus(db:Pool,rights:MarketRights,days:number,now=new Date()):Promise<MarketStatus>{const selected=(await db.query<CacheRow>('SELECT record,fresh_until,stale_until,retain_until FROM public_market_cache WHERE key=$1',[key(rights,days)])).rows[0];return visible(selected,now);}
export async function marketCache(db:Pool,rights:MarketRights,days:number,load:()=>Promise<MarketHistory>,now=new Date()):Promise<MarketStatus> {
 const cacheKey=key(rights,days),lease=randomUUID();await purgeMarketCache(db,now);
 await db.query('INSERT INTO public_market_cache(key) VALUES($1) ON CONFLICT DO NOTHING',[cacheKey]);
 const owner=await db.query('UPDATE public_market_cache SET lease_token=$2,lease_until=$3 WHERE key=$1 AND (fresh_until IS NULL OR fresh_until<=$4) AND (lease_until IS NULL OR lease_until<=$4) AND (retry_after IS NULL OR retry_after<=$4) RETURNING key',[cacheKey,lease,new Date(now.getTime()+15000),now]);
 if(owner.rowCount) {
  try {
   const parsed=marketHistorySchema.parse(await load());
   // Canonical projection cannot carry account quotes, identity fields, or response extras.
   const data=normalizeHistory({prices:parsed.points.map(p=>[p.time,p.value])},parsed.receivedAt);
   invariant(Date.parse(data.receivedAt)<=now.getTime()+15000,'market_timestamp','Market response timestamp is ahead of the refresh');
   const freshUntil=new Date(Math.min(now.getTime()+rights.freshSeconds*1000,Date.parse(data.observedAt)+rights.freshSeconds*1000)),staleUntil=new Date(Math.min(now.getTime()+rights.staleSeconds*1000,Date.parse(data.observedAt)+rights.staleSeconds*1000));
   await db.query('UPDATE public_market_cache SET record=$3::jsonb,fetched_at=$4,fresh_until=$5,stale_until=$6,retain_until=$7,lease_token=NULL,lease_until=NULL,retry_after=NULL WHERE key=$1 AND lease_token=$2',[cacheKey,lease,JSON.stringify(data),now,freshUntil,staleUntil,new Date(now.getTime()+rights.retentionSeconds*1000)]);
  }catch(error){await db.query('UPDATE public_market_cache SET lease_token=NULL,lease_until=NULL,retry_after=$3 WHERE key=$1 AND lease_token=$2',[cacheKey,lease,new Date(now.getTime()+(error instanceof MarketRateLimit?error.retryAfterSeconds:30)*1000)]);}
 }
 return readMarketStatus(db,rights,days,now);
}
