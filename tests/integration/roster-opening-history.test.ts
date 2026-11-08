import {afterAll,beforeAll,expect,it} from 'vitest';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {testPool} from './helpers/database';
import {syntheticGuild} from './helpers/fixtures';
import {createSeason,advanceRound} from '../../src/server/services/rounds';
import {syntheticSchedules} from '../../src/domain/synthetic-schedule';
import {setMemberStatus} from '../../src/server/services/membership';
let db:Pool;beforeAll(()=>{db=testPool();});afterAll(async()=>{await db.end();});
async function originalOpening(){const f=await syntheticGuild(db),id=randomUUID();await db.query('INSERT INTO users(id,telegram_id) VALUES($1,$2)',[id,(BigInt('0x'+id.replaceAll('-','').slice(0,12))+1n).toString()]);await db.query("INSERT INTO memberships(guild_id,user_id,role,status) VALUES($1,$2,'member','active')",[f.guildId,id]);const now=(await db.query<{t:Date}>('SELECT clock_timestamp() t')).rows[0].t,open=new Date(now.getTime()+500),start=new Date(open.getTime()-86400000),schedules=syntheticSchedules(start.toISOString()),season=await createSeason(db,f.userId,f.guildId,{mode:'simulation',division:'original-synthetic-roster',rulesVersion:'roster-history-v1',schedules},{kind:'synthetic',providerId:'synthetic',expirations:schedules.map(s=>s.expiresAt)},{now:()=>new Date(start.getTime()-1)}),roundId=season.rounds[0].id;await db.query("UPDATE rounds SET state='candidate_lock' WHERE id=$1",[roundId]);return {...f,memberId:id,roundId,open};}
async function afterOpening(at:Date){await db.query("SELECT pg_sleep(GREATEST(0,extract(epoch FROM ($1::timestamptz-clock_timestamp())))+0.02)",[at]);}
it('keeps a member who departed after the published opening in the original denominator when activation is delayed',async()=>{const f=await originalOpening();await afterOpening(f.open);await setMemberStatus(db,f.userId,f.guildId,f.memberId,'departed');await advanceRound(db,f.roundId);expect((await db.query('SELECT count(*)::int n FROM round_roster WHERE round_id=$1',[f.roundId])).rows[0].n).toBe(2);});
it('does not add a member who was inactive at opening and reactivated before delayed activation',async()=>{const f=await originalOpening();await setMemberStatus(db,f.userId,f.guildId,f.memberId,'suspended');await afterOpening(f.open);await setMemberStatus(db,f.userId,f.guildId,f.memberId,'active');await advanceRound(db,f.roundId);expect((await db.query('SELECT count(*)::int n FROM round_roster WHERE round_id=$1',[f.roundId])).rows[0].n).toBe(1);});

it('allows scoped runtime membership updates but rejects direct fabricated history',async()=>{
 const f=await syntheticGuild(db),url=new URL(process.env.TEST_DATABASE_URL!);url.username='guild_wars_app';url.password='local_app_only';const runtime=new Pool({connectionString:url.toString(),max:1});
 try{await runtime.query("UPDATE memberships SET status='departed' WHERE guild_id=$1 AND user_id=$2",[f.guildId,f.userId]);expect((await db.query('SELECT status FROM membership_history WHERE guild_id=$1 ORDER BY sequence DESC LIMIT 1',[f.guildId])).rows[0].status).toBe('departed');await expect(runtime.query("INSERT INTO membership_history(guild_id,user_id,status,effective_at) VALUES($1,$2,'active',clock_timestamp())",[f.guildId,f.userId])).rejects.toThrow(/permission denied/);}finally{await runtime.end();}
});
it('does not reconstruct an opening that predates recorded coverage',async()=>{
 const f=await originalOpening(),start=(await db.query('SELECT started_at FROM membership_history_coverage')).rows[0].started_at;
 // The published schedule is immutable: construct a separate originally published legacy timetable.
 const opening=new Date(new Date(start).getTime()-1000),schedules=syntheticSchedules(new Date(opening.getTime()-86400000).toISOString());
 const season=await createSeason(db,f.userId,f.guildId,{mode:'simulation',division:'original-legacy-coverage',rulesVersion:'legacy-v1',schedules},{kind:'synthetic',providerId:'synthetic',expirations:schedules.map(s=>s.expiresAt)},{now:()=>new Date(Date.parse(schedules[0].researchOpen)-1)});
 const row=await advanceRound(db,season.rounds[0].id,{now:()=>new Date(opening.getTime()+100)});expect(row.state).toBe('unranked');
 expect((await db.query('SELECT count(*)::int n FROM round_roster WHERE round_id=$1',[row.id])).rows[0].n).toBe(0);
});
