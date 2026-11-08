import {sessionCookieName,csrfCookieName} from './helpers/cookies';
import { test, expect } from "@playwright/test";
import { Pool } from "pg";
import { requireTestDatabaseUrl } from "../../src/server/db/test-target";
import { syntheticGuild } from "../integration/helpers/fixtures";
import { createSession, revokeSession } from "../../src/server/auth/sessions";
import { transaction } from "../../src/server/db/client";
import { systemClock } from "../../src/domain/clock";
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
test("an ordinary session read never rewrites its authentication cookie", async ({
  page,
  context,
}) => {
  const f = await syntheticGuild(db),
    s = await transaction(db, (tx) => createSession(tx, f.userId, systemClock));
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
  const response = await page.request.get("/api/account/session");
  expect(response.status()).toBe(200);
  expect((response.headers()["set-cookie"] ?? "").includes(sessionCookieName+"=")).toBe(
    false
  );
});
test("an old revoked-session status response cannot replace a newer sign-in; explicit restart creates only a guest", async ({
  page,
  context,
}) => {
  const a = await syntheticGuild(db),
    b = await syntheticGuild(db),
    old = await transaction(db, (tx) =>
      createSession(tx, a.userId, systemClock)
    ),
    fresh = await transaction(db, (tx) =>
      createSession(tx, b.userId, systemClock)
    );
  await revokeSession(db, old.sessionToken);
  await context.addCookies([
    {
      name:sessionCookieName,secure:process.env.GW_E2E_PRODUCTION==='true',
      value: fresh.sessionToken,
      url:process.env.GW_E2E_PRODUCTION==='true'?'https://127.0.0.1:3000':'http://127.0.0.1:3000',
      httpOnly: true,
      sameSite: "Lax",
    },
    {
      name:csrfCookieName,secure:process.env.GW_E2E_PRODUCTION==='true',
      value: fresh.csrfToken,
      url:process.env.GW_E2E_PRODUCTION==='true'?'https://127.0.0.1:3000':'http://127.0.0.1:3000',
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  const delayed = await page.request.get("/api/account/session", {
    headers: {
      cookie: `${sessionCookieName}=${old.sessionToken}; ${csrfCookieName}=${old.csrfToken}`,
    },
  });
  expect(delayed.status()).toBe(401);
  expect((delayed.headers()["set-cookie"] ?? "").includes(sessionCookieName+"=")).toBe(
    false
  );
  expect(
    (await (await page.request.get("/api/account/identity")).json()).userId
  ).toBe(b.userId);
  await context.addCookies([
    {
      name:sessionCookieName,secure:process.env.GW_E2E_PRODUCTION==='true',
      value: old.sessionToken,
      url:process.env.GW_E2E_PRODUCTION==='true'?'https://127.0.0.1:3000':'http://127.0.0.1:3000',
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  const restart = await page.request.post("/api/account/session", {
    headers: { origin: "http://127.0.0.1:3000" },
    data: {},
  });
  expect(restart.status()).toBe(200);
  expect((await restart.json()).userId).toBeNull();
  expect((restart.headers()["set-cookie"] ?? "").includes(sessionCookieName+"=")).toBe(
    true
  );
  expect(
    (
      await page.request.post("/api/account/session", {
        headers: { origin: "https://unrelated.invalid" },
        data: {},
      })
    ).status()
  ).toBe(403);
});
