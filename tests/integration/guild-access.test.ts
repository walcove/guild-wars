import {afterAll,beforeAll,expect,it} from 'vitest';
import type {Pool} from 'pg';
import {testPool} from './helpers/database';
import {syntheticGuild} from './helpers/fixtures';
import {bindGroup,type GroupVerifier} from '../../src/server/services/bind-group';
import {createInvitation,acceptInvitation,setMemberStatus} from '../../src/server/services/membership';
import {guildOverview} from '../../src/server/services/guilds';
let db:Pool;beforeAll(()=>{db=testPool();});afterAll(async()=>{await db.end();});
const verifier:GroupVerifier={botId:'9001',verify:async(chatId,actorTelegramId)=>({chatId,actorTelegramId,botTelegramId:'9001',type:'supergroup',actorStatus:'administrator',botStatus:'administrator',observedAt:new Date().toISOString(),groupUrl:null,isForum:false}),member:async(chatId,telegramId)=>({chatId,telegramId,status:'member',botStatus:'administrator',observedAt:new Date().toISOString()})};
it('denies forwarded private URLs, then admits an invited group member without a wallet or research role',async()=>{
 const a=await syntheticGuild(db),b=await syntheticGuild(db),chat='-2'+Date.now().toString();
 await expect(guildOverview(db,b.userId,a.guildId)).rejects.toMatchObject({code:'forbidden'});
 await bindGroup(db,a.userId,a.guildId,chat,null,verifier);
 const invite=await createInvitation(db,a.userId,a.guildId);
 await acceptInvitation(db,b.userId,invite.token,verifier);await acceptInvitation(db,b.userId,invite.token,verifier);
 const view=await guildOverview(db,b.userId,a.guildId);expect(view.canResearch).toBe(true);expect(view.membership.role).toBe('member');
 await setMemberStatus(db,a.userId,a.guildId,b.userId,'suspended');
 await expect(guildOverview(db,b.userId,a.guildId)).rejects.toMatchObject({code:'forbidden'});
 await expect(acceptInvitation(db,b.userId,invite.token,verifier)).rejects.toMatchObject({code:'membership_restricted'});
});
it('does not activate a user who is absent from the Telegram group',async()=>{
 const a=await syntheticGuild(db),b=await syntheticGuild(db);await bindGroup(db,a.userId,a.guildId,'-3'+Date.now().toString(),null,verifier);
 const invite=await createInvitation(db,a.userId,a.guildId);
 await expect(acceptInvitation(db,b.userId,invite.token,{...verifier,member:async(c,t)=>({chatId:c,telegramId:t,status:'left',botStatus:'administrator',observedAt:new Date().toISOString()})})).rejects.toMatchObject({code:'group_membership_required'});
 expect((await db.query('SELECT * FROM memberships WHERE guild_id=$1 AND user_id=$2',[a.guildId,b.userId])).rowCount).toBe(0);
});
