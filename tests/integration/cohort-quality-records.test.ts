import {it,expect,beforeAll,afterAll} from 'vitest';
import type {Pool} from 'pg';
import {randomUUID} from 'node:crypto';
import {testPool} from './helpers/database';
import {reconciliationFixture} from './helpers/reconciliation';
import {transaction} from '../../src/server/db/client';
import {readCohortQualityInTx} from '../../src/server/services/cohort-quality';
import {recordCohortOutcome} from '../../src/server/services/sleeves';
import {importProviderEvents} from '../../src/server/services/import-provider-events';
let db:Pool;beforeAll(()=>{db=testPool();});afterAll(async()=>{await db.end();});
it('projects actual stored deviation, current canonical late fill and discrepancy without dropping the fixture member or enabling provider gates',async()=>{
 const f=await reconciliationFixture(db),c=(await db.query("INSERT INTO cohort_members(season_id,guild_id,user_id,division,consents) VALUES($1,$2,$3,'original-synthetic-quality','{\"dataClass\":\"fixture\",\"readAccess\":true,\"aggregateResults\":true}') RETURNING id",[f.seasonId,f.guildId,f.userId])).rows[0],reg=(await db.query("INSERT INTO live_sleeve_registrations(cohort_member_id,guild_id,season_id,round_id,user_id,account_id,allocation_lamports,reserve_lamports,reference_lamports,record) VALUES($1,$2,$3,$4,$5,$6,10000000000,10000000,9990000000,'{\"dataClass\":\"fixture\"}') RETURNING id",[c.id,f.guildId,f.seasonId,f.roundId,f.userId,f.accountId])).rows[0];await db.query('UPDATE sleeves SET cohort_member_id=$2 WHERE id=$1',[f.sleeveId,c.id]);
 await recordCohortOutcome(db,f.userId,reg.id,'deviation','quality-deviation:'+randomUUID());const late=f.fill('quality-late','2000000000','1000000',f.window.closesAt);await importProviderEvents(db,f.context,[late]);await importProviderEvents(db,f.context,[{...late,event:{...late.event,premiumUsdcMicros:'2000000'} as typeof late.event}]);const q=await transaction(db,tx=>readCohortQualityInTx(tx,f.seasonId,f.roundId));expect(q.memberIds).toEqual([c.id]);expect(q.eligible).toBe(false);expect(q.reasons.join(' ')).toMatch(/deviation/);expect(q.reasons.join(' ')).toMatch(/discrepanc/);expect(q.reasons.join(' ')).toMatch(/late/);
});
