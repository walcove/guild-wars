import {GrammyError} from 'grammy';
import type {Pool} from 'pg';
import {transaction} from '../db/client';
import {beginDelivery,saveDelivery} from './outbox';
import {enqueue} from './queue';
import {proposalCard} from '../telegram/proposal-messages';
import type {ProposalContent} from '../../domain/proposals';
import type {BotConfiguration,TelegramTransport} from '../telegram/webhook';
export async function deliverProposal(db:Pool,id:string,config:BotConfiguration,transport:TelegramTransport):Promise<void> {
 const prepared=await transaction(db,async tx=>{
  const row=(await tx.query('SELECT d.*,v.content,v.version,v.proposal_id,p.guild_id,p.author_id,o.record,g.name AS guild_name,r.number AS round_number,r.state AS round_state,r.schedule AS round_schedule FROM telegram_deliveries d JOIN proposal_versions v ON v.id=d.proposal_version_id JOIN proposals p ON p.id=v.proposal_id JOIN operations o ON o.id=d.operation_id JOIN guilds g ON g.id=p.guild_id JOIN rounds r ON r.id=p.round_id WHERE d.id=$1 FOR UPDATE OF d',[id])).rows[0];
  if(!row||!['pending','failed'].includes(row.state)||row.attempts>=5)return null;
  const binding=(await tx.query('SELECT chat_id,bot_id,active FROM group_bindings WHERE guild_id=$1 FOR SHARE',[row.guild_id])).rows[0],member=(await tx.query("SELECT user_id FROM memberships WHERE guild_id=$1 AND user_id=$2 AND status='active'",[row.guild_id,row.author_id])).rows[0];
  if(!binding?.active||binding.chat_id!==row.chat_id||binding.bot_id!==config.botId||row.record.botId!==config.botId||!member){await tx.query("UPDATE telegram_deliveries SET state='blocked' WHERE id=$1",[id]);return null;}
  const card=proposalCard({deliveryId:row.id,guild:row.guild_name,round:row.round_number,proposalId:row.proposal_id,versionId:row.proposal_version_id,version:row.version,content:row.content as ProposalContent,replacement:!!row.replaces_id,stage:row.round_state,deadline:row.round_schedule.candidateLock},config.origin);
  if(!await beginDelivery(tx,id))return null;return {row,card};
 });if(!prepared)return;
 try {
  const sent=await transport.send(prepared.row.chat_id,prepared.card.text,prepared.card.buttons,prepared.row.topic_id);
  await transaction(db,async tx=>{await saveDelivery(tx,id,{state:'published',messageId:sent.messageId});await tx.query("UPDATE operations SET state='complete' WHERE id=$1",[prepared.row.operation_id]);});
 }catch(error){
  if(error instanceof GrammyError&&error.error_code===429){await transaction(db,async tx=>{await saveDelivery(tx,id,{state:'failed'});await enqueue(tx,{task:'deliver_telegram',operationId:prepared.row.operation_id,payload:{deliveryId:id},runAt:new Date(Date.now()+Math.max(1,Math.min(3600,error.parameters.retry_after??30))*1000).toISOString()});});}
  else {const definitive=error instanceof GrammyError&&[400,403].includes(error.error_code);await transaction(db,async tx=>{await saveDelivery(tx,id,{state:definitive?'failed':'unknown'});if(definitive)await tx.query('UPDATE telegram_deliveries SET attempts=5 WHERE id=$1',[id]);});}
 }
}
