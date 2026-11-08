import type {Pool} from 'pg';
import {purgeMarketCache} from '../market/cache';
import {advanceRound} from '../services/rounds';
import type {Tx} from '../db/client';
import {enqueue} from './queue';
export async function recoverDue(tx:Tx):Promise<number> {
 const {rows}=await tx.query<{id:string}>('SELECT id FROM ballots WHERE state=\'voting\' AND closes_at<=clock_timestamp() ORDER BY closes_at,id LIMIT 100');
 for(const row of rows)await enqueue(tx,{task:'close_ballot',operationId:`close:${row.id}`,payload:{ballotId:row.id}});
 return rows.length;
}

export async function recoverPublishedRounds(db:Pool):Promise<number> {
 const {rows}=await db.query<{id:string}>("SELECT id FROM rounds WHERE schedule ? 'researchOpen' AND (state='expired' OR clock_timestamp()>=CASE state WHEN 'research' THEN (schedule->>'candidateLock')::timestamptz WHEN 'candidate_lock' THEN (schedule->>'voteOpen')::timestamptz WHEN 'voting' THEN (schedule->>'voteClose')::timestamptz WHEN 'execution_window' THEN (schedule->>'executionClose')::timestamptz WHEN 'open' THEN (schedule->>'midweekOpen')::timestamptz WHEN 'midweek' THEN (schedule->>'expiresAt')::timestamptz ELSE NULL END) ORDER BY created_at,id LIMIT 100");
 for(const row of rows)await advanceRound(db,row.id);await purgeMarketCache(db);return rows.length;
}
