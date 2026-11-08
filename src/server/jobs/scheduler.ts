import type {Pool} from 'pg';
import {purgeMarketCache} from '../market/cache';
import {activatePreparedBallot,recoverMissingBallotForRound} from '../services/ballots';
import {advanceRound} from '../services/rounds';
import type {Tx} from '../db/client';
import {enqueue} from './queue';
export async function recoverDue(tx:Tx):Promise<number> {
 const {rows}=await tx.query<{id:string}>('SELECT id FROM ballots WHERE state IN (\'prepared\',\'voting\') AND closes_at<=clock_timestamp() ORDER BY closes_at,id LIMIT 100');
 for(const row of rows)await enqueue(tx,{task:'close_ballot',operationId:`close:${row.id}`,payload:{ballotId:row.id}});
 return rows.length;
}

export async function recoverPublishedRounds(db:Pool):Promise<number> {
 const {rows}=await db.query<{id:string}>("SELECT id FROM rounds WHERE schedule ? 'researchOpen' AND (state='expired' OR clock_timestamp()>=CASE state WHEN 'research' THEN (schedule->>'candidateLock')::timestamptz WHEN 'candidate_lock' THEN (schedule->>'voteOpen')::timestamptz WHEN 'voting' THEN (schedule->>'voteClose')::timestamptz WHEN 'execution_window' THEN (schedule->>'executionClose')::timestamptz WHEN 'open' THEN (schedule->>'midweekOpen')::timestamptz WHEN 'midweek' THEN (schedule->>'expiresAt')::timestamptz ELSE NULL END) ORDER BY created_at,id LIMIT 100");
 for(const row of rows)await advanceRound(db,row.id);await purgeMarketCache(db);return rows.length;
}

export async function recoverPreparedBallots(db:Pool):Promise<number>{const {rows}=await db.query<{id:string}>("SELECT id FROM ballots WHERE state='prepared' AND opens_at<=clock_timestamp() AND closes_at>clock_timestamp() ORDER BY opens_at,id LIMIT 100");for(const row of rows)await activatePreparedBallot(db,row.id);return rows.length;}

export async function recoverMissingBallots(db:Pool):Promise<number>{const {rows}=await db.query<{id:string}>("SELECT r.id FROM rounds r WHERE r.state IN ('research','candidate_lock','voting') AND r.schedule ? 'voteClose' AND (r.schedule->>'voteClose')::timestamptz<=clock_timestamp() AND NOT EXISTS(SELECT FROM ballots b WHERE b.round_id=r.id AND b.kind='opening') ORDER BY (r.schedule->>'voteClose')::timestamptz,r.id LIMIT 100");for(const row of rows)await recoverMissingBallotForRound(db,row.id);return rows.length;}

export async function recoverSimulations(db:Pool):Promise<number>{const {rows}=await db.query<{id:string}>("SELECT r.id FROM rounds r WHERE r.mode='simulation' AND r.schedule ? 'voteClose' AND (r.schedule->>'voteClose')::timestamptz<=clock_timestamp() AND NOT EXISTS(SELECT FROM simulation_bookings b WHERE b.round_id=r.id) ORDER BY (r.schedule->>'voteClose')::timestamptz,r.id LIMIT 100");const {transaction}=await import('../db/client');await transaction(db,async tx=>{for(const r of rows)await enqueue(tx,{task:'book_simulation',operationId:`virtual-book:${r.id}`,payload:{roundId:r.id}});});return rows.length;}

export async function recoverProviderOrders(tx:Tx):Promise<number>{const {rows}=await tx.query<{id:string}>("SELECT i.id FROM order_intents i WHERE i.mode='live' AND (i.state IN ('submitted','pending_confirmation','partially_filled','unknown') OR EXISTS(SELECT FROM positions p WHERE p.intent_id=i.id AND p.state NOT IN ('settled','withdrawn'))) ORDER BY i.created_at,i.id LIMIT 100");for(const row of rows)await enqueue(tx,{task:'reconcile_orders',operationId:`reconcile:${row.id}`,payload:{intentId:row.id}});return rows.length;}
