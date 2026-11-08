import type {Pool} from 'pg';
import {DomainError,invariant} from '../../domain/errors';
import {parseUtc} from '../../domain/types';
import {inGuild} from '../db/repositories';
import {audit} from './audit';
export interface GroupProof {chatId:string;actorTelegramId:string;botTelegramId:string;type:string;actorStatus:string;botStatus:string;observedAt:string;groupUrl:string|null;isForum:boolean}
export interface MemberProof {chatId:string;telegramId:string;status:string;botStatus:string;observedAt:string;isMember?:boolean}
export interface GroupVerifier {botId:string;verify:(chatId:string,actorTelegramId:string)=>Promise<GroupProof>;member:(chatId:string,telegramId:string)=>Promise<MemberProof>}
export function freshGroupProof(instant:string):void {parseUtc(instant);const age=Date.now()-Date.parse(instant);invariant(age>=0&&age<=10000,'invalid_group_proof','Group verification expired; check current permissions again');}
function validGroupUrl(value:string|null):string|null {
 if(!value)return null;try {const u=new URL(value);return u.protocol==='https:'&&u.hostname==='t.me'&&!u.search&&!u.hash&&!u.username&&!u.password&&/^\/(?:[A-Za-z0-9_]{5,32}|\+[A-Za-z0-9_-]+|joinchat\/[A-Za-z0-9_-]+)$/.test(u.pathname)?u.toString():null;}catch{return null;}
}
export async function bindGroup(db:Pool,userId:string,guildId:string,chatId:string,topicId:string|null,verifier:GroupVerifier):Promise<void> {
 invariant(/^-\d{1,18}$/.test(chatId)&&(!topicId||/^[1-9]\d{0,15}$/.test(topicId)),'invalid_input','Use the exact group chat ID and optional existing topic ID');
 const telegramId=await inGuild(db,userId,guildId,async(tx,scope)=>{invariant(scope.membership.role==='administrator','forbidden','An active guild administrator must bind the group');return (await tx.query('SELECT telegram_id FROM users WHERE id=$1',[userId])).rows[0].telegram_id as string;});
 // External verification happens outside database locks, then local authority is rechecked.
 const proof=await verifier.verify(chatId,telegramId);freshGroupProof(proof.observedAt);
 invariant(proof.chatId===chatId&&proof.actorTelegramId===telegramId&&proof.botTelegramId===verifier.botId&&['group','supergroup'].includes(proof.type),'invalid_group_proof','Group proof does not match this administrator, bot and group');
 invariant(['creator','administrator'].includes(proof.actorStatus)&&['creator','administrator'].includes(proof.botStatus),'group_admin_required','Both your Telegram group administration and the bot’s administrator access must be verified');
 invariant(!topicId||proof.isForum,'invalid_input','A topic can only be selected for a verified forum group');
 try {await inGuild(db,userId,guildId,async(tx,scope)=>{
  invariant(scope.membership.role==='administrator','forbidden','Guild administration changed; verify again');freshGroupProof(proof.observedAt);
  const previous=(await tx.query('SELECT chat_id FROM group_bindings WHERE guild_id=$1 FOR UPDATE',[guildId])).rows[0];
  const conflict=(await tx.query('SELECT guild_id FROM group_bindings WHERE chat_id=$1 AND guild_id<>$2',[chatId,guildId])).rows[0];invariant(!conflict,'binding_conflict','This Telegram group is already bound to another guild');
  await tx.query("INSERT INTO group_bindings(guild_id,chat_id,topic_id,group_url,administrator_id,method,verified_at,active) VALUES($1,$2,$3,$4,$5,'getChatMember',$6,true) ON CONFLICT(guild_id) DO UPDATE SET chat_id=EXCLUDED.chat_id,topic_id=EXCLUDED.topic_id,group_url=EXCLUDED.group_url,administrator_id=EXCLUDED.administrator_id,method=EXCLUDED.method,verified_at=EXCLUDED.verified_at,active=true",[guildId,chatId,topicId,validGroupUrl(proof.groupUrl),userId,proof.observedAt]);
  await audit(tx,{actorId:userId,guildId,kind:'group_bound',recordId:guildId,reason:'Guild and Telegram administration reverified',record:{chatId,previousChatId:previous?.chat_id??null,topicId,topicVerified:false,method:'getChatMember'}});
 });}catch(error){if((error as {code?:string}).code==='23505')throw new DomainError('binding_conflict','The group was concurrently bound; reload the canonical guild');throw error;}
}
