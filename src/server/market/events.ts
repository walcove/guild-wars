import {z} from 'zod';
import type {Pool} from 'pg';
import {inGuild} from '../db/repositories';
import {sourceUrl} from '../../domain/source-url';
import {utcSchema} from '../../domain/types';
import {audit} from '../services/audit';
export const eventInput=z.object({title:z.string().trim().min(3).max(160),sourceUrl:z.string().max(2048),scheduledAt:utcSchema,lastCheckedAt:utcSchema,relevance:z.string().trim().min(5).max(1000),uncertainty:z.string().trim().min(3).max(1000)}).strict();
export async function addCuratedEvent(db:Pool,userId:string,guildId:string,input:z.infer<typeof eventInput>):Promise<{id:string}> {
 const e=eventInput.parse(input),url=sourceUrl(e.sourceUrl);return inGuild(db,userId,guildId,async tx=>{const row=(await tx.query<{id:string}>('INSERT INTO curated_events(guild_id,author_id,title,source_url,scheduled_at,last_checked_at,relevance,uncertainty) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',[guildId,userId,e.title,url,e.scheduledAt,e.lastCheckedAt,e.relevance,e.uncertainty])).rows[0];await audit(tx,{actorId:userId,guildId,kind:'event_curated',recordId:row.id,reason:'Member supplied a checked original source and explicit uncertainty'});return row;});
}
export async function listCuratedEvents(db:Pool,userId:string,guildId:string,end:Date){return inGuild(db,userId,guildId,async tx=>(await tx.query<{id:string;title:string;source_url:string;scheduled_at:Date;last_checked_at:Date;relevance:string;uncertainty:string;author_id:string}>('SELECT id,title,source_url,scheduled_at,last_checked_at,relevance,uncertainty,author_id FROM curated_events WHERE guild_id=$1 AND scheduled_at<=$2 ORDER BY scheduled_at DESC,id DESC LIMIT 100',[guildId,end])).rows);}
