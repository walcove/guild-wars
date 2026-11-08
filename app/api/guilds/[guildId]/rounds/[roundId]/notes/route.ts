import type {NextRequest} from 'next/server';
import {body,httpError,mutationUser,privateJson,sessionCookie} from '@/src/server/auth/http';
import {readSession} from '@/src/server/auth/sessions';
import {getPool} from '@/src/server/db/client';
import {createNote,listNotes,createNoteSchema} from '@/src/server/services/research-notes';
import {invariant} from '@/src/domain/errors';
type Context={params:Promise<{guildId:string;roundId:string}>};
export async function POST(request:NextRequest,{params}:Context){try{const user=await mutationUser(request),{guildId,roundId}=await params;return privateJson(await createNote(getPool(),user,guildId,roundId,await body(request,createNoteSchema,32768)),201);}catch(e){return httpError(e);}}
export async function GET(request:NextRequest,{params}:Context){try{const user=(await readSession(getPool(),request.cookies.get(sessionCookie)?.value??'')).userId;invariant(user,'unauthorized','Connect Telegram first');const {guildId,roundId}=await params;return privateJson(await listNotes(getPool(),user,guildId,roundId,{limit:request.nextUrl.searchParams.has('limit')?Number(request.nextUrl.searchParams.get('limit')):25,cursor:request.nextUrl.searchParams.get('cursor')??undefined}));}catch(e){return httpError(e);}}
