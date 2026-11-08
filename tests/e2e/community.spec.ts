import {sessionCookieName,csrfCookieName} from './helpers/cookies';
import { test, expect } from "@playwright/test";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { requireTestDatabaseUrl } from "../../src/server/db/test-target";
import { transaction } from "../../src/server/db/client";
import { createSession } from "../../src/server/auth/sessions";
import { systemClock } from "../../src/domain/clock";
import { syntheticGuild } from "../integration/helpers/fixtures";
let db: Pool;
test.beforeAll(() => {
  db = new Pool({
    connectionString: requireTestDatabaseUrl(process.env.TEST_DATABASE_URL),
    max: 2,
  });
});
test.afterAll(async () => {
  await db.end();
});
test.use({ timezoneId: "UTC" });
for (const width of [390, 1360])
  test(`newcomer tracked call, retained write and cap without a discussion gate at ${width}px`, async ({
    page,
    context,
  }) => {
    const f = await syntheticGuild(db),
      s = await transaction(db, (tx) =>
        createSession(tx, f.userId, systemClock)
      ),
      errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await context.addCookies([
      {
        name:sessionCookieName,secure:process.env.GW_E2E_PRODUCTION==='true',
        value: s.sessionToken,
        url:process.env.GW_E2E_PRODUCTION==='true'?'https://127.0.0.1:3000':'http://127.0.0.1:3000',
        httpOnly: true,
        sameSite: "Lax",
      },
      {
        name:csrfCookieName,secure:process.env.GW_E2E_PRODUCTION==='true',
        value: s.csrfToken,
        url:process.env.GW_E2E_PRODUCTION==='true'?'https://127.0.0.1:3000':'http://127.0.0.1:3000',
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/guilds/${f.guildId}/community`);
    await expect(
      page.getByRole("heading", { name: "Bring useful evidence" })
    ).toBeVisible();
    await expect(
      page.getByText("3 of 3 registrations remain", { exact: true })
    ).toBeVisible();
    await page
      .getByText("Add a measurable tracked call", { exact: true })
      .click();
    const terms = {
      asset: "SOL",
      claim: "Original synthetic browser claim before a measurable outcome",
      metric: "closing_price",
      operator: "above",
      target: "100",
      benchmark: "USD per SOL",
      sourceUrl: "https://status.solana.com/",
      deadline: new Date(Date.now() + 86400000).toISOString(),
      confidence: 60,
      disclosures: "Original synthetic browser fixture; no real forecast",
      resolutionRule:
        "Read the original declared value at the exact deadline; missing source remains unresolved",
    };
    for (const [label, key] of [
      ["Asset or topic", "asset"],
      ["One measurable claim", "claim"],
      ["Metric", "metric"],
      ["Target value", "target"],
      ["Benchmark and units", "benchmark"],
      ["Original resolution source URL", "sourceUrl"],
      ["Interests and position disclosures", "disclosures"],
      ["Exact resolution rule", "resolutionRule"],
    ] as const)
      await page.getByLabel(label, { exact: true }).fill(String(terms[key]));
    await page
      .getByLabel("Outcome deadline in your local time")
      .fill(terms.deadline.slice(0, 16));
    await page.getByLabel("Confidence percentage").fill("60");
    const endpoint = `**/api/guilds/${f.guildId}/community`;
    await page.route(endpoint, (route) =>
      route.request().method() === "POST"
        ? route.abort("failed")
        : route.continue()
    );
    await page
      .getByRole("button", { name: "Register these fixed terms" })
      .click();
    await expect(
      page.getByRole("alert").filter({ hasText: "Your form text is retained" })
    ).toBeVisible();
    await expect(page.getByLabel("One measurable claim")).toHaveValue(
      terms.claim
    );
    await page.unroute(endpoint);
    await page
      .getByRole("button", { name: "Register these fixed terms" })
      .click();
    await expect(page.getByRole("status")).toContainText(
      "Saved to the shared research record"
    );
    await expect(
      page.getByRole("heading", { name: terms.claim })
    ).toBeVisible();
    for (const n of [2, 3]) {
      const r = await page.request.post(`/api/guilds/${f.guildId}/community`, {
        headers: { origin: "http://127.0.0.1:3000", "x-gw-csrf": s.csrfToken },
        data: {
          action: "forecast",
          requestId: randomUUID(),
          terms: {
            ...terms,
            claim: terms.claim + " " + n,
            target: String(100 + n),
          },
        },
      });
      expect(r.status()).toBe(201);
    }
    await page.reload();
    await expect(
      page.getByText("0 of 3 registrations remain", { exact: true })
    ).toBeVisible();
    await page
      .getByText("Add a measurable tracked call", { exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Register these fixed terms" })
    ).toBeDisabled();
    await expect(
      page.getByRole("button", {
        name: "Submit for source and usefulness decisions",
      })
    ).toBeEnabled();
    await expect(
      page.getByText("Unavailable: the community bot is not configured.", {
        exact: true,
      })
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth)
    ).toBeLessThanOrEqual(width);
    expect(errors).toEqual([]);
    await page.screenshot({
      path: `.local/screenshots/community-${width}.png`,
      fullPage: true,
    });
    const api = await page.request.get(`/api/guilds/${f.guildId}/community`);
    expect(api.headers()["cache-control"]).toBe("private, no-store");
    expect((await api.json()).recognition).toMatchObject({
      learningXp: 0,
      researchReputation: 0,
    });
  });
test("an ordinary assigned member opens the exact submission and saves a source decision without earning posting rewards", async ({
  page,
  context,
}) => {
  const f = await syntheticGuild(db);
  for (let n = 0; n < 2; n++) {
    const id = randomUUID();
    await db.query("INSERT INTO users(id,telegram_id) VALUES($1,$2)", [
      id,
      (BigInt("0x" + id.replaceAll("-", "").slice(0, 12)) + 1n).toString(),
    ]);
    await db.query(
      "INSERT INTO memberships(guild_id,user_id,role,status) VALUES($1,$2,'member','active')",
      [f.guildId, id]
    );
  }
  const { submitResearch } = await import("../../src/server/services/bounties"),
    sub = await submitResearch(db, f.userId, f.guildId, {
      requestId: randomUUID(),
      bountyId: null,
      forecastId: null,
      summary:
        "Original synthetic sourced challenge with uncertainty and opposing evidence",
      evidenceUrl: "https://status.solana.com/",
      verificationPlan:
        "Original synthetic browser test; no native source verification is inferred",
      disclosures: "Original synthetic test only",
      conflictedUserIds: [],
    }),
    reviewerId = sub.assignments[0].reviewerId,
    s = await transaction(db, (tx) =>
      createSession(tx, reviewerId, systemClock)
    );
  await context.addCookies([
    {
      name:sessionCookieName,secure:process.env.GW_E2E_PRODUCTION==='true',
      value: s.sessionToken,
      url:process.env.GW_E2E_PRODUCTION==='true'?'https://127.0.0.1:3000':'http://127.0.0.1:3000',
      httpOnly: true,
      sameSite: "Lax",
    },
    {
      name:csrfCookieName,secure:process.env.GW_E2E_PRODUCTION==='true',
      value: s.csrfToken,
      url:process.env.GW_E2E_PRODUCTION==='true'?'https://127.0.0.1:3000':'http://127.0.0.1:3000',
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  await page.goto(`/guilds/${f.guildId}/community/submissions/${sub.id}`);
  await expect(
    page.getByRole("heading", { name: "Written research decision" })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: sub.record.summary })
  ).toBeVisible();
  await page.getByLabel("Decision", { exact: true }).selectOption("yes");
  await page
    .getByLabel("I checked the source and usefulness, including uncertainty")
    .check();
  await page
    .getByLabel("What you verified", { exact: true })
    .fill(
      "Original synthetic browser decision; source method and uncertainty checked"
    );
  await page
    .getByLabel("Written reason", { exact: true })
    .fill(
      "Useful original synthetic analysis demonstrates a sourced opposing view"
    );
  await page
    .getByRole("button", { name: "Save this written decision" })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Saved to the shared research record"
  );
  await expect(
    page.getByRole("button", { name: "Save this written decision" })
  ).toHaveCount(0);
  expect(
    (
      await db.query(
        "SELECT count(*)::int n FROM recognition_events WHERE user_id=$1",
        [f.userId]
      )
    ).rows[0].n
  ).toBe(0);
});
