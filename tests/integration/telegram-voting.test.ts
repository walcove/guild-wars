import {transaction} from '../../src/server/db/client';
import {ballotCallback} from '../../src/server/telegram/ballot-callbacks';
import {supersedeBallot} from '../../src/server/services/ballots';
import {queueBallotNotification,replaceBallotMessage} from '../../src/server/services/ballot-notifications';
import {deliverBallotNotifications} from '../../src/server/jobs/deliver-ballot';
import {afterAll,beforeAll,expect,it} from 'vitest';
import type {Pool} from 'pg';
import {testPool} from './helpers/database';
import {syntheticGuild} from './helpers/fixtures';
import {syntheticBallot} from './helpers/ballots';
import {castVote,ballotView} from '../../src/server/services/ballots';
import {publicBallotSnapshot} from '../../src/server/services/ballot-snapshot';
import {ballotCard} from '../../src/server/telegram/ballot-messages';
let db:Pool;beforeAll(()=>{db=testPool();});afterAll(async()=>{await db.end();});
it('keeps public messages participation-only while each authenticated member sees only their own receipt',async()=>{
 const b=await syntheticGuild(db),f=await syntheticBallot(db,60000,false,[b]);await castVote(db,f.callToken,f.actor,'9001');await castVote(db,f.holdToken,{...f.actor,telegramId:b.telegramId},'9001');
 const publicView=await publicBallotSnapshot(db,f.id),card=ballotCard(publicView,'http://127.0.0.1:3000');expect(publicView.participation).toBe(2);expect(publicView.outcome).toBeNull();expect(card.text).not.toContain('Saved:');expect(card.text).not.toContain('Call A: 1');expect(JSON.stringify(publicView)).not.toContain(b.userId);
 const aReceipt=await ballotView(db,f.userId,f.id),bReceipt=await ballotView(db,b.userId,f.id);expect(aReceipt.ownReceipt?.choiceId).toBe(f.call);expect(bReceipt.ownReceipt?.choiceId).toBe(f.hold);expect(aReceipt.counts).toBeNull();expect(bReceipt.counts).toBeNull();
 const stranger=await syntheticGuild(db);await expect(ballotView(db,stranger.userId,f.id)).rejects.toMatchObject({code:'forbidden'});
});
it('queues only exact-bot opted-in private receipts and commits votes despite an uncertain public edit',async()=>{
 const f=await syntheticBallot(db);await db.query("INSERT INTO bot_starts(bot_id,telegram_id) VALUES('9001',$1)",[f.telegramId]);await queueBallotNotification(db,f.id);let sends=0,edits=0;const config={botId:'9001',username:'guild_test_bot',secret:'s'.repeat(32),origin:'http://127.0.0.1:3000'},transport={send:async()=>{sends++;return {messageId:'700'};},edit:async()=>{edits++;throw Error('connection lost');},answer:async()=>{}};
 await deliverBallotNotifications(db,'ballot:'+f.id,config,transport);expect(sends).toBe(1);
 await castVote(db,f.callToken,f.actor,'9001');await deliverBallotNotifications(db,'ballot:'+f.id,config,transport);expect(edits).toBe(1);expect((await ballotView(db,f.userId,f.id)).ownReceipt?.choiceId).toBe(f.call);
 const receipt=(await db.query("SELECT operation_id FROM ballot_deliveries WHERE ballot_id=$1 AND kind='private_receipt'",[f.id])).rows[0];expect(receipt).toBeTruthy();await deliverBallotNotifications(db,receipt.operation_id,config,transport);await deliverBallotNotifications(db,receipt.operation_id,config,transport);expect(sends).toBe(2);
 await db.query("UPDATE bot_starts SET blocked_at=clock_timestamp() WHERE bot_id='9001' AND telegram_id=$1",[f.telegramId]);await castVote(db,f.holdToken,f.actor,'9001');expect((await db.query("SELECT count(*)::int n FROM ballot_deliveries WHERE ballot_id=$1 AND kind='private_receipt'",[f.id])).rows[0].n).toBe(1);
});
it('does not blindly resend an unknown first message, and blocks a changed bot or departed recipient',async()=>{
 const f=await syntheticBallot(db);await queueBallotNotification(db,f.id);let sends=0;const config={botId:'9001',username:'guild_test_bot',secret:'s'.repeat(32),origin:'http://127.0.0.1:3000'},transport={send:async()=>{sends++;throw Error('unknown acknowledgement');},answer:async()=>{}};await deliverBallotNotifications(db,'ballot:'+f.id,config,transport);await deliverBallotNotifications(db,'ballot:'+f.id,config,transport);expect(sends).toBe(1);await replaceBallotMessage(db,f.userId,f.id,'Synthetic explicit unknown-send replacement');const replacement=(await db.query("SELECT operation_id FROM ballot_deliveries WHERE ballot_id=$1 AND operation_id<>$2",[f.id,'ballot:'+f.id])).rows[0];let replacementText='';await deliverBallotNotifications(db,replacement.operation_id,config,{...transport,send:async(_chat,text)=>{replacementText=text;return {messageId:'701'};}});expect(replacementText).toContain('Marked replacement');expect((await db.query('SELECT count(*)::int n FROM ballots WHERE id=$1',[f.id])).rows[0].n).toBe(1);
 await db.query("INSERT INTO bot_starts(bot_id,telegram_id) VALUES('other-bot',$1)",[f.telegramId]);await castVote(db,f.callToken,f.actor,'9001');expect((await db.query("SELECT count(*)::int n FROM ballot_deliveries WHERE ballot_id=$1 AND kind='private_receipt'",[f.id])).rows[0].n).toBe(0);
});

it('returns distinct closed, superseded and ineligible feedback without accepting another vote',async()=>{
 const closed=await syntheticBallot(db,-1);expect((await transaction(db,tx=>ballotCallback(tx,closed.callToken,closed.actor,'9001'))).status).toBe('closed');
 const replaced=await syntheticBallot(db);await supersedeBallot(db,replaced.userId,replaced.id,'Synthetic message replacement');expect((await transaction(db,tx=>ballotCallback(tx,replaced.callToken,replaced.actor,'9001'))).status).toBe('superseded');
 const f=await syntheticBallot(db);expect((await transaction(db,tx=>ballotCallback(tx,f.callToken,{...f.actor,telegramId:'999999999'},'9001'))).status).toBe('ineligible');expect((await db.query('SELECT count(*)::int n FROM votes WHERE ballot_id=$1',[f.id])).rows[0].n).toBe(0);
});
