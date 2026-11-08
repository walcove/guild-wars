import type {NextRequest} from 'next/server';
import {httpError,privateJson,mutationUser,body} from '@/src/server/auth/http';
import {getPool} from '@/src/server/db/client';
import {addCuratedEvent,eventInput} from '@/src/server/market/events';
export async function POST(request:NextRequest,{params}:{params:Promise<{guildId:string}>}){try{const user=await mutationUser(request);return privateJson(await addCuratedEvent(getPool(),user,(await params).guildId,await body(request,eventInput)),201);}catch(e){return httpError(e);}}
