import {afterAll,beforeAll,expect,it} from 'vitest';
import type {Pool} from 'pg';
import {testPool} from './helpers/database';
import {syntheticProposal} from './helpers/proposals';
import {syntheticGuild} from './helpers/fixtures';
import {publishProposal} from '../../src/server/services/publish-proposal';
import {deliverProposal} from '../../src/server/jobs/publish-telegram';
import {researchCommandCard} from '../../src/server/telegram/research-commands';
import {processUpdate} from '../../src/server/telegram/webhook';
import {deliverCommand} from '../../src/server/telegram/commands';
let db:Pool;beforeAll(()=>{db=testPool();});afterAll(async()=>{await db.end();});
const config={botId:'9001',origin:'http://127.0.0.1:3000',username:'synthetic_bot',secret:'s'.repeat(40)},transport={send:async()=>({messageId:'99'}),answer:async()=>{}};
it('handles explicit sourced replies once against the exact proposal version and retains no replied chat body',async()=>{
 const f=await syntheticProposal(db),p=f.proposal,d=await publishProposal(db,f.userId,p.id,p.revision,p.reviewHash);await deliverProposal(db,d.id,config,transport);
 const id=Date.now(),update={update_id:id,message:{message_id:100,from:{id:Number(f.telegramId)},chat:{id:Number(f.chatId),type:'supergroup'},reply_to_message:{message_id:99,text:'Unrelated secret reply body never retained'},text:'/note https://status.solana.com/ | Synthetic sourced claim | Synthetic uncertainty | No real position'}};
 const receipt=await processUpdate(db,config.secret,update,config,transport);await deliverCommand(db,receipt.operationId!,config,transport);await processUpdate(db,config.secret,update,config,transport);await deliverCommand(db,receipt.operationId!,config,transport);
 const notes=(await db.query('SELECT proposal_version_id,claim FROM research_notes WHERE guild_id=$1',[f.guildId])).rows;expect(notes).toHaveLength(1);expect(notes[0].proposal_version_id).toBe(d.versionId);
 const retained=(await db.query('SELECT record FROM operations WHERE id=$1',[receipt.operationId])).rows[0].record;expect(JSON.stringify(retained)).not.toContain('Unrelated secret');
});
it('returns exact plan/research links only for current members of the configured group',async()=>{
 const f=await syntheticProposal(db),p=f.proposal,d=await publishProposal(db,f.userId,p.id,p.revision,p.reviewHash);await deliverProposal(db,d.id,config,transport);
 const command={command:'plan',senderId:f.telegramId,chatId:f.chatId,chatType:'supergroup'};
 const card=await researchCommandCard(db,command,config);expect(JSON.stringify(card.buttons)).toContain(`version=${d.versionId}`);
 const outsider=await syntheticGuild(db);const denied=await researchCommandCard(db,{...command,senderId:outsider.telegramId},config);expect(JSON.stringify(denied)).not.toContain(d.versionId);
 await db.query("UPDATE memberships SET status='suspended' WHERE guild_id=$1 AND user_id=$2",[f.guildId,f.userId]);expect(JSON.stringify(await researchCommandCard(db,command,config))).not.toContain(d.versionId);
});
