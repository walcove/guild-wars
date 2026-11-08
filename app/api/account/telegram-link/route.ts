import type {NextRequest} from 'next/server';
import {z} from 'zod';
import {readSession} from '@/src/server/auth/sessions';
import {sessionCookie} from '@/src/server/auth/http';
import {getPool} from '@/src/server/db/client';
import {issueLink} from '@/src/server/services/link-telegram';
import {body,mutationSession,privateJson,httpError} from '@/src/server/auth/http';
import {invariant} from '@/src/domain/errors';
export async function POST(request:NextRequest){
 try {
  const {token}=await mutationSession(request),input=await body(request,z.object({returnPath:z.string().max(1024),purpose:z.enum(['sign_in','change_identity']).default('sign_in')}).strict());
  const bot=process.env.TELEGRAM_BOT_USERNAME;
  invariant(process.env.GW_TELEGRAM_SENDING_ENABLED==='true'&&process.env.TELEGRAM_BOT_TOKEN&&process.env.TELEGRAM_WEBHOOK_SECRET&&bot&&/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(bot),'unavailable','A separate authorized test bot is not configured. Connection is unavailable.');
  const link=await issueLink(getPool(),token,input.returnPath,input.purpose);
  return privateJson({...link,botUrl:`https://t.me/${bot}?start=link_${link.token}`});
 }catch(error){return httpError(error);}
}

export async function GET(request:NextRequest){
 try {
  const session=await readSession(getPool(),request.cookies.get(sessionCookie)?.value??'');
  const row=(await getPool().query('SELECT telegram_id,expires_at,return_path FROM link_challenges WHERE session_hash=$1 AND consumed_at IS NULL',[session.tokenHash])).rows[0];
  if(!row)return privateJson({state:'not_started',message:'This connection began in another browser, or was not started here. Return there, or restart safely.'});
  return privateJson({state:row.expires_at<=new Date()?'expired':row.telegram_id?'proved':'waiting',telegramId:row.telegram_id,expiresAt:row.expires_at.toISOString(),returnPath:row.return_path});
 }catch(error){return httpError(error);}
}
