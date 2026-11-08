import type {NextRequest} from 'next/server';
import {z} from 'zod';
import {privateJson,httpError,sessionCookie} from '@/src/server/auth/http';
import {readSession} from '@/src/server/auth/sessions';
import {getPool} from '@/src/server/db/client';
import {inGuild} from '@/src/server/db/repositories';
import {invariant} from '@/src/domain/errors';
// Read-only identity/access check. Unlike session bootstrap, this never rotates CSRF or creates a guest.
export async function GET(request:NextRequest){try{invariant(request.headers.get('sec-fetch-site')!=='cross-site','csrf','Open Guild Wars directly');const user=(await readSession(getPool(),request.cookies.get(sessionCookie)?.value??'')).userId;invariant(user,'unauthorized','Connect Telegram first');const guild=request.nextUrl.searchParams.get('guild');if(guild){invariant(z.uuid().safeParse(guild).success,'invalid_input','Invalid guild scope');await inGuild(getPool(),user,guild,async()=>{});}return privateJson({userId:user});}catch(e){return httpError(e);}}
