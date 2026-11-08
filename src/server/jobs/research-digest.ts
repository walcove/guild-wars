import type { Pool } from "pg";
import { inGuild } from "../db/repositories";
import type { Tx } from "../db/client";
import { invariant } from "../../domain/errors";
import { competitionWeek } from "../../domain/research-awards";
import { enqueue } from "./queue";
export async function setResearchDigest(
  db: Pool,
  userId: string,
  guildId: string,
  active: boolean,
  botId: string | null
) {
  await inGuild(db, userId, guildId, async (tx) => {
    if (!active) {
      await tx.query(
        "UPDATE research_digest_subscriptions SET active=false,updated_at=clock_timestamp() WHERE guild_id=$1 AND user_id=$2",
        [guildId, userId]
      );
      return;
    }
    invariant(
      botId && /^[1-9]\d{0,19}$/.test(botId),
      "bot_unavailable",
      "The community bot is not configured"
    );
    invariant(
      (
        await tx.query(
          "SELECT s.bot_id FROM bot_starts s JOIN users u ON u.telegram_id=s.telegram_id WHERE s.bot_id=$1 AND u.id=$2 AND s.blocked_at IS NULL",
          [botId, userId]
        )
      ).rowCount,
      "private_start_required",
      "Start this exact bot privately before opting into a digest"
    );
    await tx.query(
      "INSERT INTO research_digest_subscriptions(guild_id,user_id,bot_id,active) VALUES($1,$2,$3,true) ON CONFLICT(guild_id,user_id,bot_id) DO UPDATE SET active=true,updated_at=clock_timestamp()",
      [guildId, userId, botId]
    );
  });
}
export async function queueResearchDigests(tx: Tx): Promise<number> {
  const now = (await tx.query<{ t: Date }>("SELECT clock_timestamp() t"))
      .rows[0].t,
    week = competitionWeek(now.toISOString()),
    due = new Date(week + "T09:00:00.000Z");
  if (now < due) return 0;
  const digestWeek = new Date(
      Date.parse(week + "T00:00:00.000Z") - 7 * 86400000
    )
      .toISOString()
      .slice(0, 10),
    rows = (
      await tx.query(
        "SELECT d.guild_id,d.user_id,d.bot_id,u.telegram_id FROM research_digest_subscriptions d JOIN memberships m ON m.guild_id=d.guild_id AND m.user_id=d.user_id JOIN users u ON u.id=d.user_id JOIN bot_starts b ON b.bot_id=d.bot_id AND b.telegram_id=u.telegram_id WHERE d.active AND m.status='active' AND b.blocked_at IS NULL AND d.updated_at<=$1 AND NOT EXISTS(SELECT FROM operations o WHERE o.id='digest:'||d.bot_id||':'||d.guild_id::text||':'||d.user_id::text||':'||$2) ORDER BY d.guild_id,d.user_id LIMIT 100",
        [due, digestWeek]
      )
    ).rows;
  let queued = 0;
  for (const r of rows) {
    const operationId = `digest:${r.bot_id}:${r.guild_id}:${r.user_id}:${digestWeek}`,
      saved = await tx.query(
        "INSERT INTO operations(id,kind,state,record) VALUES($1,'telegram_command','pending',$2::jsonb) ON CONFLICT DO NOTHING RETURNING id",
        [
          operationId,
          JSON.stringify({
            command: "digest",
            botId: r.bot_id,
            senderId: r.telegram_id,
            chatId: r.telegram_id,
            chatType: "private",
            guildId: r.guild_id,
            digestWeek,
          }),
        ]
      );
    if (saved.rowCount) {
      await enqueue(tx, {
        task: "telegram_command",
        operationId,
        payload: { operationId },
      });
      queued++;
    }
  }
  return queued;
}
