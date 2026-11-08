import {test,expect} from '@playwright/test';
import {Pool} from 'pg';
import {sessionCookieName} from './helpers/cookies';
import {requireTestDatabaseUrl} from '../../src/server/db/test-target';
import {syntheticReviewedIntents} from '../integration/helpers/orders';
import {createSession} from '../../src/server/auth/sessions';
import {transaction} from '../../src/server/db/client';
import {systemClock} from '../../src/domain/clock';
test('an owner can discover an older obligation after fifty newer settled records and guild departure',async({page,context})=>{
 const db=new Pool({connectionString:requireTestDatabaseUrl(process.env.TEST_DATABASE_URL),max:2});try{
 const f=await syntheticReviewedIntents(db),i=await f.intent();const positions=(await db.query("INSERT INTO positions(intent_id,user_id,mode,provider_id,account_id,external_position_id,state,record,created_at) SELECT $1::uuid,$2::uuid,'simulation','synthetic',$3::text,'history-'||$1::text||'-'||n,CASE WHEN n=0 THEN 'expired' ELSE 'settled' END,'{}'::jsonb,'2026-01-01T00:00:00Z'::timestamptz+n*interval '1 microsecond' FROM generate_series(0,50)n RETURNING id,state",[i.id,f.userId,'synthetic-'+f.accountId])).rows,older=positions.find(p=>p.state==='expired')!;
 await db.query("UPDATE memberships SET status='departed' WHERE guild_id=$1 AND user_id=$2",[f.guildId,f.userId]);const s=await transaction(db,tx=>createSession(tx,f.userId,systemClock));await context.addCookies([{name:sessionCookieName,value:s.sessionToken,secure:process.env.GW_E2E_PRODUCTION==='true',url:process.env.GW_E2E_PRODUCTION==='true'?'https://127.0.0.1:3000':'http://127.0.0.1:3000',httpOnly:true,sameSite:'Lax'}]);await page.goto('/positions');await expect(page.getByRole('heading',{name:'Your covered-call positions'})).toBeVisible();await expect(page.getByRole('link',{name:'Older positions'})).toBeVisible({timeout:1000});await page.getByRole('link',{name:'Older positions'}).click();await expect(page.getByRole('link',{name:/Simulation · expired/})).toHaveAttribute('href','/positions/'+older.id);await page.getByRole('link',{name:/Simulation · expired/}).click();await expect(page.getByRole('heading',{name:'Your SOL covered call'})).toBeVisible();
 }finally{await db.end();}
});
