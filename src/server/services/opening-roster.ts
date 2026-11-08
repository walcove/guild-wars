import type {Tx} from '../db/client';
// Serialize with membership acceptance; history records the post-lock database point.
// Null means the opening predates coverage, never a retrospective current roster.
export async function membersAtOpening(tx:Tx,guildId:string,opensAt:string|Date):Promise<string[]|null>{
 await tx.query("SELECT pg_advisory_xact_lock(hashtextextended('membership-roster:'||$1::text,0))",[guildId]);
 const coverage=(await tx.query('SELECT started_at FROM membership_history_coverage WHERE singleton=true')).rows[0];
 if(!coverage||new Date(coverage.started_at).getTime()>new Date(opensAt).getTime())return null;
 const rows=await tx.query<{user_id:string}>(`SELECT user_id FROM (
  SELECT DISTINCT ON(user_id) user_id,status FROM membership_history
  WHERE guild_id=$1 AND effective_at<=$2 ORDER BY user_id,effective_at DESC,sequence DESC
 ) h WHERE status='active' ORDER BY user_id`,[guildId,opensAt]);
 return rows.rows.map(r=>r.user_id);
}
