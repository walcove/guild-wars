import {it,expect} from 'vitest';
import {execFileSync} from 'node:child_process';
import {testPool} from './helpers/database';
it('preserves protected history ACLs through actual worker setup and application migration replay',async()=>{
 execFileSync(process.execPath,['--import','tsx','scripts/migrate-worker.ts'],{env:process.env,stdio:'pipe'});execFileSync(process.execPath,['--import','tsx','scripts/migrate.ts','--test'],{env:process.env,stdio:'pipe'});const db=testPool();try{for(const role of ['guild_wars_app','guild_wars_worker']){const p=(await db.query("SELECT has_table_privilege($1,'membership_history','INSERT') history,has_table_privilege($1,'membership_history_coverage','INSERT') coverage",[role])).rows[0];expect(p,role+' cannot fabricate opening history').toEqual({history:false,coverage:false});}}finally{await db.end();}
});
