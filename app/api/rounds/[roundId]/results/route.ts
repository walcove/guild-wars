import type {NextRequest} from 'next/server';
import {invariant} from '@/src/domain/errors';
import {privateJson,httpError,sessionCookie} from '@/src/server/auth/http';
import {readSession} from '@/src/server/auth/sessions';
import {getPool} from '@/src/server/db/client';
import {roundResults} from '@/src/server/services/results';
export async function GET(request:NextRequest,{params}:{params:Promise<{roundId:string}>}){try{const user=(await readSession(getPool(),request.cookies.get(sessionCookie)?.value??'')).userId;invariant(user,'unauthorized','Connect Telegram first');return privateJson(await roundResults(getPool(),user,(await params).roundId));}catch(e){return httpError(e);}}
