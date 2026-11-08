import {afterAll,beforeAll,expect,it} from 'vitest';
import type {Pool} from 'pg';
import {testPool} from './helpers/database';
import {fixedClock} from '../../src/domain/clock';
import {newBrowserSession,readSession,revokeSession} from '../../src/server/auth/sessions';
import {issueLink,proveTelegramLink,confirmTelegramLink} from '../../src/server/services/link-telegram';
import {randomUUID} from 'node:crypto';
const time='2026-11-08T00:00:00.000Z',clock=fixedClock(time);
let db:Pool;
beforeAll(()=>{db=testPool();});afterAll(async()=>{await db.end();});
const telegram=()=> (BigInt('0x'+randomUUID().replaceAll('-','').slice(0,15))+1n).toString();
async function signIn(tg=telegram()){
 const browser=await newBrowserSession(db,clock),link=await issueLink(db,browser.sessionToken,'/proposals/plan-1?version=v1&origin=opaque','sign_in',clock);
 await proveTelegramLink(db,link.token,tg,clock);return {...await confirmTelegramLink(db,browser.sessionToken,link.token,clock),tg};
}
it('creates a Telegram member without any wallet, consumes proof once and rotates the browser session',async()=>{
 const browser=await newBrowserSession(db,clock),tg=telegram(),link=await issueLink(db,browser.sessionToken,'/proposals/plan-1?version=v1','sign_in',clock);
 await proveTelegramLink(db,link.token,tg,clock);
 await expect(confirmTelegramLink(db,browser.sessionToken,link.token,clock,'999999')).rejects.toMatchObject({code:'identity_conflict'});
 const outcomes=await Promise.allSettled([confirmTelegramLink(db,browser.sessionToken,link.token,clock),confirmTelegramLink(db,browser.sessionToken,link.token,clock)]);
 expect(outcomes.filter(o=>o.status==='fulfilled')).toHaveLength(1);
 const result=(outcomes.find(o=>o.status==='fulfilled') as PromiseFulfilledResult<Awaited<ReturnType<typeof confirmTelegramLink>>>).value;
 expect(result.returnPath).toBe('/proposals/plan-1?version=v1');expect(result.userId).toBeTruthy();
 expect((await readSession(db,result.sessionToken,clock)).userId).toBe(result.userId);
 await expect(readSession(db,browser.sessionToken,clock)).rejects.toThrow(/session/i);
 expect((await db.query('SELECT token_hash FROM sessions WHERE user_id=$1',[result.userId])).rows.every(r=>r.token_hash!==result.sessionToken)).toBe(true);
});
it('does not transfer bot proof to another browser',async()=>{
 const a=await newBrowserSession(db,clock),b=await newBrowserSession(db,clock),link=await issueLink(db,a.sessionToken,'/','sign_in',clock);
 await proveTelegramLink(db,link.token,telegram(),clock);
 await expect(confirmTelegramLink(db,b.sessionToken,link.token,clock)).rejects.toThrow(/browser/i);
 expect((await confirmTelegramLink(db,a.sessionToken,link.token,clock)).userId).toBeTruthy();
});
it('rejects proof at the exact five-minute expiry and invalidates restarted challenges',async()=>{
 const a=await newBrowserSession(db,clock),link=await issueLink(db,a.sessionToken,'/','sign_in',clock);
 await expect(proveTelegramLink(db,link.token,telegram(),fixedClock('2026-11-08T00:05:00.000Z'))).rejects.toThrow(/expired/i);
 const replacement=await issueLink(db,a.sessionToken,'/','sign_in',fixedClock('2026-11-08T00:00:06.000Z'));
 await expect(proveTelegramLink(db,link.token,telegram(),clock)).rejects.toThrow(/expired|unavailable/i);
 expect(replacement.token).not.toBe(link.token);
});
it('checks idle/absolute expiry and logout on the server',async()=>{
 const a=await signIn();
 await expect(readSession(db,a.sessionToken,fixedClock('2026-11-09T00:00:00.000Z'))).rejects.toThrow(/session/i);
 await db.query("UPDATE sessions SET last_seen_at='2026-11-14T23:00:00Z' WHERE user_id=$1",[a.userId]);
 await expect(readSession(db,a.sessionToken,fixedClock('2026-11-15T00:00:00.000Z'))).rejects.toThrow(/session/i);
 const b=await signIn();await revokeSession(db,b.sessionToken,clock);await expect(readSession(db,b.sessionToken,clock)).rejects.toThrow(/session/i);
});
it('never merges a conflicting identity; a change requires fresh original and new Telegram proof',async()=>{
 const a=await signIn(),b=await signIn();
 const conflict=await issueLink(db,a.sessionToken,'/','change_identity',clock);await proveTelegramLink(db,conflict.token,b.tg,clock);
 await expect(confirmTelegramLink(db,a.sessionToken,conflict.token,clock)).rejects.toMatchObject({code:'identity_conflict'});
 await expect(issueLink(db,a.sessionToken,'/','change_identity',fixedClock('2026-11-08T00:05:00.000Z'))).rejects.toThrow(/fresh/i);
 const next=fixedClock('2026-11-08T00:00:06.000Z');
 const change=await issueLink(db,a.sessionToken,'/','change_identity',next),newTg=telegram();await proveTelegramLink(db,change.token,newTg,next);
 await db.query("INSERT INTO provider_accounts(user_id,provider_id,external_account_id,read_authorization_ref) VALUES($1,'synthetic',$2,'synthetic-read-ref')",[a.userId,randomUUID()]);
 const updated=await confirmTelegramLink(db,a.sessionToken,change.token,next);
 expect(updated.userId).toBe(a.userId);expect((await db.query('SELECT telegram_id FROM users WHERE id=$1',[a.userId])).rows[0].telegram_id).toBe(newTg);
 await expect(readSession(db,a.sessionToken,next)).rejects.toThrow(/session/i);
 expect((await db.query('SELECT read_authorization_ref,revoked_at FROM provider_accounts WHERE user_id=$1',[a.userId])).rows[0]).toMatchObject({read_authorization_ref:null,revoked_at:expect.any(Date)});
});
