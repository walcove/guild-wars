import type {Pool} from 'pg';
import {systemClock,type Clock} from '../../domain/clock';
import {invariant} from '../../domain/errors';
import {transaction,type Tx} from '../db/client';
import {opaqueToken,tokenHash,validToken} from './crypto';
export interface BrowserSession {sessionToken:string;csrfToken:string;userId:string|null;returnPath?:string}
export interface SessionRecord {tokenHash:string;userId:string|null;csrfHash:string;createdAt:Date;lastSeenAt:Date;expiresAt:Date;revokedAt:Date|null;telegramProvedAt:Date|null}
const day=86400000;
export async function createSession(tx:Tx,userId:string|null,clock:Clock,provedAt:Date|null=null):Promise<BrowserSession> {
 const sessionToken=opaqueToken(),csrfToken=opaqueToken(),now=clock.now();
 await tx.query('INSERT INTO sessions(token_hash,user_id,csrf_hash,created_at,last_seen_at,expires_at,telegram_proved_at) VALUES($1,$2,$3,$4,$4,$5,$6)',[tokenHash(sessionToken),userId,tokenHash(csrfToken),now,new Date(now.getTime()+7*day),provedAt]);
 return {sessionToken,csrfToken,userId};
}
export async function sessionInTx(tx:Tx,token:string,clock:Clock,lock=false,touch=false):Promise<SessionRecord> {
 invariant(validToken(token),'invalid_session','Your session expired; reconnect safely');
 const {rows}=await tx.query<SessionRecord>(`SELECT token_hash AS "tokenHash",user_id AS "userId",csrf_hash AS "csrfHash",created_at AS "createdAt",last_seen_at AS "lastSeenAt",expires_at AS "expiresAt",revoked_at AS "revokedAt",telegram_proved_at AS "telegramProvedAt" FROM sessions WHERE token_hash=$1${lock?' FOR UPDATE':''}`,[tokenHash(token)]);
 const row=rows[0],now=clock.now().getTime();
 invariant(row&&!row.revokedAt&&now<row.expiresAt.getTime()&&now-row.lastSeenAt.getTime()<day&&now>=row.createdAt.getTime(),'invalid_session','Your session expired or was revoked; reconnect safely');
 if(touch)await tx.query('UPDATE sessions SET last_seen_at=$2 WHERE token_hash=$1',[row.tokenHash,clock.now()]);return row;
}
export function requireFreshTelegram(session:SessionRecord,clock:Clock):void {
 invariant(session.userId&&session.telegramProvedAt&&clock.now().getTime()-session.telegramProvedAt.getTime()<300000,'fresh_proof_required','Fresh proof of your existing Telegram identity is required');
}
export function newBrowserSession(db:Pool,clock:Clock=systemClock):Promise<BrowserSession>{return transaction(db,tx=>createSession(tx,null,clock));}
export function readSession(db:Pool,token:string,clock:Clock=systemClock):Promise<SessionRecord>{return transaction(db,tx=>sessionInTx(tx,token,clock,false,true));}
export async function revokeSession(db:Pool,token:string,clock:Clock=systemClock):Promise<void>{await transaction(db,async tx=>{const session=await sessionInTx(tx,token,clock,true);await tx.query('UPDATE sessions SET revoked_at=$2 WHERE token_hash=$1',[session.tokenHash,clock.now()]);});}
