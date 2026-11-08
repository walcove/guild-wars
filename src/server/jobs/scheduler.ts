import type {Tx} from '../db/client';
import {enqueue} from './queue';
export async function recoverDue(tx:Tx):Promise<number> {
 const {rows}=await tx.query<{id:string}>('SELECT id FROM ballots WHERE state=\'voting\' AND closes_at<=clock_timestamp() ORDER BY closes_at,id LIMIT 100');
 for(const row of rows)await enqueue(tx,{task:'close_ballot',operationId:`close:${row.id}`,payload:{ballotId:row.id}});
 return rows.length;
}
