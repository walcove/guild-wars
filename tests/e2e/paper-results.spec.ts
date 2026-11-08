import {test,expect} from '@playwright/test';
import {Pool} from 'pg';
import {sessionCookieName} from './helpers/cookies';
import {requireTestDatabaseUrl} from '../../src/server/db/test-target';
import {syntheticPaperPublication} from '../integration/helpers/paper-publication';
import {transaction} from '../../src/server/db/client';
import {createSession} from '../../src/server/auth/sessions';
import {systemClock} from '../../src/domain/clock';
test('renders a losing normalized paper result, separately priced matched House and immutable audit without a personal earnings claim',async({page,context})=>{
 const db=new Pool({connectionString:requireTestDatabaseUrl(process.env.TEST_DATABASE_URL),max:2});try{const f=await syntheticPaperPublication(db),s=await transaction(db,tx=>createSession(tx,f.userId,systemClock));await context.addCookies([{name:sessionCookieName,value:s.sessionToken,secure:process.env.GW_E2E_PRODUCTION==='true',url:process.env.GW_E2E_PRODUCTION==='true'?'https://127.0.0.1:3000':'http://127.0.0.1:3000',httpOnly:true,sameSite:'Lax'}]);await page.setViewportSize({width:390,height:900});await page.goto(`/rounds/${f.season.rounds[0].id}/results`);await expect(page.getByRole('heading',{name:'Normalized plan · paper comparison'})).toBeVisible();await expect(page.locator('dt').filter({hasText:'Paper total net result'}).locator('..').locator('dd')).toHaveText('-200 USD');await expect(page.getByRole('heading',{name:'Paper House · matched'})).toBeVisible();await expect(page.getByText('No personal sleeve is booked for this round. You can contribute without trading.')).toBeVisible();await page.screenshot({path:'.local/screenshots/final-paper-results-390.png',fullPage:true});await page.getByRole('link',{name:'Open Paper House source revision'}).click();await expect(page.getByRole('heading',{name:'Paper House source revision'})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);}finally{await db.end();}
});
