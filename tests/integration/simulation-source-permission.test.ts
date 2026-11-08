import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {testPool} from './helpers/database';
import {syntheticGuild} from './helpers/fixtures';
import {freezeSimulationSnapshot} from '../../src/server/jobs/book-simulation';
it('rejects a claimed retained-data reference even when it matches an unapproved stored catalog claim',async()=>{
 const db=testPool();try{const f=await syntheticGuild(db),seasonId=randomUUID(),roundId=randomUUID(),now=(await db.query('SELECT clock_timestamp() t')).rows[0].t,booking=new Date(now.getTime()+5000).toISOString();
 // Original malformed-state fixture, explicitly testing rejection; not an approved catalog.
 await db.query("INSERT INTO seasons(id,guild_id,mode,division,rules_version,rules) VALUES($1,$2,'simulation','original-invalid-permission','test',$3::jsonb)",[seasonId,f.guildId,JSON.stringify({allocationLamports:'10000000000',reserveLamports:'10000000',source:{kind:'verified_catalog',providerId:'original-invalid-provider',dataRightsReference:'not-permission'}})]);await db.query("INSERT INTO rounds(id,guild_id,season_id,mode,number,state,schedule,expires_at) VALUES($1,$2,$3,'simulation',1,'research',$4::jsonb,$5)",[roundId,f.guildId,seasonId,JSON.stringify({voteClose:booking}),new Date(now.getTime()+86400000)]);await expect(freezeSimulationSnapshot(db,roundId,{policyVersion:'virtual-covered-call-v1',bookingAt:booking,dataClass:'verified',candidates:[],source:{sourceId:'original-invalid-provider-source',observedAt:now.toISOString(),receivedAt:now.toISOString(),synthetic:false},rightsReference:'not-permission'})).rejects.toMatchObject({code:'source_rights'});expect((await db.query('SELECT round_id FROM simulation_snapshots WHERE round_id=$1',[roundId])).rowCount).toBe(0);
 }finally{await db.end();}
});
