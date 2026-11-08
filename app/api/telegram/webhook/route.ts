import type {NextRequest} from 'next/server';
import {getPool} from '@/src/server/db/client';
import {telegramConfiguration,telegramTransport} from '@/src/server/telegram/bot';
import {processUpdate,verifyWebhookSecret,unsavedFeedback} from '@/src/server/telegram/webhook';
import {httpError,privateJson} from '@/src/server/auth/http';
import {readLimitedText} from '@/src/server/http/request-body';
import {DomainError} from '@/src/domain/errors';
export async function POST(request:NextRequest){
 let authenticated=false,raw:unknown,transport;
 try {
  const configuration=telegramConfiguration();verifyWebhookSecret(request.headers.get('x-telegram-bot-api-secret-token'),configuration.secret);authenticated=true;
  const text=await readLimitedText(request,65536);
  try{raw=JSON.parse(text);}catch{throw new DomainError('invalid_update','Invalid Telegram update');}
  transport=telegramTransport();return privateJson(await processUpdate(getPool(),request.headers.get('x-telegram-bot-api-secret-token'),raw,configuration,transport));
 }catch(error){
  const callback=(raw as {callback_query?:{id?:unknown}}|undefined)?.callback_query;
  if(authenticated&&typeof callback?.id==='string'&&callback.id.length<=128){try{await transport?.answer(callback.id,unsavedFeedback(error));}catch{/* Feedback failure cannot become a saved action. */}return privateJson({status:'unconfirmed',message:unsavedFeedback(error)});}
  return httpError(error);
 }
}
