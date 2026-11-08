import type {Pool} from 'pg';
import {z} from 'zod';
import {invariant,DomainError} from '../../domain/errors';
import {sourceUrl} from '../../domain/source-url';
import {inGuild} from '../db/repositories';
import type {Tx} from '../db/client';
const text=(min:number,max:number)=>z.string().trim().min(min).max(max).refine(v=>!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v),'Remove control characters');
export const noteContentSchema=z.object({sourceUrl:z.string().max(2048),claim:text(5,1500),uncertainty:text(3,1000),disclosures:text(2,1000),opposingView:text(0,1500).nullable().optional(),proposalVersionId:z.uuid().nullable()}).strict();
export type NoteContent=z.infer<typeof noteContentSchema>;
export const createNoteSchema=noteContentSchema.extend({requestId:z.uuid()});
function normalize(input:NoteContent):NoteContent {const c=noteContentSchema.parse(input);return {sourceUrl:sourceUrl(c.sourceUrl),claim:c.claim,uncertainty:c.uncertainty,disclosures:c.disclosures,opposingView:c.opposingView||null,proposalVersionId:c.proposalVersionId};}
async function checkVersion(tx:Tx,guildId:string,roundId:string,version:string|null){if(version)invariant((await tx.query('SELECT id FROM proposal_versions WHERE id=$1 AND guild_id=$2 AND round_id=$3',[version,guildId,roundId])).rowCount===1,'version_unavailable','Attach evidence only to a proposal version in this guild and round');}
export async function createNote(db:Pool,userId:string,guildId:string,roundId:string,input:NoteContent&{requestId:string}):Promise<{id:string;revision:number}> {
 const {requestId,...raw}=createNoteSchema.parse(input),content=normalize(raw);
 return inGuild(db,userId,guildId,async tx=>{
  invariant((await tx.query('SELECT id FROM rounds WHERE id=$1 AND guild_id=$2',[roundId,guildId])).rowCount===1,'round_unavailable','Round unavailable in this guild');await checkVersion(tx,guildId,roundId,content.proposalVersionId);
  const added=(await tx.query<{id:string;revision:number}>('INSERT INTO research_notes(request_id,guild_id,round_id,author_id,proposal_version_id,source_url,claim,uncertainty,disclosures,opposing_view,revision) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,1) ON CONFLICT(author_id,request_id) DO NOTHING RETURNING id,revision',[requestId,guildId,roundId,userId,content.proposalVersionId,content.sourceUrl,content.claim,content.uncertainty,content.disclosures,content.opposingView])).rows[0];
  if(added){await tx.query('INSERT INTO research_revisions(note_id,content,revision) VALUES($1,$2::jsonb,1)',[added.id,JSON.stringify(content)]);return added;}
  const existing=(await tx.query<{id:string;revision:number;guild_id:string;round_id:string;content:NoteContent}>('SELECT n.id,n.revision,n.guild_id,n.round_id,r.content FROM research_notes n JOIN research_revisions r ON r.note_id=n.id AND r.revision=1 WHERE n.author_id=$1 AND n.request_id=$2',[userId,requestId])).rows[0];
  invariant(existing&&existing.guild_id===guildId&&existing.round_id===roundId&&JSON.stringify(normalize(existing.content))===JSON.stringify(content),'request_conflict','This saved request has different content; start a new contribution');return {id:existing.id,revision:existing.revision};
 });
}
export async function editNote(db:Pool,userId:string,guildId:string,noteId:string,input:NoteContent,expectedRevision:number):Promise<void> {
 const content=normalize(input);z.number().int().positive().parse(expectedRevision);
 await inGuild(db,userId,guildId,async tx=>{
  const row=(await tx.query<{author_id:string;round_id:string;revision:number}>('SELECT author_id,round_id,revision FROM research_notes WHERE id=$1 AND guild_id=$2 FOR UPDATE',[noteId,guildId])).rows[0];invariant(row?.author_id===userId,'forbidden','Only the author can revise this evidence; others may add a counterargument');invariant(row.revision===expectedRevision,'draft_conflict','This evidence has a newer revision. Keep your text and compare with the saved revision before retrying');await checkVersion(tx,guildId,row.round_id,content.proposalVersionId);
  await tx.query('INSERT INTO research_revisions(note_id,content,revision) VALUES($1,$2::jsonb,$3)',[noteId,JSON.stringify(content),row.revision+1]);
  await tx.query('UPDATE research_notes SET source_url=$2,claim=$3,uncertainty=$4,disclosures=$5,opposing_view=$6,proposal_version_id=$7,revision=revision+1 WHERE id=$1',[noteId,content.sourceUrl,content.claim,content.uncertainty,content.disclosures,content.opposingView,content.proposalVersionId]);
 });
}
export interface NoteRecord extends NoteContent {id:string;authorId:string;createdAt:Date;revision:number}
const cursorSchema=z.object({guild:z.uuid(),round:z.uuid(),time:z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/).refine(v=>Number.isFinite(Date.parse(v))),id:z.uuid()}).strict();
export async function listNotes(db:Pool,userId:string,guildId:string,roundId:string,options:{limit?:number;cursor?:string}={}):Promise<{notes:NoteRecord[];nextCursor:string|null}> {
 return inGuild(db,userId,guildId,async tx=>{
  invariant((await tx.query('SELECT id FROM rounds WHERE id=$1 AND guild_id=$2',[roundId,guildId])).rowCount===1,'round_unavailable','Round unavailable in this guild');
  const limit=Math.min(100,Math.max(1,Math.floor(options.limit??25)));invariant(Number.isFinite(limit),'invalid_input','Use a valid page size');let cursor:z.infer<typeof cursorSchema>|null=null;
  if(options.cursor){try{invariant(options.cursor.length<=512,'invalid_cursor','Invalid cursor');cursor=cursorSchema.parse(JSON.parse(Buffer.from(options.cursor,'base64url').toString('utf8')));invariant(cursor.guild===guildId&&cursor.round===roundId,'invalid_cursor','Cursor belongs to another round');}catch{throw new DomainError('invalid_cursor','Reload this round to restart the evidence list');}}
  const result=(await tx.query<NoteRecord&{cursorAt:string}>(`SELECT to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "cursorAt",id,author_id AS "authorId",created_at AS "createdAt",revision,source_url AS "sourceUrl",claim,uncertainty,disclosures,opposing_view AS "opposingView",proposal_version_id AS "proposalVersionId" FROM research_notes WHERE guild_id=$1 AND round_id=$2 AND ($3::timestamptz IS NULL OR (created_at,id)<($3::timestamptz,$4::uuid)) ORDER BY created_at DESC,id DESC LIMIT $5`,[guildId,roundId,cursor?.time??null,cursor?.id??null,limit+1])).rows;
  const notes=result.slice(0,limit),last=notes.at(-1),nextCursor=result.length>limit&&last?Buffer.from(JSON.stringify({guild:guildId,round:roundId,time:last.cursorAt,id:last.id})).toString('base64url'):null;return {notes,nextCursor};
 });
}
