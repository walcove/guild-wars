import {NextResponse,type NextRequest} from 'next/server';
import {z} from 'zod';
import {DomainError} from '../../domain/errors';
import {getPool,transaction} from '../db/client';
import {readSession} from './sessions';
import {opaqueToken,tokenHash,matchesHash} from './crypto';
import {readLimitedText} from '../http/request-body';
import {assertCsrf} from './csrf';
const secure=process.env.NODE_ENV==='production';
export const sessionCookie=secure?'__Host-gw_session':'gw_session';
export const csrfCookie=secure?'__Host-gw_csrf':'gw_csrf';
export function privateJson(body:unknown,status=200):NextResponse{return NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'}});}
export function setSessionCookies(response:NextResponse,session:{sessionToken:string;csrfToken:string}):void {
 const options={httpOnly:true,secure,sameSite:'lax' as const,path:'/',maxAge:604800};
 response.cookies.set(sessionCookie,session.sessionToken,options);response.cookies.set(csrfCookie,session.csrfToken,options);
}
export function clearSessionCookies(response:NextResponse):void {
 for(const name of [sessionCookie,csrfCookie])response.cookies.set(name,'',{httpOnly:true,secure,sameSite:'lax',path:'/',maxAge:0});
}
export async function mutationSession(request:NextRequest){
 const token=request.cookies.get(sessionCookie)?.value??'',session=await readSession(getPool(),token);
 assertCsrf(request.headers.get('origin'),process.env.APP_ORIGIN??'http://127.0.0.1:3000',request.headers.get('x-gw-csrf'),session.csrfHash);
 return {token,session};
}
export async function body<T>(request:NextRequest,schema:z.ZodType<T>):Promise<T> {
 const text=await readLimitedText(request,8192);
 try{return schema.parse(JSON.parse(text));}catch{throw new DomainError('invalid_input','Check the connection request and retry');}
}
export function httpError(error:unknown):NextResponse {
 if(error instanceof DomainError) {
  const status=['invalid_session','unauthorized'].includes(error.code)?401:error.code==='csrf'?403:error.code==='rate_limited'?429:error.code==='unavailable'?503:error.code==='invalid_input'?400:409;
  return privateJson({error:error.code,message:error.message},status);
 }
 console.error(JSON.stringify({component:'request',event:'service_error'}));return privateJson({error:'unavailable',message:'The service is unavailable. Your input was retained; retry when connected.'},503);
}
export async function sessionCsrf(token:string,existing:string|undefined,storedHash:string):Promise<string> {
 if(existing&&matchesHash(existing,storedHash))return existing;
 const csrf=opaqueToken();await transaction(getPool(),tx=>tx.query('UPDATE sessions SET csrf_hash=$2 WHERE token_hash=$1 AND revoked_at IS NULL',[tokenHash(token),tokenHash(csrf)]));return csrf;
}
export async function mutationUser(request:NextRequest):Promise<string> {
 const {session}=await mutationSession(request);if(!session.userId)throw new DomainError('unauthorized','Connect your Telegram account first');return session.userId;
}
