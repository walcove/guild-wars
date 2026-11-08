import {GrammyError} from 'grammy';
import {afterAll,beforeAll,expect,it} from 'vitest';
import type {Pool} from 'pg';
import {testPool} from './helpers/database';
import {syntheticProposal} from './helpers/proposals';
import {syntheticGuild} from './helpers/fixtures';
import {inGuild} from '../../src/server/db/repositories';
import {publishProposal,publishProposalInTx,publicationView,replacePublication,reportDiscussionUnavailable} from '../../src/server/services/publish-proposal';
import {deliverProposal} from '../../src/server/jobs/publish-telegram';
let db:Pool;beforeAll(()=>{db=testPool();});afterAll(async()=>{await db.end();});
const config={origin:'http://127.0.0.1:3000',botId:'9001',username:'synthetic_bot',secret:'s'.repeat(40)};
it('rolls back version and outbox together, then publishes once only after message acknowledgement',async()=>{
 const f=await syntheticProposal(db),p=f.proposal;
 await expect(inGuild(db,f.userId,f.guildId,async tx=>{await publishProposalInTx(tx,f.userId,p.id,p.revision,p.reviewHash);throw Error('Synthetic rollback');})).rejects.toThrow('Synthetic rollback');
 expect((await db.query('SELECT id FROM proposal_versions WHERE proposal_id=$1',[p.id])).rowCount).toBe(0);
 const delivery=await publishProposal(db,f.userId,p.id,p.revision,p.reviewHash);expect(delivery.state).toBe('pending');let sends=0;
 await deliverProposal(db,delivery.id,config,{send:async(chat,text,buttons)=>{sends++;expect(chat).toBe(f.chatId);expect(text).toContain('Hypothetical');expect(JSON.stringify(buttons)).toContain(`version=${delivery.versionId}`);expect((await db.query('SELECT state FROM telegram_deliveries WHERE id=$1',[delivery.id])).rows[0].state).toBe('sending');return {messageId:'42'};},answer:async()=>{}});
 await deliverProposal(db,delivery.id,config,{send:async()=>{sends++;throw Error('Duplicate');},answer:async()=>{}});expect(sends).toBe(1);
 const view=await publicationView(db,f.userId,p.id,delivery.versionId);expect(view.deliveries[0]).toMatchObject({state:'published',message_id:'42'});
 expect((await publishProposal(db,f.userId,p.id,p.revision,p.reviewHash)).id).toBe(delivery.id);
 const other=await syntheticGuild(db);await expect(publicationView(db,other.userId,p.id,delivery.versionId)).rejects.toMatchObject({code:'forbidden'});
});
it('keeps ambiguous sends Unknown and requires an explicit marked replacement of the same version',async()=>{
 const f=await syntheticProposal(db),p=f.proposal,d=await publishProposal(db,f.userId,p.id,p.revision,p.reviewHash);let sends=0;
 const timeout={send:async()=>{sends++;throw Error('Synthetic ambiguous timeout');},answer:async()=>{}};
 await deliverProposal(db,d.id,config,timeout);await deliverProposal(db,d.id,config,timeout);expect(sends).toBe(1);
 expect((await publicationView(db,f.userId,p.id,d.versionId)).deliveries[0].state).toBe('unknown');
 const replacement=await replacePublication(db,f.userId,p.id,d.id);expect(replacement.versionId).toBe(d.versionId);
 await deliverProposal(db,replacement.id,config,{send:async(_chat,text)=>{expect(text).toContain('Replacement');return {messageId:'43'};},answer:async()=>{}});
 await reportDiscussionUnavailable(db,f.userId,p.id,replacement.id);
 const view=await publicationView(db,f.userId,p.id,d.versionId);expect(view.deliveries[0].state).toBe('reported_unavailable');expect(view.groupUrl).toBeNull();
 expect((await db.query('SELECT count(*)::int n FROM proposal_versions WHERE proposal_id=$1',[p.id])).rows[0].n).toBe(1);
});
it('does not send a queued private proposal into a changed or paused group binding',async()=>{
 const f=await syntheticProposal(db),p=f.proposal,d=await publishProposal(db,f.userId,p.id,p.revision,p.reviewHash);await db.query('UPDATE group_bindings SET active=false WHERE guild_id=$1',[f.guildId]);let sent=false;
 await deliverProposal(db,d.id,config,{send:async()=>{sent=true;return {messageId:'44'};},answer:async()=>{}});expect(sent).toBe(false);expect((await publicationView(db,f.userId,p.id,d.versionId)).deliveries[0].state).toBe('blocked');
});
it('blocks a queued delivery when its verified bot identity changes',async()=>{
 const f=await syntheticProposal(db),p=f.proposal,d=await publishProposal(db,f.userId,p.id,p.revision,p.reviewHash);let calls=0;
 await deliverProposal(db,d.id,{...config,botId:'9002'},{send:async()=>{calls++;return {messageId:'45'};},answer:async()=>{}});expect(calls).toBe(0);expect((await publicationView(db,f.userId,p.id,d.versionId)).deliveries[0].state).toBe('blocked');
});

it('retains a definitive Telegram rejection without reporting Published or automatically resending',async()=>{
 const f=await syntheticProposal(db),p=f.proposal,d=await publishProposal(db,f.userId,p.id,p.revision,p.reviewHash);let calls=0;
 const transport={send:async()=>{calls++;throw new GrammyError('synthetic rejected',{ok:false,error_code:403,description:'synthetic rejected'},'sendMessage',{});},answer:async()=>{}};
 await deliverProposal(db,d.id,config,transport);await deliverProposal(db,d.id,config,transport);expect(calls).toBe(1);expect((await publicationView(db,f.userId,p.id,d.versionId)).deliveries[0].state).toBe('failed');
});
