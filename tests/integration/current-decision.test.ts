import {it,expect,beforeAll,afterAll} from 'vitest';
import type {Pool} from 'pg';
import {testPool} from './helpers/database';
import {syntheticGuild} from './helpers/fixtures';
import {syntheticSchedules} from '../../src/domain/synthetic-schedule';
import {createSeason} from '../../src/server/services/rounds';
import {guildOverview} from '../../src/server/services/guilds';
let db:Pool;beforeAll(()=>{db=testPool();});afterAll(async()=>{await db.end();});
async function publish(f:Awaited<ReturnType<typeof syntheticGuild>>,start:Date){const schedules=syntheticSchedules(start.toISOString());return createSeason(db,f.userId,f.guildId,{mode:'simulation',division:'original-current-decision',rulesVersion:'v1',schedules},{kind:'synthetic',providerId:'synthetic',expirations:schedules.map(s=>s.expiresAt)},{now:()=>new Date(start.getTime()-1)});}
it('opens the scheduled next decision without treating prior settlement as resolved',async()=>{
 const f=await syntheticGuild(db),now=(await db.query('SELECT clock_timestamp() t')).rows[0].t,season=await publish(f,new Date(now.getTime()-7*86400000-1000));await db.query("UPDATE rounds SET state='settlement_pending' WHERE id=$1",[season.rounds[0].id]);const v=await guildOverview(db,f.userId,f.guildId);expect(v.round?.id).toBe(season.rounds[1].id);expect(v.nextAction?.label).toBe('Research and compare');expect((await db.query('SELECT state FROM rounds WHERE id=$1',[season.rounds[0].id])).rows[0].state).toBe('settlement_pending');
});
it('does not replace an active season decision merely because a future season was published',async()=>{
 const f=await syntheticGuild(db),now=(await db.query('SELECT clock_timestamp() t')).rows[0].t,active=await publish(f,new Date(now.getTime()-1000));await publish(f,new Date(now.getTime()+40*86400000));const v=await guildOverview(db,f.userId,f.guildId);expect(v.season?.id).toBe(active.id);expect(v.round?.id).toBe(active.rounds[0].id);
});
