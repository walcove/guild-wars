# Results comparison evidence

Implemented using original synthetic records and local PostgreSQL. Real/provider-derived results remain unavailable until Gate 0, data rights and authoritative source adapters pass.

The exact rational kernel values original SOL (including its uncovered reserve), original investment cash, remaining SOL/USDC and an explicit option liability at explicit SOL/USD and USDC/USD rates. Holding never reinvests the premium. Funding must match the frozen sleeve. Received premium, native fees, underlying/delivery/currency change, whole net result and excess versus holding are separate. Missing marks block equity; incomplete fees or nonfinal settlement stays pending. A negative net result with positive excess says “Lost less than holding.” Paper House inputs must match timing, allocation, reserve, expiry, valuation sources and fee policy to be called matched. No contemporaneous House inputs are installed.

Original cohort IDs are retained by the aggregation kernel, including missing, declined and losing entries. Removing an entry fails. Capital-weighted excess and member return range require every original result, at least three verified members, current read/aggregate consent and approved provider sources. Public projections contain no named member amounts. Simulation and real accounts remain separate. Actual cohorts cannot pass the current provider gate.

Personal result snapshots are append-only and keyed to sleeve/owner/mode, accounting revision, valuation revision, verification and frozen rules. Polls reuse a snapshot before replaying events. Corrections append a new snapshot with a prior-revision link. Owner-only audit pages preserve old inputs. No browser endpoint accepts a valuation. Internal source ingestion rejects future results, changed duplicates and mismatched sleeve basis.

Commands run:

- Unit kernel: 4/4 after a missing-module RED.
- PostgreSQL results target: 2/2; full integration at this increment 100/100.
- `npm run verify`: 107 units, TypeScript, lint, web/worker builds passed before the audit-link addition; TypeScript/lint and the results target passed after it.
- `npm run test:e2e:container -- tests/e2e/results.spec.ts`: 2/2 rendered at 390/1360px, verifying the actual negative total, positive excess, source label, premium breakdown, privacy and overflow.
- Migration 0027 applied to isolated test PostgreSQL, adding ledger sequence, latest valuation and sleeve-round predicates.
- `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` executed against local synthetic data: ledger used ledger_sleeve_sequence, owned positions used position_owner_mode_state; tiny valuation/note tables used sequential scans. Execution was 0.005–0.014 ms for these small samples. These are not pilot-load or production capacity evidence; Task 27 runs the seeded load exercise.

Logs: `.local/task24-*`; screenshots: `.local/screenshots/results-losing-*`. Real source validation, matched House pricing and actual cohort publication remain blocked, rather than replaced with illustrative production numbers.
