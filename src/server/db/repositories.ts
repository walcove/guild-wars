import type { Pool } from 'pg';
import { transaction,type Tx } from './client';
import { requireGuildAccess,type Membership } from '../../domain/permissions';
export interface GuildScope { readonly userId:string;readonly guildId:string;readonly membership:Membership }
export async function inGuild<T>(db:Pool,userId:string,guildId:string,work:(tx:Tx,scope:GuildScope)=>Promise<T>):Promise<T> {
 return transaction(db,async tx=>{
  const {rows}=await tx.query<Membership>('SELECT user_id AS "userId", guild_id AS "guildId", role, status FROM memberships WHERE user_id=$1 AND guild_id=$2 FOR SHARE',[userId,guildId]);
  const membership=requireGuildAccess(rows[0]??null,guildId,userId);
  await tx.query("SELECT set_config('app.user_id',$1,true),set_config('app.guild_id',$2,true)",[userId,guildId]);
  return work(tx,{userId,guildId,membership});
 });
}
export async function ownedIntent(tx:Tx,userId:string,id:string) {
 const {rows}=await tx.query('SELECT * FROM order_intents WHERE id=$1 AND user_id=$2',[id,userId]);
 if(!rows[0]) throw new Error('Order unavailable for this account');return rows[0];
}
