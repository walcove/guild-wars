import type {Pool} from 'pg';
import {inGuild} from '../db/repositories';
import {invariant} from '../../domain/errors';
import {readRound} from './rounds';
import {readMarketStatus,type MarketStatus} from '../market/cache';
import {listCuratedEvents} from '../market/events';
import {assertMarketRights,configuredMarketRights} from '../market/source-policy';
export async function researchData(db:Pool,userId:string,guildId:string,roundId:string){
 const view=await readRound(db,userId,guildId,roundId); // Authorization precedes shared data/cache lookups.
 let history:MarketStatus={status:'unavailable',message:'SOL price/history display and cache rights are not yet verified'};
 try{assertMarketRights(configuredMarketRights);history=await readMarketStatus(db,configuredMarketRights,7);}catch{}
 const events=await listCuratedEvents(db,userId,guildId,view.round.expires_at);
 return {...view,history,events,marketAttribution:configuredMarketRights.attribution,quoteMenu:{status:'unavailable' as const,calls:[],message:'No permitted provider quote source is configured. Hypothetical outcomes remain available.'},checkedAt:new Date().toISOString()};
}
export async function roundGuild(db:Pool,userId:string,roundId:string):Promise<string>{const round=(await db.query<{guild_id:string}>('SELECT guild_id FROM rounds WHERE id=$1',[roundId])).rows[0];invariant(round,'round_unavailable','Round unavailable');await inGuild(db,userId,round.guild_id,async()=>{});return round.guild_id;}
