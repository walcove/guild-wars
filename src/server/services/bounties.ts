import type { Pool } from "pg";
import { z } from "zod";
import { inGuild } from "../db/repositories";
import { invariant } from "../../domain/errors";
import {
  competitionWeek,
  rotateDecisionMakers,
} from "../../domain/research-awards";
import { parseUtc } from "../../domain/types";
import type { Tx } from "../db/client";
import { researchHash } from "./forecasts";
export const bountySchema = z
  .object({
    question: z.string().min(10).max(500),
    acceptanceCriteria: z.string().min(30).max(1500),
    sourceRequirements: z.string().min(15).max(1000),
    deadline: z.string(),
    budget: z.literal("recognition_only"),
  })
  .strict();
export const submissionSchema = z
  .object({
    requestId: z.uuid(),
    bountyId: z.uuid().nullable(),
    forecastId: z.uuid().nullable(),
    summary: z.string().min(30).max(1500),
    evidenceUrl: z
      .url()
      .refine(
        (v) =>
          new URL(v).protocol === "https:" &&
          !new URL(v).username &&
          !new URL(v).password
      ),
    verificationPlan: z.string().min(20).max(1500),
    disclosures: z.string().min(2).max(1000),
    conflictedUserIds: z.array(z.uuid()).max(50),
  })
  .strict();
export async function publishBounty(
  db: Pool,
  userId: string,
  guildId: string,
  input: unknown
) {
  const criteria = bountySchema.parse(input);
  parseUtc(criteria.deadline);
  return inGuild(db, userId, guildId, async (tx, scope) => {
    invariant(
      ["captain", "administrator"].includes(scope.membership.role),
      "forbidden",
      "A guild coordinator publishes the one weekly bounty; every active member can submit or challenge"
    );
    await tx.query("SELECT id FROM guilds WHERE id=$1 FOR UPDATE", [guildId]);
    const now = (await tx.query<{ t: Date }>("SELECT clock_timestamp() t"))
        .rows[0].t,
      week = competitionWeek(now.toISOString());
    invariant(
      Date.parse(criteria.deadline) > now.getTime() &&
        Date.parse(criteria.deadline) <=
          Date.parse(week + "T00:00:00.000Z") + 7 * 86400000,
      "bounty_deadline",
      "Publish a future deadline within the current UTC week"
    );
    invariant(
      !(
        await tx.query(
          "SELECT id FROM bounties WHERE guild_id=$1 AND week=$2",
          [guildId, week]
        )
      ).rowCount,
      "bounty_exists",
      "This week already has a published bounty and immutable criteria"
    );
    return (
      await tx.query(
        "INSERT INTO bounties(guild_id,week,criteria) VALUES($1,$2,$3::jsonb) RETURNING *",
        [guildId, week, JSON.stringify(criteria)]
      )
    ).rows[0];
  });
}
export async function assignResearchInTx(
  tx: Tx,
  submission: {
    id: string;
    guild_id: string;
    author_id: string;
    record: { conflictedUserIds: string[] };
  },
  generation: number,
  extraExcluded: string[] = []
) {
  await tx.query(
    "INSERT INTO research_assignment_cycles(submission_id,generation) VALUES($1,$2) ON CONFLICT DO NOTHING",
    [submission.id, generation]
  );
  const conflicts = (
    await tx.query<{ id: string }>(
      "SELECT reviewer_id AS id FROM research_conflicts WHERE submission_id=$1",
      [submission.id]
    )
  ).rows.map((r) => r.id);
  const members = (
      await tx.query<{ id: string; assignments: number }>(
        "SELECT m.user_id AS id,(SELECT count(*)::int FROM research_assignments a JOIN research_submissions s ON s.id=a.submission_id WHERE a.reviewer_id=m.user_id AND s.guild_id=m.guild_id) AS assignments FROM memberships m WHERE m.guild_id=$1 AND m.status='active' ORDER BY m.created_at,m.user_id",
        [submission.guild_id]
      )
    ).rows,
    selected = rotateDecisionMakers(members, [
      submission.author_id,
      ...submission.record.conflictedUserIds,
      ...extraExcluded,
      ...conflicts,
    ]);
  for (const id of selected)
    await tx.query(
      "INSERT INTO research_assignments(submission_id,reviewer_id,generation) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
      [submission.id, id, generation]
    );
  return selected.map((reviewerId) => ({ reviewerId, generation }));
}
export async function submitResearch(
  db: Pool,
  userId: string,
  guildId: string,
  raw: unknown
) {
  const input = submissionSchema.parse(raw),
    { requestId, bountyId, forecastId, ...record } = input,
    contentHash = researchHash({
      summary: record.summary.trim().replace(/\s+/g, " ").toLowerCase(),
      evidenceUrl: new URL(record.evidenceUrl).toString(),
      verificationPlan: record.verificationPlan
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase(),
    });
  return inGuild(db, userId, guildId, async (tx) => {
    await tx.query("SELECT id FROM guilds WHERE id=$1 FOR UPDATE", [guildId]);
    const prior = (
      await tx.query(
        "SELECT * FROM research_submissions WHERE author_id=$1 AND request_id=$2",
        [userId, requestId]
      )
    ).rows[0];
    if (prior) {
      invariant(
        prior.guild_id === guildId &&
          prior.content_hash === contentHash &&
          prior.bounty_id === bountyId &&
          prior.forecast_id === forecastId &&
          researchHash(prior.record) === researchHash(record),
        "operation_conflict",
        "This saved submission request has different terms"
      );
      const assignments = (
        await tx.query(
          'SELECT reviewer_id AS "reviewerId",generation FROM research_assignments WHERE submission_id=$1 ORDER BY generation,reviewer_id',
          [prior.id]
        )
      ).rows;
      return { ...prior, assignments };
    }
    const now = (await tx.query<{ t: Date }>("SELECT clock_timestamp() t"))
      .rows[0].t;
    if (bountyId) {
      const b = (
        await tx.query(
          "SELECT criteria FROM bounties WHERE id=$1 AND guild_id=$2",
          [bountyId, guildId]
        )
      ).rows[0];
      invariant(
        b && Date.parse(b.criteria.deadline) > now.getTime(),
        "bounty_closed",
        "Submit before the exact bounty deadline"
      );
    }
    if (forecastId)
      invariant(
        (
          await tx.query(
            "SELECT id FROM forecasts WHERE id=$1 AND guild_id=$2 AND author_id=$3 AND created_at<deadline",
            [forecastId, guildId, userId]
          )
        ).rowCount,
        "forecast_unavailable",
        "Attach your own tracked call in this guild, including a retained miss"
      );
    invariant(
      !(
        await tx.query(
          "SELECT id FROM research_submissions WHERE guild_id=$1 AND content_hash=$2",
          [guildId, contentHash]
        )
      ).rowCount,
      "duplicate_work",
      "This work is already submitted. Add a distinct sourced challenge through ordinary research rather than copying it"
    );
    const s = (
        await tx.query(
          "INSERT INTO research_submissions(guild_id,author_id,bounty_id,forecast_id,request_id,content_hash,record) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb) RETURNING *",
          [
            guildId,
            userId,
            bountyId,
            forecastId,
            requestId,
            contentHash,
            JSON.stringify(record),
          ]
        )
      ).rows[0],
      assignments = await assignResearchInTx(tx, s, 1);
    return { ...s, assignments };
  });
}
