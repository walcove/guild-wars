import {afterAll,beforeAll,expect,it} from 'vitest';
import type {Pool} from 'pg';
import {testPool} from './helpers/database';
import {syntheticGuild} from './helpers/fixtures';
import {bindGroup,type GroupVerifier} from '../../src/server/services/bind-group';
let db:Pool;beforeAll(()=>{db=testPool();});afterAll(async()=>{await db.end();});
const verifier:GroupVerifier={botId:'9001',verify:async(chatId,actorTelegramId)=>({chatId,actorTelegramId,botTelegramId:'9001',type:'supergroup',actorStatus:chatId==='-200'?'member':'administrator',botStatus:'administrator',observedAt:new Date().toISOString(),groupUrl:null,isForum:false}),member:async(chatId,telegramId)=>({chatId,telegramId,status:'member',botStatus:'administrator',observedAt:new Date().toISOString()})};
it('requires both current guild administration and administration of the exact Telegram group',async()=>{
 const a=await syntheticGuild(db),b=await syntheticGuild(db);
 await expect(bindGroup(db,a.userId,b.guildId,'-100',null,verifier)).rejects.toMatchObject({code:'forbidden'});
 await db.query("UPDATE memberships SET role='member' WHERE guild_id=$1 AND user_id=$2",[a.guildId,a.userId]);
 await expect(bindGroup(db,a.userId,a.guildId,'-100',null,verifier)).rejects.toMatchObject({code:'forbidden'});
 await db.query("UPDATE memberships SET role='administrator' WHERE guild_id=$1 AND user_id=$2",[a.guildId,a.userId]);
 await expect(bindGroup(db,a.userId,a.guildId,'-200',null,verifier)).rejects.toMatchObject({code:'group_admin_required'});
 await bindGroup(db,a.userId,a.guildId,'-100'+BigInt('0x'+a.guildId.replaceAll('-','').slice(0,8)).toString(),null,verifier);
 expect((await db.query('SELECT method,active FROM group_bindings WHERE guild_id=$1',[a.guildId])).rows[0]).toMatchObject({method:'getChatMember',active:true});
});
it('does not hijack an already-bound chat or accept an unverified/mismatched proof',async()=>{
 const a=await syntheticGuild(db),b=await syntheticGuild(db),chat='-1'+Date.now().toString();
 await bindGroup(db,a.userId,a.guildId,chat,null,verifier);
 await expect(bindGroup(db,b.userId,b.guildId,chat,null,verifier)).rejects.toMatchObject({code:'binding_conflict'});
 const mismatch={...verifier,verify:async(c:string,t:string)=>({...await verifier.verify(c,t),actorTelegramId:'999'})};
 await expect(bindGroup(db,b.userId,b.guildId,'-999',null,mismatch)).rejects.toMatchObject({code:'invalid_group_proof'});
});
