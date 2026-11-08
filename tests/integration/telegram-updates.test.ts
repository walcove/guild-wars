import {afterAll,beforeAll,expect,it} from 'vitest';
import type {Pool} from 'pg';
import {randomUUID} from 'node:crypto';
import {testPool} from './helpers/database';
import {processUpdate} from '../../src/server/telegram/webhook';
import {newBrowserSession} from '../../src/server/auth/sessions';
import {issueLink,confirmTelegramLink} from '../../src/server/services/link-telegram';
import {tokenHash} from '../../src/server/auth/crypto';
let db:Pool;const config={botId:'synthetic-'+randomUUID(),username:'SyntheticBot',secret:'s'.repeat(32),origin:'http://127.0.0.1:3000'};
beforeAll(()=>{db=testPool();});afterAll(async()=>{await db.end();});
const transport={send:async()=>({messageId:'1'}),answer:async()=>{}};
it('rejects a forged webhook secret before recording an update',async()=>{
 await expect(processUpdate(db,'wrong',{update_id:1},config,transport)).rejects.toMatchObject({code:'unauthorized'});
 expect((await db.query('SELECT * FROM consumed_updates WHERE bot_id=$1',[config.botId])).rowCount).toBe(0);
});
it('records a command and its real queue job once across webhook retries',async()=>{
 const update={update_id:10,message:{message_id:1,from:{id:101},chat:{id:101,type:'private'},text:'/help'}};
 const first=await processUpdate(db,config.secret,update,config,transport),again=await processUpdate(db,config.secret,update,config,transport);
 expect(again).toEqual(first);expect(first.status).toBe('queued');
 expect((await db.query('SELECT * FROM consumed_updates WHERE bot_id=$1 AND update_id=$2',[config.botId,'10'])).rowCount).toBe(1);
});
it('uses the authenticated callback sender, not a supplied user ID; feedback follows commit',async()=>{
 const session=await newBrowserSession(db),link=await issueLink(db,session.sessionToken,'/');
 const data='l:'+Buffer.from(tokenHash(link.token),'hex').toString('base64url');
 const update={update_id:20,callback_query:{id:'synthetic-callback',from:{id:101},message:{message_id:1,chat:{id:101,type:'private'}},data,user_id:'999'}};
 let acknowledged=false;
 const observing={...transport,answer:async()=>{expect((await db.query('SELECT telegram_id FROM link_challenges WHERE token_hash=$1',[tokenHash(link.token)])).rows[0].telegram_id).toBe('101');acknowledged=true;}};
 const receipt=await processUpdate(db,config.secret,update,config,observing);expect(receipt.status).toBe('proved');expect(acknowledged).toBe(true);
 expect(await processUpdate(db,config.secret,update,config,transport)).toEqual(receipt);
 expect((await confirmTelegramLink(db,session.sessionToken,link.token,undefined,'101')).userId).toBeTruthy();
});
it('rejects forwarded/wrong-context and oversized callback tokens without identity proof',async()=>{
 const base={update_id:30,callback_query:{id:'bad',from:{id:101},message:{message_id:1,chat:{id:-1001,type:'supergroup'}},data:'l:'+'x'.repeat(43)}};
 await expect(processUpdate(db,config.secret,base,config,transport)).rejects.toMatchObject({code:'callback_context'});
 await expect(processUpdate(db,config.secret,{...base,update_id:31,callback_query:{...base.callback_query,data:'x'.repeat(65)}},config,transport)).rejects.toMatchObject({code:'invalid_update'});
});
it('does not retain ordinary chat text or a raw linking nonce',async()=>{
 expect((await processUpdate(db,config.secret,{update_id:40,message:{message_id:1,from:{id:101},chat:{id:-1001,type:'supergroup'},text:'Ordinary private community conversation'}},config,transport)).status).toBe('ignored');
 expect((await db.query('SELECT * FROM consumed_updates WHERE bot_id=$1 AND update_id=$2',[config.botId,'40'])).rowCount).toBe(0);
 const session=await newBrowserSession(db),link=await issueLink(db,session.sessionToken,'/');
 const result=await processUpdate(db,config.secret,{update_id:41,message:{message_id:1,from:{id:101},chat:{id:101,type:'private'},text:`/start link_${link.token}`}},config,transport);
 const record=(await db.query('SELECT record FROM operations WHERE id=$1',[result.operationId])).rows[0].record;
 expect(JSON.stringify(record)).not.toContain(link.token);expect(record.challengeHash).toBe(tokenHash(link.token));
});
it('never acknowledges a proof that timed out waiting for its database lock',async()=>{
 const session=await newBrowserSession(db),link=await issueLink(db,session.sessionToken,'/'),client=await db.connect();
 await client.query('BEGIN');await client.query('SELECT token_hash FROM link_challenges WHERE token_hash=$1 FOR UPDATE',[tokenHash(link.token)]);
 let answered=false;const started=performance.now();
 try {
  await expect(processUpdate(db,config.secret,{update_id:50,callback_query:{id:'locked',from:{id:101},message:{message_id:1,chat:{id:101,type:'private'}},data:'l:'+Buffer.from(tokenHash(link.token),'hex').toString('base64url')}},config,{...transport,answer:async()=>{answered=true;}})).rejects.toMatchObject({code:'55P03'});
  expect(answered).toBe(false);expect(performance.now()-started).toBeLessThan(1300);
 }finally{await client.query('ROLLBACK');client.release();}
 expect((await db.query('SELECT * FROM consumed_updates WHERE bot_id=$1 AND update_id=$2',[config.botId,'50'])).rowCount).toBe(0);
});
it('delivers once after commit, retains ambiguous sends and does not use a different bot for queued work',async()=>{
 const {deliverCommand}=await import('../../src/server/telegram/commands');let sends=0,observedState='';
 const fresh=async(update_id:number)=>processUpdate(db,config.secret,{update_id,message:{message_id:1,from:{id:101},chat:{id:101,type:'private'},text:'/help'}},config,transport);
 const one=await fresh(60),observing={...transport,send:async()=>{sends++;observedState=(await db.query('SELECT state FROM operations WHERE id=$1',[one.operationId])).rows[0].state;return {messageId:'88'};}};
 await deliverCommand(db,one.operationId!,config,observing);await deliverCommand(db,one.operationId!,config,observing);expect(sends).toBe(1);expect(observedState).toBe('sending');
 const uncertain=await fresh(61);let attempted=0;
 const timeout={...transport,send:async()=>{attempted++;throw new Error('synthetic timeout after possible remote acceptance');}};
 await deliverCommand(db,uncertain.operationId!,config,timeout);await deliverCommand(db,uncertain.operationId!,config,timeout);
 expect(attempted).toBe(1);expect((await db.query('SELECT state FROM operations WHERE id=$1',[uncertain.operationId])).rows[0].state).toBe('unknown');
 const changed=await fresh(62);await deliverCommand(db,changed.operationId!,{...config,botId:'another-bot'},observing);expect(sends).toBe(1);
});
it('honors a definitive Telegram Retry-After without an immediate resend',async()=>{
 const {GrammyError}=await import('grammy');const {deliverCommand}=await import('../../src/server/telegram/commands');
 const update={update_id:70,message:{message_id:1,from:{id:101},chat:{id:101,type:'private'},text:'/help'}},queued=await processUpdate(db,config.secret,update,config,transport);
 const before=Date.now();let sends=0;
 await deliverCommand(db,queued.operationId!,config,{...transport,send:async()=>{sends++;throw new GrammyError('synthetic rate limit',{ok:false,error_code:429,description:'synthetic rate limit',parameters:{retry_after:3}},'sendMessage',{});}});
 const row=(await db.query('SELECT run_at FROM graphile_worker.jobs WHERE key=$1',[`telegram_command:${queued.operationId}`])).rows[0];
 expect(row.run_at.getTime()).toBeGreaterThanOrEqual(before+3000);
 await deliverCommand(db,queued.operationId!,config,{...transport,send:async()=>{sends++;return {messageId:'99'};}});expect(sends).toBe(1);
});
