import type {NextRequest} from 'next/server';
import {z} from 'zod';
import {getPool} from '@/src/server/db/client';
import {confirmTelegramLink} from '@/src/server/services/link-telegram';
import {body,mutationSession,privateJson,setSessionCookies,httpError} from '@/src/server/auth/http';
export async function POST(request:NextRequest){
 try {
  const {token}=await mutationSession(request),input=await body(request,z.object({token:z.string().length(43),telegramId:z.string().regex(/^[1-9]\d{0,19}$/)}).strict());
  const linked=await confirmTelegramLink(getPool(),token,input.token,undefined,input.telegramId);
  const response=privateJson({userId:linked.userId,csrfToken:linked.csrfToken,returnPath:linked.returnPath});setSessionCookies(response,linked);return response;
 }catch(error){return httpError(error);}
}
