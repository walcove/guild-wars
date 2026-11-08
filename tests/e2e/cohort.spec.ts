import {test,expect} from '@playwright/test';
import {Pool} from 'pg';
import {requireTestDatabaseUrl} from '../../src/server/db/test-target';
import {transaction} from '../../src/server/db/client';
import {createSession} from '../../src/server/auth/sessions';
import {systemClock} from '../../src/domain/clock';
import {syntheticGuild} from '../integration/helpers/fixtures';
let db:Pool;test.beforeAll(()=>{db=new Pool({connectionString:requireTestDatabaseUrl(process.env.TEST_DATABASE_URL),max:2});});test.afterAll(async()=>{await db.end();});
for(const width of [390,1360])test(`read consent and provider unavailable cohort at ${width}px`,async({page,context})=>{const f=await syntheticGuild(db),s=await transaction(db,tx=>createSession(tx,f.userId,systemClock));await context.addCookies([{name:'gw_session',value:s.sessionToken,url:'http://127.0.0.1:3000',httpOnly:true,sameSite:'Lax'}]);await page.setViewportSize({width,height:844});await page.goto(`/guilds/${f.guildId}/cohort`);await expect(page.getByRole('heading',{name:'Join a verified comparison'})).toBeVisible();await expect(page.getByText(/Real cohort registration is unavailable/)).toBeVisible();await expect(page.getByRole('heading',{name:'My account · actual personal result'})).toBeVisible();await expect(page.getByRole('heading',{name:'Verified cohort · consented aggregate'})).toBeVisible();await expect(page.getByRole('button',{name:/Register performance sleeve/})).toHaveCount(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);await page.screenshot({path:`.local/screenshots/cohort-${width}.png`,fullPage:true});});
