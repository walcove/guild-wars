import type {NextRequest} from 'next/server';
import {z} from 'zod';
import {httpError,privateJson,sessionCookie} from '@/src/server/auth/http';
import {readSession} from '@/src/server/auth/sessions';
import {getPool} from '@/src/server/db/client';
import {publicationView} from '@/src/server/services/publish-proposal';
import {invariant} from '@/src/domain/errors';
export async function GET(request:NextRequest,{params}:{params:Promise<{proposalId:string}>}){try{const user=(await readSession(getPool(),request.cookies.get(sessionCookie)?.value??'')).userId;invariant(user,'unauthorized','Connect Telegram first');return privateJson(await publicationView(getPool(),user,(await params).proposalId,z.uuid().parse(request.nextUrl.searchParams.get('version'))));}catch(e){return httpError(e);}}
