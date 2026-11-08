import type {NextRequest} from 'next/server';
import {httpError,privateJson,sessionCookie} from '@/src/server/auth/http';
import {readSession} from '@/src/server/auth/sessions';
import {getPool} from '@/src/server/db/client';
import {readRound} from '@/src/server/services/rounds';
import {invariant} from '@/src/domain/errors';
export async function GET(request:NextRequest,{params}:{params:Promise<{guildId:string;roundId:string}>}){try{const session=await readSession(getPool(),request.cookies.get(sessionCookie)?.value??'');invariant(session.userId,'unauthorized','Connect Telegram first');const {guildId,roundId}=await params;return privateJson(await readRound(getPool(),session.userId,guildId,roundId));}catch(e){return httpError(e);}}
