import type {NextRequest} from 'next/server';
import {privateJson,httpError,sessionCookie} from '@/src/server/auth/http';
import {readSession} from '@/src/server/auth/sessions';
import {getPool} from '@/src/server/db/client';
import {ballotView} from '@/src/server/services/ballots';
import {invariant} from '@/src/domain/errors';
export async function GET(request:NextRequest,{params}:{params:Promise<{ballotId:string}>}){try{const user=(await readSession(getPool(),request.cookies.get(sessionCookie)?.value??'')).userId;invariant(user,'unauthorized','Connect Telegram first');const {ballotId}=await params;return privateJson(await ballotView(getPool(),user,ballotId));}catch(e){return httpError(e);}}
