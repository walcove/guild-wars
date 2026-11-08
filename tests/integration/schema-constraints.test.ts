import {afterAll,beforeAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import type {Pool,PoolClient} from 'pg';
import {testPool,expectConstraint} from './helpers/database';
let pool:Pool,client:PoolClient;
beforeAll(async()=>{pool=testPool();client=await pool.connect();});
afterAll(async()=>{client?.release();await pool?.end();});
it('enforces identity, tenant, mode, vote, fill and ledger constraints on actual PostgreSQL',async()=>{
 await client.query('BEGIN');
 const u=randomUUID(),g=randomUUID(),s=randomUUID(),r=randomUUID(),b=randomUUID(),c=randomUUID(),sl=randomUUID(),i=randomUUID(),p=randomUUID();
 try{
  await client.query("INSERT INTO users(id,telegram_id) VALUES($1,$2)",[u,BigInt('9000000000000000000').toString()]);
  await expectConstraint(client,'INSERT INTO users(telegram_id) VALUES($1)',['9000000000000000000']);
  await client.query("INSERT INTO guilds(id,name,owner_id) VALUES($1,'Synthetic guild',$2)",[g,u]);
  await client.query("INSERT INTO seasons(id,guild_id,mode,division,rules_version,rules) VALUES($1,$2,'simulation','synthetic','1','{}')",[s,g]);
  await client.query("INSERT INTO rounds(id,guild_id,season_id,mode,number,state,schedule,expires_at) VALUES($1,$2,$3,'simulation',1,'research','{}','2026-11-14T08:00:00Z')",[r,g,s]);
  await expectConstraint(client,"INSERT INTO rounds(guild_id,season_id,mode,number,state,schedule,expires_at) VALUES($1,$2,'live',2,'research','{}','2026-11-14T08:00:00Z')",[g,s]);
  await expectConstraint(client,"INSERT INTO proposals(guild_id,round_id,author_id,draft) VALUES($1,$2,$3,'{}')",[randomUUID(),r,u]);
  await client.query("INSERT INTO ballots(id,guild_id,round_id,state,kind,opens_at,closes_at) VALUES($1,$2,$3,'voting','opening','2026-11-07T00:00:00Z','2026-11-07T12:00:00Z')",[b,g,r]);
  await client.query('INSERT INTO ballot_roster(ballot_id,user_id) VALUES($1,$2)',[b,u]);
  await client.query("INSERT INTO ballot_choices(id,ballot_id,guild_id,round_id,label) VALUES($1,$2,$3,$4,'Keep holding')",[c,b,g,r]);
  await client.query('INSERT INTO votes(ballot_id,user_id,choice_id,revision,saved_at) VALUES($1,$2,$3,1,clock_timestamp())',[b,u,c]);
  await expectConstraint(client,'INSERT INTO votes(ballot_id,user_id,choice_id,revision,saved_at) VALUES($1,$2,$3,1,clock_timestamp())',[b,u,c]);
  await client.query("INSERT INTO sleeves(id,guild_id,round_id,user_id,mode,allocation_lamports,reserve_lamports,verification) VALUES($1,$2,$3,$4,'simulation',10000000000,10000000,'{}')",[sl,g,r,u]);
  await client.query("INSERT INTO order_intents(id,guild_id,sleeve_id,user_id,mode,state,idempotency_key) VALUES($1,$2,$3,$4,'simulation','intent','synthetic')",[i,g,sl,u]);
  await client.query("INSERT INTO positions(id,intent_id,user_id,mode,provider_id,account_id,external_position_id,state,record) VALUES($1,$2,$3,'simulation','synthetic','account','position','open','{}')",[p,i,u]);
  await expectConstraint(client,"UPDATE positions SET mode='live' WHERE id=$1",[p]);
  await client.query("INSERT INTO fills(intent_id,provider_id,account_id,external_fill_id,record) VALUES($1,'synthetic','account','fill','{}')",[i]);
  await expectConstraint(client,"INSERT INTO fills(intent_id,provider_id,account_id,external_fill_id,record) VALUES($1,'synthetic','account','fill','{}')",[i]);
  await client.query("INSERT INTO ledger_events(sleeve_id,operation_id,kind,record,observed_at) VALUES($1,'synthetic-ledger','fill','{}',clock_timestamp())",[sl]);
  await expectConstraint(client,"INSERT INTO ledger_events(sleeve_id,operation_id,kind,record,observed_at) VALUES($1,'synthetic-ledger','fill','{}',clock_timestamp())",[sl]);
  await expectConstraint(client,"UPDATE ledger_events SET kind='overwritten' WHERE sleeve_id=$1",[sl]);
  expect((await client.query('SELECT count(*)::int AS n FROM ledger_events WHERE sleeve_id=$1',[sl])).rows[0].n).toBe(1);
 }finally{await client.query('ROLLBACK');}
});
