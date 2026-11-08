import type { Pool } from "pg";
import { z } from "zod";
import { createHash } from "node:crypto";
import { inGuild } from "../db/repositories";
import { transaction, type Tx } from "../db/client";
import { DomainError, invariant } from "../../domain/errors";
import {
  forecastTerms,
  resolveForecast,
  competitionWeek,
  type ForecastTerms,
} from "../../domain/research-awards";
import { canonicalJson } from "../../domain/proposals";
import { parseSource, parseUtc, type SourceStamp } from "../../domain/types";
import {assertPermittedDerivedSources} from '../providers/derived-source-permissions';
import type { Clock } from "../../domain/clock";
import { telegramConfiguration } from "../telegram/bot";
import { enqueue } from "../jobs/queue";
import { serverTime } from "./rounds";
export const researchHash = (v: unknown) =>
  createHash("sha256").update(canonicalJson(v)).digest("hex");
export async function registerForecast(
  db: Pool,
  userId: string,
  guildId: string,
  input: { requestId: string; terms: unknown; supersedesId?: string | null }
) {
  z.uuid().parse(input.requestId);
  return inGuild(db, userId, guildId, async (tx) => {
    await tx.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [userId]);
    const now = (await tx.query<{ t: Date }>("SELECT clock_timestamp() t"))
        .rows[0].t,
      terms = forecastTerms(input.terms, now.toISOString()),
      hash = researchHash(terms),
      prior = (
        await tx.query(
          "SELECT f.* FROM forecast_registrations m JOIN forecasts f ON f.id=m.forecast_id WHERE m.author_id=$1 AND m.request_id=$2",
          [userId, input.requestId]
        )
      ).rows[0];
    if (prior) {
      invariant(
        prior.guild_id === guildId && researchHash(prior.terms) === hash,
        "operation_conflict",
        "This saved request has different forecast terms"
      );
      return prior;
    }
    const week = competitionWeek(now.toISOString()),
      n = (
        await tx.query<{ n: number }>(
          "SELECT count(*)::int n FROM forecasts WHERE author_id=$1 AND week=$2",
          [userId, week]
        )
      ).rows[0].n;
    invariant(
      n < 3,
      "forecast_cap",
      "Three tracked calls per member per UTC week; ordinary evidence and discussion remain open"
    );
    invariant(
      !(
        await tx.query(
          "SELECT forecast_id FROM forecast_registrations WHERE author_id=$1 AND terms_hash=$2",
          [userId, hash]
        )
      ).rowCount,
      "duplicate_forecast",
      "These exact terms are already tracked"
    );
    if (input.supersedesId) {
      const old = (
        await tx.query(
          "SELECT deadline,state FROM forecasts WHERE id=$1 AND guild_id=$2 AND author_id=$3",
          [input.supersedesId, guildId, userId]
        )
      ).rows[0];
      invariant(
        old && old.state === "unresolved" && old.deadline > now,
        "forecast_revision",
        "Only your own not-yet-due forecast can have a new retained revision"
      );
    }
    const saved = (
      await tx.query(
        "INSERT INTO forecasts(guild_id,author_id,terms,deadline,week,state) VALUES($1,$2,$3::jsonb,$4,$5,'unresolved') RETURNING *",
        [guildId, userId, JSON.stringify(terms), terms.deadline, week]
      )
    ).rows[0];
    await enqueue(tx, {
      task: "resolve_research",
      operationId: `forecast-resolve:${saved.id}`,
      payload: { kind: "forecast", forecastId: saved.id },
      runAt: terms.deadline,
    });
    await tx.query(
      "INSERT INTO forecast_registrations(forecast_id,author_id,request_id,terms_hash,supersedes_id) VALUES($1,$2,$3,$4,$5)",
      [saved.id, userId, input.requestId, hash, input.supersedesId ?? null]
    );
    return saved;
  });
}
export interface ForecastEvidence {
  revision: string;
  sourceUrl: string;
  value: string;
  observedAt: string;
  source: SourceStamp;
  dataClass: "teaching_only" | "permitted_reference";
  dataRightsReference: string | null;
  sourceRecordReference: string;
}
// Internal source adapter port; unavailable in the configured worker until a source/rights contract exists.
export async function resolveRegisteredForecast(
  db: Pool,
  id: string,
  e: ForecastEvidence,
  clock?: Clock
) {
  await transaction(db, async (tx) => {
    const f = (
      await tx.query<{ id: string; terms: ForecastTerms; deadline: Date }>(
        "SELECT * FROM forecasts WHERE id=$1 FOR UPDATE",
        [id]
      )
    ).rows[0];
    invariant(f, "forecast_unavailable", "Tracked call unavailable");
    const now = await serverTime(tx, clock);
    parseUtc(e.observedAt);
    parseSource(e.source);
    invariant(
      now >= f.deadline &&
        e.observedAt === f.terms.deadline &&
        e.source.observedAt === e.observedAt &&
        e.sourceUrl === f.terms.sourceUrl,
      "forecast_source",
      "Resolve only after the original deadline with the exact declared source and observation"
    );
    invariant(
      e.dataClass === "teaching_only"
        ? e.source.synthetic
        : !e.source.synthetic && !!e.dataRightsReference,
      "source_rights",
      "Source permission and data classification are required"
    );
    invariant(
      /^[A-Za-z0-9:_-]{1,128}$/.test(e.revision) &&
        e.sourceRecordReference.length >= 3 &&
        e.sourceRecordReference.length <= 256,
      "forecast_source",
      "An auditable source record/revision is required"
    );
    if(e.dataClass==='permitted_reference')assertPermittedDerivedSources(e.dataRightsReference,[e.source],'research');
    const result = resolveForecast(f.terms, {
        value: e.value,
        observedAt: e.observedAt,
        verified: true,
      }),
      record = {
        result,
        dataClass: e.dataClass,
        value: e.value,
        source: e.source,
        sourceRecordReference: e.sourceRecordReference,
        revision: e.revision,
      };
    const prior = (
      await tx.query(
        "SELECT record FROM forecast_resolutions WHERE forecast_id=$1 AND revision=$2",
        [id, e.revision]
      )
    ).rows[0];
    if (prior) {
      invariant(
        researchHash(prior.record) === researchHash(record),
        "resolution_changed",
        "Append a new source correction revision"
      );
      return;
    }
    await tx.query(
      "INSERT INTO forecast_resolutions(forecast_id,revision,record) VALUES($1,$2,$3::jsonb)",
      [id, e.revision, JSON.stringify(record)]
    );
    await tx.query(
      "UPDATE forecasts SET state=$2,outcome=$3::jsonb WHERE id=$1",
      [id, result, JSON.stringify(record)]
    );
  });
}
export async function readCommunity(
  db: Pool,
  userId: string,
  guildId: string,
  forecastCursor?: string | null,
  submissionCursor?: string | null,
  focusSubmissionId?: string | null
) {
  return inGuild(db, userId, guildId, async (tx, scope) => {
    if (focusSubmissionId) z.uuid().parse(focusSubmissionId);
    const sc = readCommunityCursor(submissionCursor, guildId, "submission"),
      now = (await tx.query<{ t: Date }>("SELECT clock_timestamp() t")).rows[0]
        .t,
      week = competitionWeek(now.toISOString()),
      guild = (await tx.query("SELECT name FROM guilds WHERE id=$1", [guildId]))
        .rows[0],
      forecastPage = await listForecastPage(tx, guildId, forecastCursor),
      bounty =
        (
          await tx.query(
            "SELECT id,criteria,week FROM bounties WHERE guild_id=$1 AND week=$2",
            [guildId, week]
          )
        ).rows[0] ?? null;
    const submissionPage = (
      await tx.query(
        `SELECT to_char(s.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "cursorAt",s.id,s.author_id AS "authorId",s.bounty_id AS "bountyId",s.forecast_id AS "forecastId",s.record,s.created_at AS "createdAt",
 (SELECT jsonb_build_object('id',o.id,'accepted',o.accepted,'reason',o.reason,'generation',o.generation,'appealClosesAt',to_char(o.appeal_closes_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) FROM research_outcomes o WHERE o.submission_id=s.id ORDER BY o.generation DESC LIMIT 1) AS outcome,
 (SELECT count(*)::int FROM research_appeals a WHERE a.submission_id=s.id) AS appeals,
 (SELECT EXISTS(SELECT FROM research_appeals a JOIN research_outcomes o ON o.id=a.outcome_id WHERE a.submission_id=s.id AND o.generation=(SELECT max(o2.generation) FROM research_outcomes o2 WHERE o2.submission_id=s.id))) AS "appealPending",
 (SELECT EXISTS(SELECT FROM recognition_events r WHERE r.operation_id='research-recognition:'||s.id::text||':research_reputation')) AS recognized
 FROM research_submissions s WHERE s.guild_id=$1 AND ($4::uuid IS NULL OR s.id=$4) AND ($2::timestamptz IS NULL OR (s.created_at,s.id)<($2::timestamptz,$3::uuid)) ORDER BY s.created_at DESC,s.id DESC LIMIT 51`,
        [guildId, sc?.time ?? null, sc?.id ?? null, focusSubmissionId ?? null]
      )
    ).rows;
    if (focusSubmissionId)
      invariant(
        submissionPage.length === 1,
        "forbidden",
        "Research submission unavailable in this guild"
      );
    const assignments = (
        await tx.query(
          `SELECT a.id,a.submission_id AS "submissionId",a.generation,(v.id IS NOT NULL) AS decided FROM research_assignments a JOIN research_submissions s ON s.id=a.submission_id LEFT JOIN research_reviews v ON v.assignment_id=a.id WHERE s.guild_id=$1 AND a.reviewer_id=$2 AND ($3::uuid IS NULL OR a.submission_id=$3) AND a.generation=(SELECT max(a2.generation) FROM research_assignment_cycles a2 WHERE a2.submission_id=a.submission_id) ORDER BY a.created_at DESC LIMIT 50`,
          [guildId, userId, focusSubmissionId ?? null]
        )
      ).rows,
      counts = (
        await tx.query<{ n: number }>(
          "SELECT count(*)::int n FROM forecasts WHERE author_id=$1 AND week=$2",
          [userId, week]
        )
      ).rows[0].n,
      recognition = (
        await tx.query<{ kind: string; n: number }>(
          "SELECT kind,sum(units)::int n FROM recognition_events WHERE user_id=$1 GROUP BY kind",
          [userId]
        )
      ).rows;
    let botId: string | null = null;
    try {
      botId = telegramConfiguration().botId;
    } catch {}
    const digest = (
        await tx.query(
          "SELECT d.active FROM research_digest_subscriptions d WHERE d.guild_id=$1 AND d.user_id=$2 AND d.bot_id=$3",
          [guildId, userId, botId]
        )
      ).rows[0],
      started = botId
        ? (
            await tx.query(
              "SELECT b.bot_id FROM bot_starts b JOIN users u ON u.telegram_id=b.telegram_id WHERE u.id=$1 AND b.bot_id=$2 AND b.blocked_at IS NULL",
              [userId, botId]
            )
          ).rowCount === 1
        : false;
    return {
      digest: {
        botConfigured: !!botId,
        privateStarted: started,
        active: digest?.active ?? false,
        sendingEnabled: process.env.GW_TELEGRAM_SENDING_ENABLED === "true",
      },
      guildId,
      guildName: guild.name,
      canCoordinate: ["captain", "administrator"].includes(
        scope.membership.role
      ),
      week,
      checkedAt: now.toISOString(),
      remainingForecasts: Math.max(0, 3 - counts),
      forecasts: forecastPage.records,
      bounty,
      submissions: submissionPage.slice(0, 50),
      assignments,
      nextForecastCursor: forecastPage.nextCursor,
      nextSubmissionCursor: communityNextCursor(
        submissionPage,
        guildId,
        "submission"
      ),
      recognition: {
        learningXp: recognition.find((r) => r.kind === "learning_xp")?.n ?? 0,
        researchReputation:
          recognition.find((r) => r.kind === "research_reputation")?.n ?? 0,
        seasonPoints: "Separate competitive score ledger",
      },
      valuableAwardsAvailable: false,
      budget: "Recognition only; no funded valuable award budget is published.",
    };
  });
}
const communityCursorSchema = z
  .object({
    guild: z.uuid(),
    kind: z.enum(["forecast", "submission"]),
    time: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/)
      .refine((v) => Number.isFinite(Date.parse(v))),
    id: z.uuid(),
  })
  .strict();
function readCommunityCursor(
  raw: string | null | undefined,
  guild: string,
  kind: "forecast" | "submission"
) {
  if (!raw) return null;
  try {
    invariant(raw.length <= 512, "invalid_cursor", "Invalid cursor");
    const c = communityCursorSchema.parse(
      JSON.parse(Buffer.from(raw, "base64url").toString("utf8"))
    );
    invariant(
      c.guild === guild && c.kind === kind,
      "invalid_cursor",
      "Cursor belongs to another community record"
    );
    return c;
  } catch {
    throw new DomainError(
      "invalid_cursor",
      "Reload this community to restart its history list"
    );
  }
}
function communityNextCursor(
  rows: { id: string; cursorAt: string }[],
  guild: string,
  kind: "forecast" | "submission"
) {
  const last = rows[49];
  return rows.length > 50 && last
    ? Buffer.from(
        JSON.stringify({ guild, kind, time: last.cursorAt, id: last.id })
      ).toString("base64url")
    : null;
}
async function listForecastPage(tx: Tx, guild: string, raw?: string | null) {
  const c = readCommunityCursor(raw, guild, "forecast"),
    rows = (
      await tx.query(
        `SELECT to_char(f.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "cursorAt",f.id,f.author_id AS "authorId",f.terms,f.state,f.outcome,f.created_at AS "createdAt",m.supersedes_id AS "supersedesId" FROM forecasts f LEFT JOIN forecast_registrations m ON m.forecast_id=f.id WHERE f.guild_id=$1 AND ($2::timestamptz IS NULL OR (f.created_at,f.id)<($2::timestamptz,$3::uuid)) ORDER BY f.created_at DESC,f.id DESC LIMIT 51`,
        [guild, c?.time ?? null, c?.id ?? null]
      )
    ).rows;
  return {
    records: rows.slice(0, 50),
    nextCursor: communityNextCursor(rows, guild, "forecast"),
  };
}
