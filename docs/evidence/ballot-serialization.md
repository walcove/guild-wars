# Ballot serialization evidence

Local PostgreSQL 16.11, synthetic fixtures only. No Telegram message or funded trade was sent.

A vote and closure acquire the shared group binding, round and canonical ballot locks in that order. After the ballot lock is acquired, one materialized SQL clock sample is compared directly with `opens_at` and `closes_at`; acceptance is strictly before closing. The comparison retains PostgreSQL timestamp precision. Neither transaction-start `now()` nor a browser clock authorizes a vote.

`tests/integration/ballot-concurrency.test.ts` uses two actual connections: the first holds the ballot row; the second begins before closing and demonstrably waits in `pg_blocking_pids`; the first waits beyond the database deadline and releases the lock. The waiting vote is rejected, with no vote row. Other checks cover exact boundaries, concurrent revisions, frozen rosters, active-member access, departed vote retention, post-commit callback-feedback failure, duplicate webhook updates, database lock timeout/rollback, cancellation, same-terms supersession, missing Hold recovery and immutable database snapshots.

Supersession produces a new identifier and fresh tokens while preserving the original locked versions, roster and published window. Votes are not transferred; members must recast, and old tokens cannot reopen voting. Material terms cannot change through this routine replacement operation. A closed ballot cannot be rewritten. Invalid ballots produce explicit unranked holding, including a null winning-choice ID when no real Hold choice exists; no fake winner is invented.

Prepared ballots contain at most two exact proposal versions plus Hold. Opening freezes the shared round roster independently of any registered live cohort. Public status exposes participation and the caller’s own receipt until canonical closure. Web APIs prepare/cancel/supersede or read; they do not cast votes. The authenticated Telegram webhook is the only runtime voting path.

Latest full commands: `npm run verify` (72 units, TypeScript/lint, Next and worker builds) and guarded `npm run test:integration` (59 cases), exit 0. Native Telegram response timing and browser rendering remain unverified gates for Tasks 16/27.
