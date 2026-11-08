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
      name: "gw_session",
      value: s.sessionToken,
      url: "http://127.0.0.1:3000",
      httpOnly: true,
      sameSite: "Lax",
    },
    {
      name: "gw_csrf",
      value: s.csrfToken,
      url: "http://127.0.0.1:3000",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  const response = await page.request.get("/api/account/session");
  expect(response.status()).toBe(200);
  expect((response.headers()["set-cookie"] ?? "").includes("gw_session=")).toBe(
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
      name: "gw_session",
      value: fresh.sessionToken,
      url: "http://127.0.0.1:3000",
      httpOnly: true,
      sameSite: "Lax",
    },
    {
      name: "gw_csrf",
      value: fresh.csrfToken,
      url: "http://127.0.0.1:3000",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  const delayed = await page.request.get("/api/account/session", {
    headers: {
      cookie: `gw_session=${old.sessionToken}; gw_csrf=${old.csrfToken}`,
    },
  });
  expect(delayed.status()).toBe(401);
  expect((delayed.headers()["set-cookie"] ?? "").includes("gw_session=")).toBe(
    false
  );
  expect(
    (await (await page.request.get("/api/account/identity")).json()).userId
  ).toBe(b.userId);
  await context.addCookies([
    {
      name: "gw_session",
      value: old.sessionToken,
      url: "http://127.0.0.1:3000",
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
  expect((restart.headers()["set-cookie"] ?? "").includes("gw_session=")).toBe(
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
