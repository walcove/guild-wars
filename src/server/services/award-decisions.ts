import type { Pool } from "pg";
import { z } from "zod";
import { inGuild } from "../db/repositories";
import { transaction } from "../db/client";
import { invariant } from "../../domain/errors";
import { awardEligibility, appealOpen } from "../../domain/research-awards";
import type { Clock } from "../../domain/clock";
import { serverTime } from "./rounds";
import { assignResearchInTx } from "./bounties";
import { enqueue } from "../jobs/queue";
import { audit } from "./audit";
const decisionSchema = z
  .object({
    accept: z.boolean(),
    verifiedUseful: z.boolean(),
    reason: z.string().min(20).max(1500),
    verification: z.string().min(20).max(1500),
  })
  .strict();
export async function decideResearchAward(
  db: Pool,
  userId: string,
  submissionId: string,
  raw: unknown
) {
  const input = decisionSchema.parse(raw),
    initial = (
      await db.query("SELECT guild_id FROM research_submissions WHERE id=$1", [
        submissionId,
      ])
    ).rows[0];
  invariant(
    initial,
    "submission_unavailable",
    "Research submission unavailable"
  );
  return inGuild(db, userId, initial.guild_id, async (tx) => {
    await tx.query("SELECT id FROM guilds WHERE id=$1 FOR UPDATE", [
      initial.guild_id,
    ]);
    const s = (
      await tx.query(
        "SELECT * FROM research_submissions WHERE id=$1 FOR UPDATE",
        [submissionId]
      )
    ).rows[0];
    invariant(
      s.author_id !== userId && !s.record.conflictedUserIds.includes(userId),
      "forbidden",
      "Authors and disclosed conflicts cannot decide this award"
    );
    const a = (
      await tx.query(
        "SELECT * FROM research_assignments WHERE submission_id=$1 AND reviewer_id=$2 AND generation=(SELECT max(generation) FROM research_assignment_cycles WHERE submission_id=$1)",
        [submissionId, userId]
      )
    ).rows[0];
    invariant(
      a &&
        !(
          await tx.query(
            "SELECT id FROM research_conflicts WHERE submission_id=$1 AND reviewer_id=$2",
            [submissionId, userId]
          )
        ).rowCount,
      "forbidden",
      "Only the two ordinary members assigned to this award can record its decision"
    );
    const old = (
      await tx.query("SELECT * FROM research_reviews WHERE assignment_id=$1", [
        a.id,
      ])
    ).rows[0];
    if (old) {
      invariant(
        old.accept === input.accept &&
          old.verified_useful === input.verifiedUseful &&
          old.reason === input.reason &&
          old.verification === input.verification,
        "decision_immutable",
        "A saved written decision is immutable; use the appeal route"
      );
      return { state: "saved" };
    }
    invariant(
      !input.accept || input.verifiedUseful,
      "verification_required",
      "Acceptance requires the source and usefulness to be explicitly verified"
    );
    await tx.query(
      "INSERT INTO research_reviews(assignment_id,accept,verified_useful,reason,verification) VALUES($1,$2,$3,$4,$5)",
      [
        a.id,
        input.accept,
        input.verifiedUseful,
        input.reason,
        input.verification,
      ]
    );
    const reviews = (
      await tx.query(
        "SELECT v.* FROM research_assignments a JOIN research_reviews v ON v.assignment_id=a.id WHERE a.submission_id=$1 AND a.generation=$2",
        [submissionId, a.generation]
      )
    ).rows;
    if (reviews.length === 2) {
      const now = await serverTime(tx),
        appealClosesAt = new Date(now.getTime() + 172800000).toISOString(),
        accepted = reviews.every((v) => v.accept && v.verified_useful),
        reason = reviews.map((v) => v.reason).join("\n");
      await tx.query(
        "INSERT INTO research_outcomes(submission_id,generation,accepted,reason,appeal_closes_at,created_at) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING",
        [submissionId, a.generation, accepted, reason, appealClosesAt, now]
      );
      await enqueue(tx, {
        task: "resolve_research",
        operationId: `research-finalize:${submissionId}:${a.generation}`,
        payload: { kind: "finalize_award", submissionId },
        runAt: appealClosesAt,
      });
    }
    return { state: "saved" };
  });
}
export async function appealResearchAward(
  db: Pool,
  userId: string,
  submissionId: string,
  reason: string,
  clock?: Clock
) {
  invariant(
    reason.trim().length >= 20 && reason.length <= 1500,
    "appeal_reason",
    "Explain the source or interpretation issue in at least twenty characters"
  );
  const initial = (
    await db.query("SELECT guild_id FROM research_submissions WHERE id=$1", [
      submissionId,
    ])
  ).rows[0];
  invariant(
    initial,
    "submission_unavailable",
    "Research submission unavailable"
  );
  return inGuild(db, userId, initial.guild_id, async (tx) => {
    await tx.query("SELECT id FROM guilds WHERE id=$1 FOR UPDATE", [
      initial.guild_id,
    ]);
    const s = (
        await tx.query(
          "SELECT * FROM research_submissions WHERE id=$1 FOR UPDATE",
          [submissionId]
        )
      ).rows[0],
      outcome = (
        await tx.query(
          "SELECT * FROM research_outcomes WHERE submission_id=$1 ORDER BY generation DESC LIMIT 1",
          [submissionId]
        )
      ).rows[0],
      now = await serverTime(tx, clock);
    invariant(
      outcome &&
        appealOpen(outcome.created_at.toISOString(), now.toISOString()) &&
        now < outcome.appeal_closes_at,
      "appeal_closed",
      "The exact 48-hour appeal window has closed or no decision is recorded"
    );
    const prior = (
      await tx.query("SELECT * FROM research_appeals WHERE submission_id=$1", [
        submissionId,
      ])
    ).rows[0];
    if (prior) {
      invariant(
        prior.author_id === userId && prior.reason === reason,
        "appeal_exists",
        "An independent reconsideration is already pending or recorded"
      );
      return { state: "appeal_pending" };
    }
    await tx.query(
      "INSERT INTO research_appeals(outcome_id,submission_id,author_id,reason) VALUES($1,$2,$3,$4)",
      [outcome.id, submissionId, userId, reason]
    );
    const old = (
      await tx.query<{ id: string }>(
        "SELECT reviewer_id AS id FROM research_assignments WHERE submission_id=$1",
        [submissionId]
      )
    ).rows.map((r) => r.id);
    await assignResearchInTx(tx, s, outcome.generation + 1, [...old, userId]);
    await audit(tx, {
      actorId: userId,
      guildId: initial.guild_id,
      kind: "research_award_appealed",
      recordId: submissionId,
      reason,
    });
    return { state: "appeal_pending" };
  });
}
export async function finalizeResearchAward(
  db: Pool,
  submissionId: string,
  clock?: Clock
): Promise<string> {
  return transaction(db, async (tx) => {
    const s = (
      await tx.query(
        "SELECT * FROM research_submissions WHERE id=$1 FOR UPDATE",
        [submissionId]
      )
    ).rows[0];
    invariant(s, "submission_unavailable", "Research submission unavailable");
    const outcome = (
      await tx.query(
        "SELECT * FROM research_outcomes WHERE submission_id=$1 ORDER BY generation DESC LIMIT 1",
        [submissionId]
      )
    ).rows[0];
    if (!outcome) return "awaiting_decisions";
    const appeal = (
      await tx.query(
        "SELECT outcome_id FROM research_appeals WHERE submission_id=$1",
        [submissionId]
      )
    ).rows[0];
    if (appeal?.outcome_id === outcome.id) return "appeal_pending";
    const now = await serverTime(tx, clock);
    if (now < outcome.appeal_closes_at) return "pending_appeal";
    const rows = (
        await tx.query(
          "SELECT a.reviewer_id,v.accept,v.verified_useful FROM research_assignments a JOIN research_reviews v ON v.assignment_id=a.id WHERE a.submission_id=$1 AND a.generation=$2",
          [submissionId, outcome.generation]
        )
      ).rows,
      eligible = awardEligibility({
        registeredBeforeOutcome: true,
        verifiedUseful: outcome.accepted,
        authorId: s.author_id,
        appealPending: false,
        appealClosed: true,
        decisions: rows.map((r) => ({
          reviewerId: r.reviewer_id,
          accept: r.accept && r.verified_useful,
          conflicted: s.record.conflictedUserIds.includes(r.reviewer_id),
        })),
      });
    if (!eligible) return "not_awarded";
    for (const kind of ["learning_xp", "research_reputation"])
      await tx.query(
        "INSERT INTO recognition_events(user_id,kind,units,reason,operation_id) VALUES($1,$2,1,$3,$4) ON CONFLICT DO NOTHING",
        [
          s.author_id,
          kind,
          "Useful source-verified research; two conflict-free written decisions and completed appeal process",
          `research-recognition:${submissionId}:${kind}`,
        ]
      );
    return "recognized";
  });
}
export async function requestResearchAssignments(
  db: Pool,
  userId: string,
  submissionId: string
) {
  const f = (
    await db.query("SELECT guild_id FROM research_submissions WHERE id=$1", [
      submissionId,
    ])
  ).rows[0];
  invariant(f, "submission_unavailable", "Submission unavailable");
  return inGuild(db, userId, f.guild_id, async (tx) => {
    await tx.query("SELECT id FROM guilds WHERE id=$1 FOR UPDATE", [
      f.guild_id,
    ]);
    const s = (
        await tx.query(
          "SELECT * FROM research_submissions WHERE id=$1 FOR UPDATE",
          [submissionId]
        )
      ).rows[0],
      cycle =
        (
          await tx.query<{ n: number }>(
            "SELECT max(generation)::int n FROM research_assignment_cycles WHERE submission_id=$1",
            [submissionId]
          )
        ).rows[0].n ?? 1,
      prior = (
        await tx.query(
          "SELECT a.reviewer_id,(m.status='active' AND c.id IS NULL) AS eligible FROM research_assignments a JOIN memberships m ON m.user_id=a.reviewer_id AND m.guild_id=$2 LEFT JOIN research_conflicts c ON c.submission_id=a.submission_id AND c.reviewer_id=a.reviewer_id WHERE a.submission_id=$1 AND a.generation=$3",
          [submissionId, f.guild_id, cycle]
        )
      ).rows;
    if (prior.length === 2 && prior.every((r) => r.eligible))
      return { state: "assigned" };
    const out = (
      await tx.query(
        "SELECT id FROM research_outcomes WHERE submission_id=$1 AND generation=$2",
        [submissionId, cycle]
      )
    ).rows[0];
    invariant(
      !out,
      "decision_recorded",
      "A recorded decision uses its explicit appeal route"
    );
    const generation = prior.length ? cycle + 1 : cycle,
      old = (
        await tx.query<{ id: string }>(
          "SELECT reviewer_id AS id FROM research_assignments WHERE submission_id=$1 AND generation<$2",
          [submissionId, generation]
        )
      ).rows.map((r) => r.id),
      assigned = await assignResearchInTx(tx, s, generation, old);
    return {
      state: assigned.length === 2 ? "assigned" : "awaiting_two_members",
    };
  });
}
export async function declareResearchConflict(
  db: Pool,
  userId: string,
  submissionId: string,
  reason: string
) {
  invariant(
    reason.trim().length >= 20 && reason.length <= 1500,
    "conflict_reason",
    "Explain the relevant conflict in at least twenty characters"
  );
  const f = (
    await db.query("SELECT guild_id FROM research_submissions WHERE id=$1", [
      submissionId,
    ])
  ).rows[0];
  invariant(f, "submission_unavailable", "Submission unavailable");
  return inGuild(db, userId, f.guild_id, async (tx) => {
    await tx.query("SELECT id FROM guilds WHERE id=$1 FOR UPDATE", [
      f.guild_id,
    ]);
    const s = (
        await tx.query(
          "SELECT * FROM research_submissions WHERE id=$1 FOR UPDATE",
          [submissionId]
        )
      ).rows[0],
      a = (
        await tx.query(
          "SELECT * FROM research_assignments WHERE submission_id=$1 AND reviewer_id=$2 AND generation=(SELECT max(generation) FROM research_assignment_cycles WHERE submission_id=$1)",
          [submissionId, userId]
        )
      ).rows[0];
    invariant(
      a,
      "forbidden",
      "Only a currently assigned member declares this decision conflict"
    );
    invariant(
      !(
        await tx.query(
          "SELECT id FROM research_reviews WHERE assignment_id=$1",
          [a.id]
        )
      ).rowCount,
      "decision_recorded",
      "Use the timed appeal route after a saved decision"
    );
    await tx.query(
      "INSERT INTO research_conflicts(submission_id,reviewer_id,reason) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
      [submissionId, userId, reason]
    );
    const old = (
        await tx.query<{ id: string }>(
          "SELECT reviewer_id AS id FROM research_assignments WHERE submission_id=$1",
          [submissionId]
        )
      ).rows.map((r) => r.id),
      selected = await assignResearchInTx(tx, s, a.generation + 1, old);
    await audit(tx, {
      actorId: userId,
      guildId: f.guild_id,
      kind: "research_conflict_declared",
      recordId: submissionId,
      reason,
    });
    return {
      state: selected.length === 2 ? "reassigned" : "awaiting_two_members",
    };
  });
}
