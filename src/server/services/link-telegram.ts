import type {Pool} from 'pg';
import {systemClock,type Clock} from '../../domain/clock';
import {invariant} from '../../domain/errors';
import {transaction} from '../db/client';
import {createSession,sessionInTx,requireFreshTelegram,type BrowserSession} from '../auth/sessions';
import {opaqueToken,tokenHash,validToken} from '../auth/crypto';
import {safeReturnPath} from '../auth/link-challenges';
import {audit} from './audit';
export async function issueLink(db:Pool,sessionToken:string,path:string,purpose:'sign_in'|'change_identity'='sign_in',clock:Clock=systemClock):Promise<{token:string;expiresAt:string}> {
 safeReturnPath(path);invariant(['sign_in','change_identity'].includes(purpose),'link_purpose','Unknown connection purpose');
 return transaction(db,async tx=>{
  const session=await sessionInTx(tx,sessionToken,clock,true,true);if(purpose==='change_identity')requireFreshTelegram(session,clock);
  const prior=(await tx.query('SELECT created_at FROM link_challenges WHERE session_hash=$1',[session.tokenHash])).rows[0];
  invariant(!prior||clock.now().getTime()-prior.created_at.getTime()>=5000,'rate_limited','Wait five seconds before restarting this connection');
  const token=opaqueToken(),now=clock.now();
  await tx.query('INSERT INTO link_challenges(token_hash,session_hash,expires_at,return_path,purpose,created_at) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(session_hash) DO UPDATE SET token_hash=EXCLUDED.token_hash,telegram_id=NULL,consumed_at=NULL,expires_at=EXCLUDED.expires_at,return_path=EXCLUDED.return_path,purpose=EXCLUDED.purpose,created_at=EXCLUDED.created_at',[tokenHash(token),session.tokenHash,new Date(now.getTime()+300000),path,purpose,now]);return {token,expiresAt:new Date(now.getTime()+300000).toISOString()};
 });
}
export async function proveTelegramLink(db:Pool,token:string,telegramId:string,clock:Clock=systemClock):Promise<void> {
 invariant(validToken(token)&&/^[1-9]\d{0,19}$/.test(telegramId),'invalid_proof','Invalid Telegram connection proof');
 await transaction(db,async tx=>{
  const row=(await tx.query('SELECT c.*,s.revoked_at FROM link_challenges c JOIN sessions s ON s.token_hash=c.session_hash WHERE c.token_hash=$1 FOR UPDATE OF c',[tokenHash(token)])).rows[0];
  invariant(row&&!row.consumed_at&&!row.revoked_at&&clock.now()<row.expires_at,'link_expired','Connection expired or unavailable; restart in the original browser');
  invariant(!row.telegram_id||row.telegram_id===telegramId,'identity_conflict','This connection was confirmed by another Telegram account');
  await tx.query('UPDATE link_challenges SET telegram_id=$2 WHERE token_hash=$1',[tokenHash(token),telegramId]);
 });
}
export async function confirmTelegramLink(db:Pool,sessionToken:string,token:string,clock:Clock=systemClock,expectedTelegramId?:string):Promise<BrowserSession> {
 invariant(validToken(token),'link_expired','Connection expired; restart safely');
 return transaction(db,async tx=>{
  const session=await sessionInTx(tx,sessionToken,clock,true);
  const row=(await tx.query('SELECT * FROM link_challenges WHERE token_hash=$1 FOR UPDATE',[tokenHash(token)])).rows[0];
  invariant(row&&row.session_hash===session.tokenHash,'wrong_browser','This connection began in another browser. Return there, or restart here');
  invariant(!row.consumed_at&&clock.now()<row.expires_at,'link_expired','Connection expired or consumed; restart safely');
  invariant(!expectedTelegramId||row.telegram_id===expectedTelegramId,'identity_conflict','The proved Telegram account changed; review it again');
  invariant(row.telegram_id,'proof_required','Confirm in the bot, then return to this browser to finish');
  await tx.query("SELECT pg_advisory_xact_lock(hashtextextended('telegram:' || $1,0))",[row.telegram_id]);
  const existing=(await tx.query('SELECT id FROM users WHERE telegram_id=$1',[row.telegram_id])).rows[0];
  let userId:string;
  if(row.purpose==='change_identity') {
   requireFreshTelegram(session,clock);userId=session.userId!;
   invariant(!existing||existing.id===userId,'identity_conflict','That identity belongs to an existing account; no accounts were merged');
   await tx.query('UPDATE users SET telegram_id=$2 WHERE id=$1',[userId,row.telegram_id]);
   await tx.query('UPDATE sessions SET revoked_at=$2 WHERE user_id=$1 AND revoked_at IS NULL',[userId,clock.now()]);
   await tx.query('UPDATE provider_accounts SET revoked_at=$2,read_authorization_ref=NULL WHERE user_id=$1',[userId,clock.now()]);
   await audit(tx,{actorId:userId,kind:'identity_changed',recordId:userId,reason:'Fresh original identity plus new session-bound Telegram proof'});
  } else if(session.userId) {
   invariant(existing?.id===session.userId,'identity_conflict','Wrong account: stop and reconnect with the existing Telegram identity');userId=session.userId;
  } else {userId=existing?.id??(await tx.query('INSERT INTO users(telegram_id) VALUES($1) RETURNING id',[row.telegram_id])).rows[0].id;}
  await tx.query('UPDATE link_challenges SET consumed_at=$2 WHERE token_hash=$1',[tokenHash(token),clock.now()]);
  await tx.query('UPDATE sessions SET revoked_at=$2 WHERE token_hash=$1',[session.tokenHash,clock.now()]);
  return {...await createSession(tx,userId,clock,clock.now()),returnPath:row.return_path};
 });
}
