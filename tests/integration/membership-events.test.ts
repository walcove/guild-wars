import {afterAll,beforeAll,expect,it} from 'vitest';
import type {Pool} from 'pg';
import {testPool} from './helpers/database';
import {syntheticGuild} from './helpers/fixtures';
import {processUpdate} from '../../src/server/telegram/webhook';
let db:Pool;beforeAll(()=>{db=testPool();});afterAll(async()=>{await db.end();});
const config={botId:'9001',secret:'s'.repeat(40),username:'synthetic_bot',origin:'http://127.0.0.1:3000'};
const transport={send:async()=>{throw Error('Never send');},answer:async()=>{throw Error('No callback');}};
it('revokes departed access synchronously and never restores a suspended user from chat events',async()=>{
 const f=await syntheticGuild(db),chat=-Number('1'+Date.now());
 await db.query("INSERT INTO group_bindings(guild_id,chat_id,administrator_id,method,verified_at,bot_id) VALUES($1,$2,$3,'synthetic',clock_timestamp(),'9001')",[f.guildId,chat.toString(),f.userId]);
 const event=(n:number,status:string)=>({update_id:n,chat_member:{chat:{id:chat,type:'supergroup'},new_chat_member:{user:{id:Number(f.telegramId)},status}}});
 const n=Date.now();await processUpdate(db,config.secret,event(n,'left'),config,transport);
 expect((await db.query('SELECT status FROM memberships WHERE guild_id=$1 AND user_id=$2',[f.guildId,f.userId])).rows[0].status).toBe('departed');
 await db.query("UPDATE memberships SET status='suspended' WHERE guild_id=$1 AND user_id=$2",[f.guildId,f.userId]);
 await processUpdate(db,config.secret,event(n+1,'member'),config,transport);
 expect((await db.query('SELECT status FROM memberships WHERE guild_id=$1 AND user_id=$2',[f.guildId,f.userId])).rows[0].status).toBe('suspended');
 expect((await db.query('SELECT count(*)::int n FROM consumed_updates WHERE bot_id=$1 AND update_id IN ($2,$3)',[config.botId,n.toString(),(n+1).toString()])).rows[0].n).toBe(2);
});
it('pauses the binding when the configured bot loses administrator access',async()=>{
 const f=await syntheticGuild(db),chat=-Number('2'+Date.now());
 await db.query("INSERT INTO group_bindings(guild_id,chat_id,administrator_id,method,verified_at,bot_id) VALUES($1,$2,$3,'synthetic',clock_timestamp(),'9001')",[f.guildId,chat.toString(),f.userId]);
 await processUpdate(db,config.secret,{update_id:Date.now()+2,my_chat_member:{chat:{id:chat,type:'supergroup'},new_chat_member:{user:{id:9001},status:'member'}}},config,transport);
 expect((await db.query('SELECT active FROM group_bindings WHERE guild_id=$1',[f.guildId])).rows[0].active).toBe(false);
});
