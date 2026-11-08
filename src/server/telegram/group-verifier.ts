import {Api} from 'grammy';
import {invariant} from '../../domain/errors';
import type {GroupVerifier} from '../services/bind-group';
import {telegramConfiguration} from './bot';
function userNumber(id:string):number {invariant(/^\d+$/.test(id)&&Number.isSafeInteger(Number(id)),'invalid_identity','Telegram identity is outside the supported integer range');return Number(id);}
// Only supported read APIs. Being group administrator is required for reliable getChatMember.
export function telegramGroupVerifier():GroupVerifier {
 const config=telegramConfiguration(),api=new Api(process.env.TELEGRAM_BOT_TOKEN!,{timeoutSeconds:3});
 return {botId:config.botId,verify:async(chatId,actorTelegramId)=>{
  const [group,actor,bot]=await Promise.all([api.getChat(chatId),api.getChatMember(chatId,userNumber(actorTelegramId)),api.getChatMember(chatId,userNumber(config.botId))]);
  const groupUrl='username' in group&&group.username?`https://t.me/${group.username}`:'invite_link' in group?group.invite_link??null:null;
  return {chatId:group.id.toString(),actorTelegramId:actor.user.id.toString(),botTelegramId:bot.user.id.toString(),type:group.type,actorStatus:actor.status,botStatus:bot.status,observedAt:new Date().toISOString(),groupUrl,isForum:'is_forum' in group&&group.is_forum===true};
 },member:async(chatId,telegramId)=>{
  const [member,bot]=await Promise.all([api.getChatMember(chatId,userNumber(telegramId)),api.getChatMember(chatId,userNumber(config.botId))]);
  invariant(member.user.id.toString()===telegramId&&bot.user.id.toString()===config.botId,'invalid_group_proof','Telegram returned a mismatched identity');
  return {chatId,telegramId,status:member.status,botStatus:bot.status,observedAt:new Date().toISOString(),isMember:'is_member' in member?member.is_member:undefined};
 }};
}
