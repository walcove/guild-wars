import {test,expect} from '@playwright/test';
import {Pool} from 'pg';
import {sessionCookieName} from './helpers/cookies';
import {requireTestDatabaseUrl} from '../../src/server/db/test-target';
import {syntheticGuild} from '../integration/helpers/fixtures';
import {createSession} from '../../src/server/auth/sessions';
import {tokenHash} from '../../src/server/auth/crypto';
import {transaction} from '../../src/server/db/client';
import {systemClock} from '../../src/domain/clock';
test('a static guild view hides on reconnect after remote session revocation without a storage event',async({page,context})=>{
 const db=new Pool({connectionString:requireTestDatabaseUrl(process.env.TEST_DATABASE_URL),max:2});try{const f=await syntheticGuild(db),s=await transaction(db,tx=>createSession(tx,f.userId,systemClock));await context.addCookies([{name:sessionCookieName,value:s.sessionToken,secure:process.env.GW_E2E_PRODUCTION==='true',url:process.env.GW_E2E_PRODUCTION==='true'?'https://127.0.0.1:3000':'http://127.0.0.1:3000',httpOnly:true,sameSite:'Lax'}]);await page.goto('/guilds/'+f.guildId);await expect(page.getByRole('heading',{name:'Synthetic test guild',exact:true})).toBeVisible();await context.setOffline(true);await db.query('UPDATE sessions SET revoked_at=clock_timestamp() WHERE token_hash=$1',[tokenHash(s.sessionToken)]);await context.setOffline(false);await expect(page.getByRole('heading',{name:'Private content hidden'})).toBeVisible();await expect(page.getByRole('heading',{name:'Synthetic test guild',exact:true})).toHaveCount(0);}finally{await db.end();}
});
