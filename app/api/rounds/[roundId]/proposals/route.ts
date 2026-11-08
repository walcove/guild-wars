import type {NextRequest} from 'next/server';
import {body,httpError,mutationUser,privateJson,sessionCookie} from '@/src/server/auth/http';
import {readSession} from '@/src/server/auth/sessions';
import {invariant} from '@/src/domain/errors';
import {getPool} from '@/src/server/db/client';
import {saveDraft,saveDraftSchema,findOwnDraft} from '@/src/server/services/proposals';
import {roundGuild} from '@/src/server/services/research-data';
export async function POST(request:NextRequest,{params}:{params:Promise<{roundId:string}>}){try{const user=await mutationUser(request),{roundId}=await params;return privateJson(await saveDraft(getPool(),user,await roundGuild(getPool(),user,roundId),roundId,await body(request,saveDraftSchema,32768)),201);}catch(e){return httpError(e);}}

export async function GET(request:NextRequest,{params}:{params:Promise<{roundId:string}>}){try{const user=(await readSession(getPool(),request.cookies.get(sessionCookie)?.value??'')).userId;invariant(user,'unauthorized','Connect Telegram first');const {roundId}=await params,guildId=await roundGuild(getPool(),user,roundId);return privateJson({record:await findOwnDraft(getPool(),user,guildId,roundId,request.nextUrl.searchParams.get('requestId')??'')});}catch(e){return httpError(e);}}
