import { afterAll, beforeAll, expect, it } from "vitest";
import type { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { setResearchDigest } from "../../src/server/jobs/research-digest";
import { communityCommandCard } from "../../src/server/telegram/community-commands";
import { testPool } from "./helpers/database";
import { syntheticGuild } from "./helpers/fixtures";
import {
  registerForecast,
  readCommunity,
  resolveRegisteredForecast,
} from "../../src/server/services/forecasts";
import {
  publishBounty,
  submitResearch,
} from "../../src/server/services/bounties";
import {
  decideResearchAward,
  appealResearchAward,
  finalizeResearchAward,
} from "../../src/server/services/award-decisions";
let db: Pool;
beforeAll(() => {
  db = testPool();
});
afterAll(async () => {
  await db.end();
});
const input = (n: number) => ({
  asset: "SOL",
  claim: `Original synthetic measurable claim ${n}`,
  metric: "closing_price",
  operator: "above" as const,
  target: String(100 + n),
  benchmark: "USD per SOL",
  sourceUrl: "https://status.solana.com/",
  deadline: new Date(Date.now() + 86400000).toISOString(),
  confidence: 60,
  disclosures: "Synthetic original test only",
  resolutionRule:
    "Read the first documented value at the exact deadline; absent source remains unresolved",
});
async function members(guildId: string, n = 4) {
  const ids = [];
  for (let i = 0; i < n; i++) {
    const id = randomUUID();
    await db.query("INSERT INTO users(id,telegram_id) VALUES($1,$2)", [
      id,
      (BigInt("0x" + id.replaceAll("-", "").slice(0, 12)) + 1n).toString(),
    ]);
    await db.query(
      "INSERT INTO memberships(guild_id,user_id,role,status) VALUES($1,$2,'member','active')",
      [guildId, id]
    );
    ids.push(id);
  }
  return ids;
}
it("atomically enforces three forecasts per member/week, idempotency, immutable terms and retained misses", async () => {
  const f = await syntheticGuild(db),
    requestId = randomUUID(),
    t = input(1),
    a = await registerForecast(db, f.userId, f.guildId, {
      requestId,
      terms: t,
    });
  expect(
    (await registerForecast(db, f.userId, f.guildId, { requestId, terms: t }))
      .id
  ).toBe(a.id);
  const attempts = await Promise.allSettled(
    [2, 3, 4].map((n) =>
      registerForecast(db, f.userId, f.guildId, {
        requestId: randomUUID(),
        terms: input(n),
      })
    )
  );
  expect(attempts.filter((r) => r.status === "fulfilled")).toHaveLength(2);
  expect(
    (await readCommunity(db, f.userId, f.guildId)).remainingForecasts
  ).toBe(0);
  await expect(
    db.query("UPDATE forecasts SET terms='{}' WHERE id=$1", [a.id])
  ).rejects.toThrow(/immutable/);
  const at = t.deadline;
  await resolveRegisteredForecast(
    db,
    a.id,
    {
      revision: "original-synthetic-miss",
      sourceUrl: t.sourceUrl,
      value: "99",
      observedAt: at,
      source: {
        sourceId: "original-synthetic-resolution",
        observedAt: at,
        receivedAt: at,
        synthetic: true,
      },
      dataClass: "teaching_only",
      dataRightsReference: null,
      sourceRecordReference: "original-synthetic-record",
    },
    { now: () => new Date(at) }
  );
  const community = await readCommunity(db, f.userId, f.guildId);
  expect(community.forecasts.find((v) => v.id === a.id)?.outcome).toMatchObject(
    { result: "miss", dataClass: "teaching_only" }
  );
  expect(community.recognition).toEqual({
    learningXp: 0,
    researchReputation: 0,
    seasonPoints: "Separate competitive score ledger",
  });
});
it("locks one recognition-only bounty/week, detects duplicate work and assigns two ordinary conflict-free rotating members", async () => {
  const f = await syntheticGuild(db),
    others = await members(f.guildId),
    at = (await db.query<{ t: Date }>("SELECT clock_timestamp() t")).rows[0].t,
    b = await publishBounty(db, f.userId, f.guildId, {
      question: "Check the downside evidence",
      acceptanceCriteria:
        "Document one primary source, its uncertainty and a useful opposing view",
      sourceRequirements:
        "Original public source with a recorded observation time",
      deadline: new Date(at.getTime() + 3600000).toISOString(),
      budget: "recognition_only",
    });
  await expect(
    publishBounty(db, f.userId, f.guildId, { ...b.criteria })
  ).rejects.toMatchObject({ code: "bounty_exists" });
  const work = {
    requestId: randomUUID(),
    bountyId: b.id,
    forecastId: null,
    summary:
      "Original synthetic analysis including limitations and an opposing view",
    evidenceUrl: "https://status.solana.com/",
    verificationPlan:
      "Compare the source record and state uncertainty; synthetic original fixture",
    disclosures: "No paid interests",
    conflictedUserIds: [others[0]],
  };
  const sub = await submitResearch(db, f.userId, f.guildId, work);
  expect(sub.assignments).toHaveLength(2);
  expect(
    sub.assignments.some((v: { reviewerId: string }) =>
      [f.userId, others[0]].includes(v.reviewerId)
    )
  ).toBe(false);
  await expect(
    submitResearch(db, others[3], f.guildId, {
      ...work,
      requestId: randomUUID(),
      conflictedUserIds: [],
    })
  ).rejects.toMatchObject({ code: "duplicate_work" });
  await expect(
    decideResearchAward(db, f.userId, sub.id, {
      accept: true,
      verifiedUseful: true,
      reason: "The author cannot decide their own useful work",
      verification: "Original source inspected; test fixture",
    })
  ).rejects.toMatchObject({ code: "forbidden" });
});
it("requires two written decisions and a closed 48-hour appeal; appeal uses new members and no per-message or valuable rewards", async () => {
  const f = await syntheticGuild(db);
  await members(f.guildId, 4);
  const sub = await submitResearch(db, f.userId, f.guildId, {
    requestId: randomUUID(),
    bountyId: null,
    forecastId: null,
    summary:
      "Original sourced challenge improves the covered-call risk discussion",
    evidenceUrl: "https://status.solana.com/",
    verificationPlan:
      "The source and uncertainty are checked by the assigned members",
    disclosures: "No conflicts",
    conflictedUserIds: [],
  });
  for (const a of sub.assignments)
    await decideResearchAward(db, a.reviewerId, sub.id, {
      accept: true,
      verifiedUseful: true,
      reason:
        "Useful sourced challenge; uncertainties and opposing view documented",
      verification:
        "Assigned member verified the cited source and clear limitations",
    });
  const out = (await readCommunity(db, f.userId, f.guildId)).submissions.find(
    (v) => v.id === sub.id
  )!.outcome;
  expect(await finalizeResearchAward(db, sub.id)).toBe("pending_appeal");
  await appealResearchAward(
    db,
    f.userId,
    sub.id,
    "The source interpretation needs another independent check"
  );
  expect(
    await finalizeResearchAward(db, sub.id, {
      now: () => new Date(Date.parse(out.appealClosesAt) + 1),
    })
  ).toBe("appeal_pending");
  const assignments = (
    await db.query(
      "SELECT reviewer_id FROM research_assignments WHERE submission_id=$1 AND generation=2",
      [sub.id]
    )
  ).rows;
  expect(assignments).toHaveLength(2);
  for (const a of assignments)
    await decideResearchAward(db, a.reviewer_id, sub.id, {
      accept: true,
      verifiedUseful: true,
      reason:
        "Independent reconsideration confirms useful evidence and records limitations",
      verification: "New assigned members checked the cited source and appeal",
    });
  const revised = (
    await readCommunity(db, f.userId, f.guildId)
  ).submissions.find((v) => v.id === sub.id)!.outcome;
  expect(
    await finalizeResearchAward(db, sub.id, {
      now: () => new Date(Date.parse(revised.appealClosesAt) + 1),
    })
  ).toBe("recognized");
  expect(
    await finalizeResearchAward(db, sub.id, {
      now: () => new Date(Date.parse(revised.appealClosesAt) + 1),
    })
  ).toBe("recognized");
  const r = (await readCommunity(db, f.userId, f.guildId)).recognition;
  expect(r.learningXp).toBe(1);
  expect(r.researchReputation).toBe(1);
  expect(
    (
      await db.query(
        "SELECT count(*)::int n FROM recognition_events WHERE user_id=$1",
        [f.userId]
      )
    ).rows[0].n
  ).toBe(2);
});

it("requires the exact bot private start and rechecks opt-in/membership before a digest, without any live transport", async () => {
  const f = await syntheticGuild(db);
  await expect(
    setResearchDigest(db, f.userId, f.guildId, true, "9001")
  ).rejects.toMatchObject({ code: "private_start_required" });
  await db.query(
    "INSERT INTO bot_starts(bot_id,telegram_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
    ["9002", f.telegramId]
  );
  await expect(
    setResearchDigest(db, f.userId, f.guildId, true, "9001")
  ).rejects.toMatchObject({ code: "private_start_required" });
  await db.query(
    "INSERT INTO bot_starts(bot_id,telegram_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
    ["9001", f.telegramId]
  );
  await setResearchDigest(db, f.userId, f.guildId, true, "9001");
  const config = {
      botId: "9001",
      username: "synthetic_bot",
      secret: "synthetic-secret-not-a-credential",
      origin: "http://127.0.0.1:3000",
    },
    record = {
      command: "digest",
      guildId: f.guildId,
      digestWeek: "2026-11-02",
      chatType: "private",
      chatId: f.telegramId,
      senderId: f.telegramId,
    };
  expect((await communityCommandCard(db, record, config))?.text).toContain(
    "Misses and unresolved"
  );
  await setResearchDigest(db, f.userId, f.guildId, false, null);
  expect(await communityCommandCard(db, record, config)).toBeNull();
  await setResearchDigest(db, f.userId, f.guildId, true, "9001");
  await db.query(
    "UPDATE memberships SET status='departed' WHERE guild_id=$1 AND user_id=$2",
    [f.guildId, f.userId]
  );
  expect(await communityCommandCard(db, record, config)).toBeNull();
});
it("recovers missing award decision makers after members join and lets an assigned member disclose a newly found conflict", async () => {
  const f = await syntheticGuild(db),
    sub = await submitResearch(db, f.userId, f.guildId, {
      requestId: randomUUID(),
      bountyId: null,
      forecastId: null,
      summary:
        "Original evidence with explicit uncertainty and source verification",
      evidenceUrl: "https://status.solana.com/",
      verificationPlan:
        "Check the original source before deciding the useful finding",
      disclosures: "No known conflicts at entry",
      conflictedUserIds: [],
    });
  expect(sub.assignments).toHaveLength(0);
  await members(f.guildId, 4);
  const { requestResearchAssignments, declareResearchConflict } =
    await import("../../src/server/services/award-decisions");
  await requestResearchAssignments(db, f.userId, sub.id);
  const old = (
    await db.query(
      "SELECT reviewer_id FROM research_assignments WHERE submission_id=$1 AND generation=1",
      [sub.id]
    )
  ).rows;
  expect(old).toHaveLength(2);
  await declareResearchConflict(
    db,
    old[0].reviewer_id,
    sub.id,
    "I have now discovered a relevant personal relationship"
  );
  const fresh = (
    await db.query(
      "SELECT reviewer_id FROM research_assignments WHERE submission_id=$1 AND generation=2",
      [sub.id]
    )
  ).rows;
  expect(fresh).toHaveLength(2);
  expect(
    fresh.every((r) => !old.some((o) => o.reviewer_id === r.reviewer_id))
  ).toBe(true);
  await expect(
    decideResearchAward(db, old[0].reviewer_id, sub.id, {
      accept: true,
      verifiedUseful: true,
      reason: "Old assignment cannot decide after a conflict is declared",
      verification: "An independent source verification is required here",
    })
  ).rejects.toMatchObject({ code: "forbidden" });
});
it("keeps older misses reachable through a guild-bound cursor without losing microsecond timestamps", async () => {
  const f = await syntheticGuild(db);
  await db.query(
    "INSERT INTO forecasts(guild_id,author_id,terms,deadline,week,state,created_at) SELECT $1,$2,$3::jsonb,clock_timestamp()+interval '1 day','2026-10-26','miss','2026-11-01T01:02:03.123400Z'::timestamptz+i*interval '1 microsecond' FROM generate_series(1,51) i",
    [f.guildId, f.userId, JSON.stringify(input(50))]
  );
  const first = await readCommunity(db, f.userId, f.guildId);
  expect(first.forecasts).toHaveLength(50);
  expect(first.nextForecastCursor).toBeTruthy();
  const next = await readCommunity(
    db,
    f.userId,
    f.guildId,
    first.nextForecastCursor!
  );
  expect(next.forecasts).toHaveLength(1);
  expect(
    new Set([...first.forecasts, ...next.forecasts].map((r) => r.id)).size
  ).toBe(51);
  const other = await syntheticGuild(db);
  await expect(
    readCommunity(db, other.userId, other.guildId, first.nextForecastCursor!)
  ).rejects.toMatchObject({ code: "invalid_cursor" });
});
it("routes selected regular bot community commands to the bound guild website without a Mini App or private amounts", async () => {
  const { syntheticProposal } = await import("./helpers/proposals"),
    f = await syntheticProposal(db),
    config = {
      botId: "9001",
      username: "synthetic_bot",
      secret: "synthetic-not-a-real-secret",
      origin: "http://127.0.0.1:3000",
    };
  for (const command of ["track", "bounty", "results"]) {
    const card = await communityCommandCard(
      db,
      {
        command,
        chatType: "supergroup",
        chatId: f.chatId,
        senderId: f.telegramId,
      },
      config
    );
    expect(card).not.toBeNull();
    expect(JSON.stringify(card)).not.toMatch(
      /web_app|MiniApp|privateProviderToken/
    );
    expect(card!.buttons[0][0]).toMatchObject({
      url: `http://127.0.0.1:3000/guilds/${f.guildId}/${command === "results" ? "results" : "community"}`,
    });
  }
  const other = await syntheticGuild(db),
    denied = await communityCommandCard(
      db,
      {
        command: "results",
        chatType: "supergroup",
        chatId: f.chatId,
        senderId: other.telegramId,
      },
      config
    );
  expect(denied?.text).not.toContain("Synthetic test guild");
});
