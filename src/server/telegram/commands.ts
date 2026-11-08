import {researchCommandCard,type ResearchCommand} from './research-commands';
import {GrammyError} from 'grammy';
import type {Pool} from 'pg';
import {transaction} from '../db/client';
import {invariant} from '../../domain/errors';
import {enqueue} from '../jobs/queue';
import {linkPrompt,type BotCard} from './render';
import type {BotConfiguration,TelegramTransport} from './webhook';
interface CommandRecord extends ResearchCommand {botId:string;command:string;senderId:string;chatId:string;chatType:string;challengeHash?:string;deliveryAttempts?:number;retryAt?:string;messageId?:string}
async function commandCard(db:Pool,record:CommandRecord,configuration:BotConfiguration):Promise<BotCard> {
 const buttons=[[{text:'Open Guild Wars',url:configuration.origin}]];
 if(record.command==='start'&&record.challengeHash&&record.chatType==='private'&&record.chatId===record.senderId){
  const row=(await db.query('SELECT token_hash FROM link_challenges WHERE token_hash=$1 AND consumed_at IS NULL AND expires_at>clock_timestamp()',[record.challengeHash])).rows[0];
  if(row)return linkPrompt(record.challengeHash,record.senderId,configuration.origin);
  return {text:'This connection expired or is unavailable. Restart it in the original browser.',buttons};
 }
 if(['plan','research','note'].includes(record.command))return researchCommandCard(db,record,configuration);
 if(record.command==='privacy')return {text:'Guild Wars retains selected commands, explicit research replies and necessary membership events. It does not mirror the whole chat. Private guild and account records require authorization. We never request seed phrases or private keys. Voting and account linking do not authorize a trade.',buttons};
 if(['start','help'].includes(record.command))return {text:'<b>Guild Wars · SOL covered calls</b>\nResearch and build plans on the website. Discuss and vote in your Telegram group. Selling a call caps upside; SOL can still lose value. Each real order needs your separate provider authorization.\n/start · /help · /privacy · /plan · /research · /note',buttons};
 return {text:'Open your guild on the website for this command’s canonical record. The corresponding community service is not yet available here.',buttons};
}
export async function deliverCommand(db:Pool,operationId:string,configuration:BotConfiguration,transport:TelegramTransport):Promise<void> {
 const record=await transaction(db,async tx=>{
  const row=(await tx.query('SELECT kind,state,record FROM operations WHERE id=$1 FOR UPDATE',[operationId])).rows[0];invariant(row?.kind==='telegram_command','command_missing','Command operation unavailable');
  if(['complete','unknown','failed_terminal'].includes(row.state))return null;
  if(row.state==='sending'){await tx.query("UPDATE operations SET state='unknown' WHERE id=$1",[operationId]);return null;}
  const data=row.record as CommandRecord;
  if(data.botId!==configuration.botId){await tx.query("UPDATE operations SET state='failed_terminal' WHERE id=$1",[operationId]);return null;}
  if(data.retryAt&&Date.parse(data.retryAt)>Date.now()){await enqueue(tx,{task:'telegram_command',operationId,payload:{operationId},runAt:data.retryAt});return null;}
  if((data.deliveryAttempts??0)>=5){await tx.query("UPDATE operations SET state='failed_terminal' WHERE id=$1",[operationId]);return null;}
  const next={...data,deliveryAttempts:(data.deliveryAttempts??0)+1};await tx.query("UPDATE operations SET state='sending',record=$2::jsonb WHERE id=$1",[operationId,JSON.stringify(next)]);return next;
 });
 if(!record)return;
 // No database transaction is held while Telegram is contacted.
 try {
  const card=await commandCard(db,record,configuration),sent=await transport.send(record.chatId,card.text,card.buttons);
  await db.query("UPDATE operations SET state='complete',record=record||jsonb_build_object('messageId',$2::text) WHERE id=$1 AND state='sending'",[operationId,sent.messageId]);
 }catch(error){
  if(error instanceof GrammyError&&error.error_code===429){
   const seconds=Math.max(1,Math.min(3600,error.parameters.retry_after??30)),retryAt=new Date(Date.now()+seconds*1000).toISOString();
   await transaction(db,async tx=>{await tx.query("UPDATE operations SET state='failed',record=record||jsonb_build_object('retryAt',$2::text) WHERE id=$1 AND state='sending'",[operationId,retryAt]);await enqueue(tx,{task:'telegram_command',operationId,payload:{operationId},runAt:retryAt});});
  }else {
   const state=error instanceof GrammyError&&[400,403].includes(error.error_code)?'failed_terminal':'unknown';
   await db.query("UPDATE operations SET state=$2 WHERE id=$1 AND state='sending'",[operationId,state]);
   console.warn(JSON.stringify({component:'telegram',event:'command_delivery_unconfirmed',operationId,state}));
  }
 }
}
