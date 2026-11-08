import type { Pool } from "pg";
import type { ResearchCommand } from "./research-commands";
import type { BotConfiguration } from "./webhook";
import { escapeHtml, type BotCard } from "./render";
import { inGuild } from "../db/repositories";
import { guildOverview } from "../services/guilds";
import { DomainError, invariant } from "../../domain/errors";
export async function communityCommandCard(
  db: Pool,
  r: ResearchCommand & { guildId?: string; digestWeek?: string },
  config: BotConfiguration
): Promise<BotCard | null> {
  const home = {
    text: "Open your guilds",
    url: new URL("/guilds", config.origin).toString(),
  };
  try {
    const user = (
      await db.query("SELECT id FROM users WHERE telegram_id=$1", [r.senderId])
    ).rows[0];
    invariant(
      user,
      "unauthorized",
      "Connect your Telegram account before opening private community records"
    );
    if (r.command === "digest") {
      if (
        r.chatType !== "private" ||
        r.chatId !== r.senderId ||
        !r.guildId ||
        !r.digestWeek
      )
        return null;
      return await inGuild(db, user.id, r.guildId, async (tx) => {
        const consent = (
          await tx.query(
            "SELECT d.guild_id FROM research_digest_subscriptions d JOIN bot_starts b ON b.bot_id=d.bot_id WHERE d.guild_id=$1 AND d.user_id=$2 AND d.bot_id=$3 AND d.active AND b.telegram_id=$4 AND b.blocked_at IS NULL",
            [r.guildId, user.id, config.botId, r.senderId]
          )
        ).rows[0];
        if (!consent) return null;
        const guild = (
            await tx.query("SELECT name FROM guilds WHERE id=$1", [r.guildId])
          ).rows[0],
          counts = (
            await tx.query(
              "SELECT state,count(*)::int n FROM forecasts WHERE guild_id=$1 AND week=$2 GROUP BY state",
              [r.guildId, r.digestWeek]
            )
          ).rows;
        return {
          text: `<b>${escapeHtml(guild.name)} · Weekly research digest</b>\nUTC registration week: ${escapeHtml(r.digestWeek!)}\n${counts.map((c) => `${escapeHtml(c.state)}: ${c.n}`).join("\n") || "No tracked calls in this week."}\nMisses and unresolved calls remain visible. Open the selected evidence, challenges, source revisions and written award reasons. Posting volume earns no reputation; this digest contains no account amounts.\nYou can stop the digest in Community at any time.`,
          buttons: [
            [
              {
                text: "Read the research record and misses",
                url: new URL(
                  `/guilds/${r.guildId}/community`,
                  config.origin
                ).toString(),
              },
            ],
          ],
        };
      });
    }
    if (r.chatType === "private")
      return {
        text: "Choose your guild’s community page for tracked calls and bounty criteria. Research and plan building happen on the website; ordinary debate stays open.",
        buttons: [[home]],
      };
    const binding = (
      await db.query(
        "SELECT guild_id FROM group_bindings WHERE chat_id=$1 AND bot_id=$2 AND active",
        [r.chatId, config.botId]
      )
    ).rows[0];
    invariant(
      binding,
      "group_unavailable",
      "This guild group/bot binding is unavailable"
    );
    const v = await guildOverview(db, user.id, binding.guild_id),
      community = new URL(
        `/guilds/${binding.guild_id}/community`,
        config.origin
      ).toString();
    if (r.command === "results") {
      return {
        text: `${escapeHtml(v.guild.name)} · Results keep total net outcomes separate from premium and competitive points. Only consented aggregates can appear in the group; private member amounts and deviation blame are omitted.`,
        buttons: [
          [
            {
              text: "Review this guild’s results",
              url: new URL(
                `/guilds/${binding.guild_id}/results`,
                config.origin
              ).toString(),
            },
          ],
        ],
      };
    }
    return {
      text:
        r.command === "track"
          ? "Register a measurable call before its outcome: asset, claim, benchmark, source, exact deadline, confidence, disclosures and resolution rule. Three per member per UTC week. Misses remain visible; the cap never blocks ordinary discussion."
          : "One focused weekly bounty has published acceptance criteria and recognition-only budget. Any active member may contribute or challenge. Two conflict-free members rotate only for the particular award; written reasons and a 48-hour appeal remain visible.",
      buttons: [
        [
          {
            text:
              r.command === "track"
                ? "Add a tracked call"
                : "Read this week’s bounty",
            url: community,
          },
        ],
      ],
    };
  } catch (e) {
    if (r.command === "digest" && e instanceof DomainError) return null;
    if (e instanceof DomainError)
      return { text: escapeHtml(e.message), buttons: [[home]] };
    throw e;
  }
}
