import type {Pool} from 'pg';
import {invariant} from '../../domain/errors';
import {opaqueToken,tokenHash,validToken} from '../auth/crypto';
import {transaction} from '../db/client';
import {inGuild} from '../db/repositories';
import {audit} from './audit';
import {freshGroupProof,type GroupVerifier} from './bind-group';
export async function createInvitation(db:Pool,actorId:string,guildId:string):Promise<{token:string}> {
 return inGuild(db,actorId,guildId,async(tx,scope)=>{invariant(scope.membership.role==='administrator','forbidden','Only guild administrators can issue invitations');const token=opaqueToken();await tx.query("INSERT INTO guild_invitations(guild_id,created_by,token_hash,expires_at) VALUES($1,$2,$3,clock_timestamp()+interval '7 days')",[guildId,actorId,tokenHash(token)]);await audit(tx,{actorId,guildId,kind:'invitation_created',recordId:guildId,reason:'Seven-day invitation, up to 20 accepted members'});return {token};});
}
export async function invitationView(db:Pool,token:string) {
 invariant(validToken(token),'invitation_unavailable','This invitation is unavailable');
 const row=(await db.query<{guild_id:string;name:string;mode:'simulation'|'live'|null}>("SELECT v.guild_id,g.name,(SELECT mode FROM seasons s WHERE s.guild_id=g.id ORDER BY created_at DESC,id DESC LIMIT 1) AS mode FROM guild_invitations v JOIN guilds g ON g.id=v.guild_id WHERE v.token_hash=$1 AND v.revoked_at IS NULL AND v.expires_at>clock_timestamp() AND v.uses<v.max_uses",[tokenHash(token)])).rows[0];
 invariant(row,'invitation_unavailable','This invitation expired, was revoked or reached its allowance');return row;
}
export async function acceptInvitation(db:Pool,userId:string,token:string,verifier:GroupVerifier):Promise<{guildId:string}> {
 invariant(validToken(token),'invitation_unavailable','Invalid invitation');
 const selected=(await db.query("SELECT v.guild_id,b.chat_id,b.active,u.telegram_id FROM guild_invitations v JOIN group_bindings b ON b.guild_id=v.guild_id JOIN users u ON u.id=$2 WHERE v.token_hash=$1",[tokenHash(token),userId])).rows[0];
 invariant(selected?.active,'group_unavailable','The guild group must be verified before joining');
 const proof=await verifier.member(selected.chat_id,selected.telegram_id);freshGroupProof(proof.observedAt);
 invariant(proof.chatId===selected.chat_id&&proof.telegramId===selected.telegram_id&&['administrator','creator'].includes(proof.botStatus),'invalid_group_proof','Current group membership could not be verified');
 invariant(['member','administrator','creator'].includes(proof.status)||(proof.status==='restricted'&&proof.isMember),'group_membership_required','Join the guild’s Telegram group before accepting its website invitation');
 return transaction(db,async tx=>{
  const invite=(await tx.query('SELECT *,clock_timestamp() AS checked_at FROM guild_invitations WHERE token_hash=$1 FOR UPDATE',[tokenHash(token)])).rows[0];
  invariant(invite,'invitation_unavailable','This invitation is unavailable');
  const existing=(await tx.query('SELECT status FROM memberships WHERE guild_id=$1 AND user_id=$2 FOR UPDATE',[invite.guild_id,userId])).rows[0];
  if(existing?.status==='active')return {guildId:invite.guild_id as string};
  invariant(!existing,'membership_restricted','A departed or suspended membership requires administrator review');
  invariant(!invite.revoked_at&&invite.checked_at<invite.expires_at&&invite.uses<invite.max_uses,'invitation_unavailable','Invitation expired, revoked or exhausted');
  const binding=(await tx.query('SELECT chat_id,active FROM group_bindings WHERE guild_id=$1',[invite.guild_id])).rows[0];
  invariant(binding?.active&&binding.chat_id===selected.chat_id,'group_unavailable','Guild binding changed; verify again');freshGroupProof(proof.observedAt);
  await tx.query("INSERT INTO memberships(guild_id,user_id,role,status) VALUES($1,$2,'member','active')",[invite.guild_id,userId]);
  await tx.query('UPDATE guild_invitations SET uses=uses+1 WHERE id=$1',[invite.id]);
  await audit(tx,{actorId:userId,guildId:invite.guild_id,kind:'invitation_accepted',recordId:userId,reason:'Linked identity and current Telegram group membership verified'});return {guildId:invite.guild_id as string};
 });
}
export async function setMemberStatus(db:Pool,actorId:string,guildId:string,userId:string,status:'active'|'suspended'|'departed'):Promise<void> {
 invariant(['active','suspended','departed'].includes(status),'invalid_input','Unknown membership state');
 await inGuild(db,actorId,guildId,async(tx,scope)=>{invariant(scope.membership.role==='administrator','forbidden','Guild administration is required');const changed=await tx.query('UPDATE memberships SET status=$3 WHERE guild_id=$1 AND user_id=$2 RETURNING user_id',[guildId,userId,status]);invariant(changed.rowCount===1,'member_unavailable','Member unavailable in this guild');await audit(tx,{actorId,guildId,kind:'membership_changed',recordId:userId,reason:`Administrator set membership ${status}`});});
}
