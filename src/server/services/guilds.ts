import type {Pool} from 'pg';
import {invariant} from '../../domain/errors';
import {canContributeResearch} from '../../domain/permissions';
import {inGuild} from '../db/repositories';
import {transaction} from '../db/client';
import {audit} from './audit';
export async function createGuild(db:Pool,userId:string,name:string):Promise<{id:string}> {
 invariant(typeof name==='string'&&name.trim().length>=2&&name.trim().length<=100,'invalid_input','Guild name must contain 2–100 characters');
 return transaction(db,async tx=>{const row=(await tx.query('INSERT INTO guilds(name,owner_id) VALUES($1,$2) RETURNING id',[name.trim(),userId])).rows[0];await tx.query("INSERT INTO memberships(guild_id,user_id,role,status) VALUES($1,$2,'administrator','active')",[row.id,userId]);await audit(tx,{actorId:userId,guildId:row.id,kind:'guild_created',recordId:row.id,reason:'Member created a guild; no pooled funds or season implied'});return row;});
}
export function guildOverview(db:Pool,userId:string,guildId:string) {
 return inGuild(db,userId,guildId,async(tx,scope)=>{
  const guild=(await tx.query<{id:string;name:string}>('SELECT id,name FROM guilds WHERE id=$1',[guildId])).rows[0];
  const season=(await tx.query<{id:string;mode:'simulation'|'live';division:string}>('SELECT id,mode,division FROM seasons WHERE guild_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1',[guildId])).rows[0]??null;
  const round=season?(await tx.query<{id:string;number:number;state:string;expires_at:Date;schedule:Record<string,string>}>('SELECT id,number,state,expires_at,schedule FROM rounds WHERE guild_id=$1 AND season_id=$2 ORDER BY number DESC LIMIT 1',[guildId,season.id])).rows[0]??null:null;
  const binding=(await tx.query<{chat_id:string;topic_id:string|null;group_url:string|null;active:boolean}>('SELECT chat_id,topic_id,group_url,active FROM group_bindings WHERE guild_id=$1',[guildId])).rows[0]??null;
  const positions=(await tx.query<{id:string;state:string;mode:string;created_at:Date}>("SELECT p.id,p.state,p.mode,p.created_at FROM positions p JOIN order_intents i ON i.id=p.intent_id WHERE p.user_id=$1 AND i.guild_id=$2 AND p.state NOT IN ('settled','withdrawn','closed') ORDER BY p.created_at,p.id LIMIT 100",[userId,guildId])).rows;
  return {guild,season,round,binding,positions,membership:scope.membership,canResearch:canContributeResearch(scope.membership)};
 });
}
