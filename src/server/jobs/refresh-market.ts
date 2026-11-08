import type {Pool} from 'pg';
import {invariant} from '../../domain/errors';
import {CoinGeckoClient} from '../market/coingecko';
import {marketCache} from '../market/cache';
import {assertMarketRights,configuredMarketRights} from '../market/source-policy';
export async function refreshMarket(db:Pool):Promise<void> {
 invariant(process.env.GW_DATA_ENABLED==='true','market_unavailable','Market requests are disabled');assertMarketRights(configuredMarketRights);
 const client=new CoinGeckoClient(configuredMarketRights,process.env.COINGECKO_API_KEY??'');await marketCache(db,configuredMarketRights,7,()=>client.history(7));
}
