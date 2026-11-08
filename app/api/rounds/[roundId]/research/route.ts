import type {NextRequest} from 'next/server';
import {httpError,privateJson,sessionCookie} from '@/src/server/auth/http';
import {readSession} from '@/src/server/auth/sessions';
import {getPool} from '@/src/server/db/client';
import {researchData,roundGuild} from '@/src/server/services/research-data';
import {invariant} from '@/src/domain/errors';
export async function GET(request:NextRequest,{params}:{params:Promise<{roundId:string}>}){try{const user=(await readSession(getPool(),request.cookies.get(sessionCookie)?.value??'')).userId;invariant(user,'unauthorized','Connect Telegram first');const {roundId}=await params;return privateJson(await researchData(getPool(),user,await roundGuild(getPool(),user,roundId),roundId));}catch(e){return httpError(e);}}
