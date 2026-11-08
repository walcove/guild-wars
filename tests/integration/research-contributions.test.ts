import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,expect,it} from 'vitest';
import type {Pool} from 'pg';
import {testPool} from './helpers/database';
import {syntheticGuild} from './helpers/fixtures';
import {createNote,editNote,listNotes} from '../../src/server/services/research-notes';
let db:Pool;beforeAll(()=>{db=testPool();});afterAll(async()=>{await db.end();});
const content={sourceUrl:'https://status.solana.com/',claim:'Synthetic claim for testing only',uncertainty:'Synthetic uncertainty; not a forecast',disclosures:'No position; synthetic fixture',opposingView:'The opposite may happen',proposalVersionId:null};
it('lets every active member contribute and revise, while enforcing author and guild scope',async()=>{
 const a=await syntheticGuild(db),b=await syntheticGuild(db);await db.query("INSERT INTO memberships(guild_id,user_id,role,status) VALUES($1,$2,'member','active')",[a.guildId,b.userId]);
 const requestId=randomUUID(),n=await createNote(db,b.userId,a.guildId,a.roundId,{...content,requestId});expect(await createNote(db,b.userId,a.guildId,a.roundId,{...content,requestId})).toMatchObject({id:n.id,revision:1});
 await editNote(db,b.userId,a.guildId,n.id,{...content,claim:'Revised synthetic claim'},1);
 await expect(editNote(db,b.userId,a.guildId,n.id,content,1)).rejects.toMatchObject({code:'draft_conflict'});
 await expect(editNote(db,a.userId,a.guildId,n.id,content,2)).rejects.toMatchObject({code:'forbidden'});
 expect((await listNotes(db,b.userId,a.guildId,a.roundId)).notes[0]).toMatchObject({claim:'Revised synthetic claim',revision:2});
 expect((await db.query('SELECT count(*)::int n FROM research_revisions WHERE note_id=$1',[n.id])).rows[0].n).toBe(2);
 await db.query("UPDATE memberships SET status='suspended' WHERE guild_id=$1 AND user_id=$2",[a.guildId,b.userId]);
 await expect(createNote(db,b.userId,a.guildId,a.roundId,{...content,requestId:randomUUID()})).rejects.toMatchObject({code:'forbidden'});
 await expect(listNotes(db,b.userId,a.guildId,a.roundId)).rejects.toMatchObject({code:'forbidden'});
});
it('rejects cross-guild version attachments and unsafe sources; paginates a stable round cursor',async()=>{
 const a=await syntheticGuild(db),b=await syntheticGuild(db);
 await expect(createNote(db,a.userId,a.guildId,a.roundId,{...content,requestId:randomUUID(),proposalVersionId:b.versionId})).rejects.toMatchObject({code:'version_unavailable'});
 await expect(createNote(db,a.userId,a.guildId,a.roundId,{...content,requestId:randomUUID(),sourceUrl:'javascript:alert(1)'})).rejects.toThrow();
 for(let i=0;i<4;i++){const note=await createNote(db,a.userId,a.guildId,a.roundId,{...content,requestId:randomUUID(),claim:'Synthetic ordered claim '+i});await db.query("UPDATE research_notes SET created_at='2026-11-07T12:00:00.123100Z'::timestamptz+$2::int*interval '1 microsecond' WHERE id=$1",[note.id,i]);}
 const first=await listNotes(db,a.userId,a.guildId,a.roundId,{limit:2});expect(first.notes).toHaveLength(2);expect(first.nextCursor).toBeTruthy();
 const second=await listNotes(db,a.userId,a.guildId,a.roundId,{limit:2,cursor:first.nextCursor!});expect(second.notes).toHaveLength(2);expect(new Set([...first.notes,...second.notes].map(n=>n.id)).size).toBe(4);
 await expect(listNotes(db,b.userId,b.guildId,b.roundId,{cursor:first.nextCursor!})).rejects.toMatchObject({code:'invalid_cursor'});
 await expect(listNotes(db,b.userId,a.guildId,a.roundId)).rejects.toMatchObject({code:'forbidden'});
});
