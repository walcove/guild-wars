import type {Pool} from 'pg';
import {invariant} from '../../domain/errors';
import {canContributeResearch} from '../../domain/permissions';
import {inGuild} from '../db/repositories';
import {transaction} from '../db/client';
import {nextRoundAction,type RoundRecord} from './rounds';
import {audit} from './audit';
export async function createGuild(db:Pool,userId:string,name:string):Promise<{id:string}> {
 invariant(typeof name==='string'&&name.trim().length>=2&&name.trim().length<=100,'invalid_input','Guild name must contain 2–100 characters');
 return transaction(db,async tx=>{const row=(await tx.query('INSERT INTO guilds(name,owner_id) VALUES($1,$2) RETURNING id',[name.trim(),userId])).rows[0];await tx.query("INSERT INTO memberships(guild_id,user_id,role,status) VALUES($1,$2,'administrator','active')",[row.id,userId]);await audit(tx,{actorId:userId,guildId:row.id,kind:'guild_created',recordId:row.id,reason:'Member created a guild; no pooled funds or season implied'});return row;});
}
export function guildOverview(db:Pool,userId:string,guildId:string) {
 return inGuild(db,userId,guildId,async(tx,scope)=>{
  const guild=(await tx.query<{id:string;name:string}>('SELECT id,name FROM guilds WHERE id=$1',[guildId])).rows[0];
  const now=(await tx.query<{instant:Date}>('SELECT clock_timestamp() instant')).rows[0].instant;
  const season=(await tx.query<{id:string;mode:'simulation'|'live';division:string}>(`WITH timetable AS (
   SELECT s.id,s.mode,s.division,s.created_at,bool_and(r.schedule ? 'researchOpen') published,min(coalesce((r.schedule->>'researchOpen')::timestamptz,r.created_at)) starts_at
   FROM seasons s JOIN rounds r ON r.season_id=s.id WHERE s.guild_id=$1 GROUP BY s.id
  ) SELECT id,mode,division FROM timetable ORDER BY CASE WHEN published THEN 0 ELSE 1 END,CASE WHEN starts_at<=$2 THEN 0 ELSE 1 END,
  CASE WHEN starts_at<=$2 THEN starts_at END DESC,CASE WHEN starts_at>$2 THEN starts_at END ASC,created_at DESC,id DESC LIMIT 1`,[guildId,now])).rows[0]??null;
  const round=season?(await tx.query<RoundRecord>(`SELECT * FROM rounds WHERE guild_id=$1 AND season_id=$2
   ORDER BY CASE WHEN coalesce((schedule->>'researchOpen')::timestamptz,created_at)<=$3 THEN 0 ELSE 1 END,
   CASE WHEN coalesce((schedule->>'researchOpen')::timestamptz,created_at)<=$3 THEN coalesce((schedule->>'researchOpen')::timestamptz,created_at) END DESC,
   CASE WHEN coalesce((schedule->>'researchOpen')::timestamptz,created_at)>$3 THEN coalesce((schedule->>'researchOpen')::timestamptz,created_at) END ASC,number DESC LIMIT 1`,[guildId,season.id,now])).rows[0]??null:null;
  const binding=(await tx.query<{chat_id:string;topic_id:string|null;group_url:string|null;active:boolean}>('SELECT chat_id,topic_id,group_url,active FROM group_bindings WHERE guild_id=$1',[guildId])).rows[0]??null;
  const positions=(await tx.query<{id:string;state:string;mode:string;created_at:Date}>("SELECT p.id,p.state,p.mode,p.created_at FROM positions p JOIN order_intents i ON i.id=p.intent_id WHERE p.user_id=$1 AND i.guild_id=$2 AND p.state NOT IN ('settled','withdrawn','closed') ORDER BY p.created_at,p.id LIMIT 100",[userId,guildId])).rows;
  return {guild,season,round,nextAction:round?nextRoundAction(round,now):null,binding,positions,membership:scope.membership,canResearch:canContributeResearch(scope.membership)};
 });
}
