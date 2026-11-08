import type {NextRequest} from 'next/server';
import {getPool} from '@/src/server/db/client';
import {newBrowserSession,readSession} from '@/src/server/auth/sessions';
import {sessionCookie,csrfCookie,privateJson,setSessionCookies,sessionCsrf,httpError} from '@/src/server/auth/http';
import {invariant} from '@/src/domain/errors';
export async function GET(request:NextRequest){
 try {
  invariant(request.headers.get('sec-fetch-site')!=='cross-site','csrf','Open Guild Wars directly to connect');
  const token=request.cookies.get(sessionCookie)?.value;
  let credentials;
  if(token){try {const session=await readSession(getPool(),token);credentials={sessionToken:token,csrfToken:await sessionCsrf(token,request.cookies.get(csrfCookie)?.value,session.csrfHash),userId:session.userId};}catch(error){if((error as {code?:string}).code!=='invalid_session')throw error;}}
  credentials??=await newBrowserSession(getPool());
  const response=privateJson({userId:credentials.userId,csrfToken:credentials.csrfToken,telegramConfigured:Boolean(process.env.TELEGRAM_BOT_USERNAME&&process.env.TELEGRAM_BOT_TOKEN&&process.env.TELEGRAM_WEBHOOK_SECRET&&process.env.GW_TELEGRAM_SENDING_ENABLED==='true')});
  setSessionCookies(response,credentials);return response;
 }catch(error){return httpError(error);}
}
