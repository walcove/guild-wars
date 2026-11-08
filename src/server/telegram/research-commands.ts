import type {Pool} from 'pg';
import {DomainError,invariant} from '../../domain/errors';
import {guildOverview} from '../services/guilds';
import {createNote,type NoteContent} from '../services/research-notes';
import {escapeHtml,type BotCard} from './render';
import type {BotConfiguration} from './webhook';
export interface ResearchCommand {command:string;senderId:string;chatId:string;chatType:string;replyMessageId?:string;noteInput?:NoteContent;noteRequestId?:string}
export async function researchCommandCard(db:Pool,record:ResearchCommand,config:BotConfiguration):Promise<BotCard> {
 const connect={text:'Connect your account',url:new URL('/connect',config.origin).toString()},home={text:'Open your guilds',url:new URL('/guilds',config.origin).toString()};
 try {
  const user=(await db.query<{id:string}>('SELECT id FROM users WHERE telegram_id=$1',[record.senderId])).rows[0];invariant(user,'unauthorized','Connect the same Telegram account on the website first. Research needs no wallet.');
  if(record.chatType==='private'){
   const guilds=(await db.query<{id:string;name:string}>("SELECT g.id,g.name FROM guilds g JOIN memberships m ON m.guild_id=g.id WHERE m.user_id=$1 AND m.status='active' ORDER BY g.name,g.id LIMIT 5",[user.id])).rows;
   return {text:'Choose your guild’s website record. Research and outcome comparisons happen there; discussion and voting stay in the bound Telegram group.',buttons:[...guilds.map(g=>[{text:[...g.name].slice(0,50).join(''),url:new URL(`/guilds/${g.id}`,config.origin).toString()}]),[home]]};
  }
  const binding=(await db.query<{guild_id:string}>('SELECT guild_id FROM group_bindings WHERE chat_id=$1 AND bot_id=$2 AND active',[record.chatId,config.botId])).rows[0];invariant(binding,'group_unavailable','This bot/group binding is unavailable. Ask a guild administrator to verify it again.');
  const view=await guildOverview(db,user.id,binding.guild_id),round=view.round;invariant(round,'round_unavailable','No current round has been published.');
  const researchUrl=new URL(`/guilds/${binding.guild_id}/rounds/${round.id}/research`,config.origin).toString(),buttons=[[{text:'Open this round’s research',url:researchUrl}]];
  if(record.command==='note'){
   if(!record.replyMessageId||!record.noteInput||!record.noteRequestId)return {text:'Reply to the exact proposal message with:\n/note https://original-source | short claim | uncertainty | your interests or positions\nOnly this explicit evidence is retained. No wallet or specialist role is required.',buttons};
   const version=(await db.query<{proposal_version_id:string;round_id:string}>('SELECT d.proposal_version_id,v.round_id FROM telegram_deliveries d JOIN proposal_versions v ON v.id=d.proposal_version_id WHERE d.chat_id=$1 AND d.message_id=$2 AND v.guild_id=$3 AND d.state IN (\'published\',\'reported_unavailable\')',[record.chatId,record.replyMessageId,binding.guild_id])).rows[0];invariant(version,'version_unavailable','Reply to a known published proposal message so the exact version can be attached.');
   const note=await createNote(db,user.id,binding.guild_id,version.round_id,{...record.noteInput,proposalVersionId:version.proposal_version_id,requestId:record.noteRequestId});return {text:`Evidence saved · revision ${note.revision}. Source and uncertainty are attached to the exact proposal version. Posting volume earns no research reputation.`,buttons};
  }
  if(record.command==='plan'){
   const version=(await db.query<{id:string;proposal_id:string;version:number}>('SELECT v.id,v.proposal_id,v.version FROM proposal_versions v JOIN telegram_deliveries d ON d.proposal_version_id=v.id WHERE v.guild_id=$1 AND v.round_id=$2 AND d.state=\'published\' ORDER BY v.created_at DESC,v.id DESC LIMIT 1',[binding.guild_id,round.id])).rows[0];
   return version?{text:`${escapeHtml(view.guild.name)} · Round ${round.number} · Proposal v${version.version}. This is a shared plan, not an order authorization.`,buttons:[[{text:'Read the exact proposal',url:new URL(`/proposals/${version.proposal_id}?version=${version.id}`,config.origin).toString()}],...buttons]}:{text:'No proposal publication is confirmed for this round. Research or keep holding; no quote or decision is assumed.',buttons};
  }
  return {text:`${escapeHtml(view.guild.name)} · ${round.mode==='simulation'?'Simulation':'Real trading'} · Round ${round.number} · ${round.state.replaceAll('_',' ')}\n${escapeHtml(view.nextAction?.label??'Review research')}${view.nextAction?.deadline?'\nDeadline: '+new Date(view.nextAction.deadline).toUTCString():''}\nCompare a SOL covered call with holding. Every active member can contribute evidence. No vote authorizes another person’s funds.`,buttons};
 }catch(error){if(error instanceof DomainError)return {text:escapeHtml(error.message),buttons:[[connect],[home]]};throw error;}
}
