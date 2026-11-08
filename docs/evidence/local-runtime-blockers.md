# Local runtime evidence · 2026-11-07

## Database

Docker initially reported 29.9.2, then Docker Desktop unable to start. `docker compose -f compose.test.yml up -d --wait` later created/started the isolated test container, which exited 1 before health readiness. Fetching logs did not return within a bounded wait and was interrupted. No unrelated Docker resource was removed.

Installed PostgreSQL 16 fallback: `initdb -D .local/pgdata ...` failed with `shmget(...size=56...) Operation not permitted`; initdb removed its incomplete data directory. No system settings were changed.

`TEST_DATABASE_URL=... npm run db:migrate:test` failed connecting to loopback 54329 with ECONNREFUSED. Schema integration failed in setup for the same reason, before assertions. This is not a behavioral RED test or a schema pass. Generated migrations/integration cases are unverified against running PostgreSQL. CI is configured, but has not run remotely (no repository published).

## Browser

`npm run test:e2e -- tests/e2e/shell.spec.ts` could not launch Chromium: macOS MachPort bootstrap Permission denied. Four cases did not reach product assertions. CUA inventory independently reported browser access host unavailable. Screenshots/accessibility/reflow checks remain pending. Native Turbopack development FSEvents also failed; supported Webpack polling started. Production build passed.

## Disk

The initial install exhausted disk in this task's temporary metadata cache. Resolving the lockfile separately and clearing only task caches allowed frozen npm ci (621 packages). During Docker startup available space fell below 120 MiB and then reached zero: documentation writes and Git staging failed with ENOSPC. Removed only this task's disposable `.next` output and temporary caches, recovering 238 MiB at that observation. No unrelated user file was removed. Full builds and infrastructure require sufficient free disk before dependable continuation.

## External readiness

[Provider decision](../decisions/0001-live-provider.md), [data decision](../decisions/0002-market-data.md). No permitted provider/test-bot credentials or authoritative records supplied. Live preparation false; production messages/funded actions forbidden. Synthetic evidence never passes live gates.

After cleanup, the recovered space filled again within minutes. New ballot source writes failed with ENOSPC; their empty files were removed, not counted as implementation. Removed only the reproducible dependency directory created by this task, recovering ~845 MiB at that observation. Restore stable free disk and rerun npm ci before further test/build work. The checked-in lockfile remains intact.

A reduced isolated check toolset later allowed the whole 45-unit/3-contract suites and targeted strict TypeScript compilation. It did not restore a full application install, PostgreSQL or browser. See [checkpoint review](checkpoint-review.md).
