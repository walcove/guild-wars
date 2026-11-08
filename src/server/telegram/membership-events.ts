import type {Tx} from '../db/client';
import {audit} from '../services/audit';
export interface MembershipEvent {chat:{id:number};new_chat_member:{user:{id:number};status:string;is_member?:boolean}}
export async function applyMembershipEvent(tx:Tx,event:MembershipEvent,botEvent:boolean,botId:string):Promise<void> {
 const binding=(await tx.query('SELECT guild_id FROM group_bindings WHERE chat_id=$1 AND bot_id=$2 FOR UPDATE',[event.chat.id.toString(),botId])).rows[0];if(!binding)return;
 const member=event.new_chat_member;
 if(botEvent) {
  if(member.user.id.toString()!==botId)return;
  if(['administrator','creator'].includes(member.status))return; // Restoration always needs fresh dual administration proof.
  // Ballot services take this same row lock before accepting a vote. Existing votes remain immutable evidence.
  await tx.query('SELECT id FROM ballots WHERE guild_id=$1 AND state IN (\'prepared\',\'voting\') ORDER BY id FOR UPDATE',[binding.guild_id]);
  await tx.query('UPDATE group_bindings SET active=false WHERE guild_id=$1',[binding.guild_id]);
  await audit(tx,{guildId:binding.guild_id,kind:'group_access_lost',recordId:binding.guild_id,reason:'Bot administration lost; binding paused and new actions fail closed'});
 } else if(['left','kicked'].includes(member.status)||(member.status==='restricted'&&!member.is_member)) {
  const user=(await tx.query('SELECT id FROM users WHERE telegram_id=$1',[member.user.id.toString()])).rows[0];if(!user)return;
  const changed=await tx.query("UPDATE memberships SET status='departed' WHERE guild_id=$1 AND user_id=$2 AND status='active' RETURNING user_id",[binding.guild_id,user.id]);
  if(changed.rowCount)await audit(tx,{actorId:user.id,guildId:binding.guild_id,kind:'member_departed',recordId:user.id,reason:'Verified Telegram membership event; no historical vote removed'});
 }
}
