import {timingSafeEqual,randomUUID} from 'node:crypto';
import type {Pool} from 'pg';
import {z} from 'zod';
import {DomainError,invariant} from '../../domain/errors';
import {tokenHash} from '../auth/crypto';
import {transaction,type Tx} from '../db/client';
import {enqueue} from '../jobs/queue';
import {sourceUrl} from '../../domain/source-url';
import {linkCallback,type CallbackActor,type CallbackReceipt} from './callbacks';
import {applyMembershipEvent} from './membership-events';
import type {BotButton} from './render';
export interface BotConfiguration {botId:string;username:string;secret:string;origin:string}
export interface TelegramTransport {edit?:(chatId:string,messageId:string,text:string,buttons?:BotButton[][])=>Promise<void>;send:(chatId:string,text:string,buttons?:BotButton[][],topicId?:string|null)=>Promise<{messageId:string}>;answer:(id:string,text:string)=>Promise<void>}
export interface WebhookServices {castBallot?:(tx:Tx,token:string,actor:CallbackActor)=>Promise<CallbackReceipt>}
const integer=z.number().int().safe();
const user=z.object({id:integer.positive()});
const chat=z.object({id:integer.refine(n=>n!==0),type:z.enum(['private','group','supergroup','channel'])});
const message=z.object({message_id:integer.positive(),from:user.optional(),chat,reply_to_message:z.object({message_id:integer.positive()}).optional(),text:z.string().max(4096).optional()});
const membershipEvent=z.object({chat,new_chat_member:z.object({user,status:z.enum(['creator','administrator','member','restricted','left','kicked']),is_member:z.boolean().optional()})});
const updateSchema=z.object({update_id:integer.nonnegative(),message:message.optional(),chat_member:membershipEvent.optional(),my_chat_member:membershipEvent.optional(),callback_query:z.object({id:z.string().min(1).max(128),from:user,message:message.optional(),data:z.string().refine(s=>Buffer.byteLength(s)<=64).optional()}).optional()});
export function verifyWebhookSecret(secret:string|null,expected:string):void {
 invariant(secret&&secret.length<=256&&expected.length>=32&&timingSafeEqual(Buffer.from(tokenHash(secret),'hex'),Buffer.from(tokenHash(expected),'hex')),'unauthorized','Invalid Telegram webhook secret');
}
export async function processUpdate(db:Pool,secret:string|null,raw:unknown,config:BotConfiguration,transport:TelegramTransport,services:WebhookServices={}):Promise<CallbackReceipt> {
 verifyWebhookSecret(secret,config.secret);
 const parsed=updateSchema.safeParse(raw);invariant(parsed.success,'invalid_update','Malformed Telegram update');const update=parsed.data;
 let command:Record<string,unknown>|undefined;
 if(update.message?.from&&update.message.text?.startsWith('/')) {
  const [first,...rest]=update.message.text.split(/\s+/),[name,mention]=first.slice(1).split('@');
  if(mention&&mention.toLowerCase()!==config.username.toLowerCase())return {status:'ignored',message:'For another bot'};
  if(!['start','help','privacy','plan','research','note','track','bounty','results'].includes(name))return {status:'ignored',message:'Unknown command'};
  if(update.message.chat.type==='private')invariant(update.message.chat.id===update.message.from.id,'callback_context','Private bot identity does not match its chat');
  command={botId:config.botId,command:name,senderId:update.message.from.id.toString(),chatId:update.message.chat.id.toString(),chatType:update.message.chat.type,messageId:update.message.message_id.toString()};
  if(name==='start'&&update.message.chat.type==='private'&&/^link_[A-Za-z0-9_-]{43}$/.test(rest[0]??''))command.challengeHash=tokenHash(rest[0].slice(5));
  if(name==='note'&&update.message.reply_to_message){
   const fields=rest.join(' ').split('|').map(v=>v.trim());
   if(fields.length===4&&fields[1].length>=5&&fields[1].length<=1500&&fields[2].length>=3&&fields[2].length<=1000&&fields[3].length>=2&&fields[3].length<=1000){try{command.noteInput={sourceUrl:sourceUrl(fields[0]),claim:fields[1],uncertainty:fields[2],disclosures:fields[3],opposingView:null,proposalVersionId:null};command.noteRequestId=randomUUID();command.replyMessageId=update.message.reply_to_message.message_id.toString();}catch{}}
  }
  // Plain chat and arbitrary command arguments are never mirrored into retained records.
 }
 const membership=update.my_chat_member??update.chat_member;
 if(!command&&!update.callback_query&&!membership)return {status:'ignored',message:'No selected command or callback'};
 const callback=update.callback_query;
 if(callback)invariant(callback.message&&callback.data,'callback_context','Open the original bot message to use this button');
 const receipt=await transaction(db,async tx=>{
  await tx.query("SET LOCAL lock_timeout='750ms'; SET LOCAL statement_timeout='1000ms'");
  await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[`telegram:${config.botId}:${update.update_id}`]);
  const prior=(await tx.query('SELECT receipt FROM consumed_updates WHERE bot_id=$1 AND update_id=$2',[config.botId,update.update_id.toString()])).rows[0];if(prior)return prior.receipt as CallbackReceipt;
  let result:CallbackReceipt;
  if(membership) {
   if(update.my_chat_member&&membership.chat.type==='private'&&membership.new_chat_member.user.id.toString()===config.botId)await tx.query('UPDATE bot_starts SET blocked_at=CASE WHEN $3 THEN clock_timestamp() ELSE NULL END WHERE bot_id=$1 AND telegram_id=$2',[config.botId,membership.chat.id.toString(),['kicked','left'].includes(membership.new_chat_member.status)]);
   await applyMembershipEvent(tx,membership,!!update.my_chat_member,config.botId);result={status:'saved',message:'Membership event applied'};
  } else if(callback) {
   const actor={telegramId:callback.from.id.toString(),chatId:callback.message!.chat.id.toString(),chatType:callback.message!.chat.type,messageId:callback.message!.message_id.toString()};
   if(callback.data!.startsWith('l:'))result=await linkCallback(tx,callback.data!,actor);
   else {invariant(callback.data!.startsWith('b:')&&services.castBallot,'unavailable','This ballot is unavailable; open its canonical record');result=await services.castBallot(tx,callback.data!.slice(2),actor);}
  }else {
   if(command?.command==='start'&&command.chatType==='private'){await tx.query('INSERT INTO bot_starts(bot_id,telegram_id) VALUES($1,$2) ON CONFLICT(bot_id,telegram_id) DO UPDATE SET started_at=clock_timestamp(),blocked_at=NULL',[config.botId,command.senderId]);await tx.query('UPDATE users SET bot_started_at=clock_timestamp() WHERE telegram_id=$1',[command.senderId]);}
   const operationId=`telegram:${config.botId}:${update.update_id}`;
   await tx.query("INSERT INTO operations(id,kind,state,record) VALUES($1,'telegram_command','pending',$2::jsonb)",[operationId,JSON.stringify(command)]);
   await enqueue(tx,{task:'telegram_command',operationId,payload:{operationId}});
   result={status:'queued',message:'Command recorded for delivery',operationId};
  }
  await tx.query('INSERT INTO consumed_updates(bot_id,update_id,receipt) VALUES($1,$2,$3::jsonb)',[config.botId,update.update_id.toString(),JSON.stringify(result)]);return result;
 });
 if(callback){try{await transport.answer(callback.id,receipt.message);}catch{console.warn(JSON.stringify({component:'telegram',event:'callback_feedback_unconfirmed',updateId:update.update_id}));}}
 return receipt;
}
export function unsavedFeedback(error:unknown):string {
 if(error instanceof DomainError)return error.message;
 return 'We could not confirm this action. Check its saved receipt, then safely retry the same button.';
}
