import type {NextRequest} from 'next/server';
import {httpError,privateJson,mutationUser} from '@/src/server/auth/http';
import {getPool} from '@/src/server/db/client';
import {inGuild} from '@/src/server/db/repositories';
import {roundGuild} from '@/src/server/services/research-data';
import {assertMarketRights,configuredMarketRights} from '@/src/server/market/source-policy';
import {enqueue} from '@/src/server/jobs/queue';
import {invariant} from '@/src/domain/errors';
export async function POST(request:NextRequest,{params}:{params:Promise<{roundId:string}>}){try{const user=await mutationUser(request),roundId=(await params).roundId,guildId=await roundGuild(getPool(),user,roundId);invariant(process.env.GW_DATA_ENABLED==='true','market_unavailable','Market data requests are disabled');assertMarketRights(configuredMarketRights);await inGuild(getPool(),user,guildId,async tx=>{await enqueue(tx,{task:'refresh_market',operationId:'market:solana:usd:7',payload:{}});});return privateJson({status:'queued'},202);}catch(e){return httpError(e);}}
