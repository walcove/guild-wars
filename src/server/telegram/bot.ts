import {Api} from 'grammy';
import {invariant} from '../../domain/errors';
import type {BotConfiguration,TelegramTransport} from './webhook';
export function telegramConfiguration():BotConfiguration {
 const token=process.env.TELEGRAM_BOT_TOKEN,secret=process.env.TELEGRAM_WEBHOOK_SECRET,username=process.env.TELEGRAM_BOT_USERNAME;
 invariant(token&&/^\d+:[A-Za-z0-9_-]{20,}$/.test(token)&&secret&&secret.length>=32&&username&&/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(username),'unavailable','The Telegram transport is not configured');
 return {botId:token.split(':')[0],username,secret,origin:process.env.APP_ORIGIN??'http://127.0.0.1:3000'};
}
function buildTransport(token:string,apiRoot:string|undefined,enabled:()=>void):TelegramTransport {
 const api=new Api(token,{timeoutSeconds:3,apiRoot});
 const callbacks=new Api(token,{timeoutSeconds:1,apiRoot});
 return {
  send:async(chatId,text,buttons,topicId)=>{enabled();invariant(!topicId||(Number.isSafeInteger(Number(topicId))&&Number(topicId)>0),'invalid_topic','Topic identifier is outside the supported range');const sent=await api.sendMessage(chatId,text,{message_thread_id:topicId?Number(topicId):undefined,parse_mode:'HTML',reply_markup:buttons?{inline_keyboard:buttons}:undefined});return {messageId:sent.message_id.toString()};},
  edit:async(chatId,messageId,text,buttons)=>{enabled();invariant(Number.isSafeInteger(Number(messageId))&&Number(messageId)>0,'invalid_message','Message identifier is invalid');await api.editMessageText(chatId,Number(messageId),text,{parse_mode:'HTML',reply_markup:buttons?{inline_keyboard:buttons}:undefined});},
  answer:async(id,text)=>{enabled();await callbacks.answerCallbackQuery(id,{text:text.slice(0,200)});},
 };
}

export function telegramTransport():TelegramTransport {telegramConfiguration();return buildTransport(process.env.TELEGRAM_BOT_TOKEN!,undefined,()=>invariant(process.env.GW_TELEGRAM_SENDING_ENABLED==='true','unavailable','Telegram sending is disabled in this environment'));}
// The only enabled synthetic transport is permanently bound to an explicit IPv4 loopback root
// and a non-production fixture token. It cannot contact Telegram, create a Mini App or trade.
export function localTelegramTestTransport(root:string):TelegramTransport {let url:URL;try{url=new URL(root);}catch{throw new Error('Use an explicit loopback test API root');}invariant(url.protocol==='http:'&&url.hostname==='127.0.0.1'&&!!url.port&&url.pathname==='/'&&!url.search&&!url.hash&&!url.username&&!url.password,'invalid_loopback','Use an explicit loopback test API root without path or credentials');return buildTransport('9001:original_synthetic_loopback_token',url.origin,()=>{});}
