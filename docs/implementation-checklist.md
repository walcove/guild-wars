# Implementation checklist

Canonical progress record. Governing [plan revision 1.2](plans/2026-11-07-guild-wars-solana-mvp-implementation.md) and [spec v0.3](superpowers/specs/2026-11-07-guild-wars-solana-mvp-design.md). Section 8 controls presentation. Original artifacts are unchanged; [provenance](evidence/source-provenance.json) records original hashes.

## Authorization and rulings

- Local implementation only. No deployment, paid resources, remote publication, funded trades or production Telegram sends. Live preparation is disabled.
- Ruling: application root is `/Users/cawal/repos/guild-wars-mvp`; the new dedicated repository on an implementation branch supplies an isolated checkout at the requested path. No nested worktree is needed. Cost if wrong: relocate the checkout.
- Ruling: Task 0 staging uses `/private/tmp/guild-wars-readiness`, preserving the original document workspace and empty scaffold target. Copies moved into this repository after scaffolding; active records here are canonical. Cost if wrong: path-only relocation.
- Ruling: current official Solana guidance supersedes the skill’s obsolete Framework Kit default; use pinned Kit/plugins/`@solana/react` from the approved spec. No machine-level MCP configuration changes are necessary. Cost if wrong: revisit dependency boundary.

## Tasks

- [ ] **Task 0: Validate the provider and research-data path** — Readiness documented; Gate 0 Unavailable; see decisions 0001/0002.
- [ ] **Task 1: Bootstrap the application and compatible dependency set** — Implemented; frozen install, web/worker build, typecheck and lint pass. Four-width shell verification blocked by browser launch sandbox / unavailable browser host; not fully verified.
- [x] **Task 2: Define domain contracts and financial units** — Exact integer/rational units, currency provenance, contract/mode validation and active-member permissions. 16 unit tests pass; typecheck/lint pass.
- [ ] **Task 3: Create database schema and repositories** — Schema, generated/custom migrations, tenant repository boundary, guarded test migration, CI and real-PG constraint test implemented; integration blocked. Six migration-safety unit checks, typecheck and lint pass.
- [ ] **Task 4: Integrate durable PostgreSQL jobs and audit records** — Pending.
- [ ] **Task 5: Implement browser sessions and Telegram account linking** — Pending.
- [ ] **Task 6: Add the regular Telegram bot transport** — Pending.
- [ ] **Task 7: Bind guilds to groups and enforce membership** — Pending.
- [ ] **Task 8: Implement season schedules and round states** — Pending.
- [ ] **Task 9: Define quote adapters and provenance controls** — Pending.
- [ ] **Task 10: Build payoff calculations and the event ledger** — Pending.
- [ ] **Task 11: Integrate SOL history and source-linked events** — Pending.
- [ ] **Task 12: Add member evidence and the beginner research UI** — Pending.
- [ ] **Task 13: Build immutable proposals and the plan builder** — Pending.
- [ ] **Task 14: Publish proposals and attach Telegram research** — Pending.
- [ ] **Task 15: Implement ballot rules and atomic vote handling** — Pending.
- [ ] **Task 16: Add Telegram ballot UX and lock the paper House** — Pending.
- [ ] **Task 17: Implement deterministic simulation booking** — Pending.
- [ ] **Task 18: Add Solana wallet linking without trading authority** — Pending.
- [ ] **Task 19: Register the live cohort and account boundaries** — Pending.
- [ ] **Task 20: Implement the single approved live provider adapter** — Pending.
- [ ] **Task 21: Build individual order review and provider handoff** — Pending.
- [ ] **Task 22: Reconcile real fills and settlement records** — Pending.
- [ ] **Task 23: Add positions and the scheduled midweek response** — Pending.
- [ ] **Task 24: Implement holding benchmarks and results views** — Pending.
- [ ] **Task 25: Add risk-adjusted rankings with quality gates** — Pending.
- [ ] **Task 26: Implement research forecasts, bounties and reputation** — Pending.
- [ ] **Task 27: Verify complete desktop, mobile and Telegram journeys** — Pending.
- [ ] **Task 28: Prepare operations and the production release package** — Pending.
- [ ] **Task 29: Run and review the dual-mode pilot** — Pending.

## Remedy gates

Engineering T1–T17 and design D01–D09 remain required. Copied governing plan retains their full verification contracts. Check only with runtime evidence.

- [ ] T1
- [ ] T2
- [ ] T3
- [ ] T4
- [ ] T5
- [ ] T6
- [ ] T7
- [ ] T8
- [ ] T9
- [ ] T10
- [ ] T11
- [ ] T12
- [ ] T13
- [ ] T14
- [ ] T15
- [ ] T16
- [ ] T17
- [ ] D01
- [ ] D02
- [ ] D03
- [ ] D04
- [ ] D05
- [ ] D06
- [ ] D07
- [ ] D08
- [ ] D09

## Verification ledger

- Destination absent before scaffold. No applicable parent AGENTS.md. Node v24.11.1, npm 11.6.2, Git 2.54.0.
- Task 0: inspected published Leaps/Mori/Dual Finance/CoinGecko evidence; no enabled capability or invented record. Gate 0 blocked, independent work continues.
- Scaffold: create-solana-dapp 4.8.5, Foundation template commit 4ff31d8aa6a464acc4b7f4b88ba512b819500f6c, skip-install/git/init then reviewed dependency selection.

- Task 1 verification: `npm ci` → 621 packages; `npm run verify` → typecheck/lint/bootstrap empty-unit check/build/worker check exit 0. `npm run worker:check` → readiness true, live false. `npm ls` confirms pinned Solana matrix. Empty-unit permission removed in Task 2.
- Task 1 rendered check attempted: `npm run test:e2e -- tests/e2e/shell.spec.ts` → four browser-launch failures, no assertions executed (MachPort Permission denied). CUA browser inventory → browser access host unavailable. UI verification remains blocked.
- Ruling: retain Task 1 as partially verified and continue independent implementation against the buildable foundation; do not treat unavailable browser evidence as a product pass. Cost if wrong: later visual/reflow fixes.
- Ruling: user-requested canonical checklist replaces the skill’s separate private progress ledger; task briefs and verification are still followed. Cost if wrong: adapt helper scripts without changing product behavior.

- Task 2 RED: `npm run test:unit -- src/domain` → 7 relevant behavior failures against unimplemented contracts (16 tests). GREEN: same command → 16/16 pass; `npm run typecheck`, `npm run lint` → exit 0. Financial JSON uses decimal strings. Unit pass-with-no-tests removed.
- Pre-flight interfaces: Tasks 2→3/9/10 share string-serialized integer units, explicit mode/denomination and UTC instants; consistent. Tasks 3→4/5/15 share transactional scope and composite tenant keys; schema must enforce these. Tasks 9→17/20 share normalized records but deliberately separate execution methods; no universal submit. Tasks 18/20→19/21 require verification and registration independently; fixture registration never activates live access. Tasks 10/22→24/25 require append-only revisions and complete frozen cohort; no contradiction.

- Task 3: `npm run db:generate` generated 0000; custom 0001 adds mode immutability, append-only triggers and constraints. Migration-safety units 6/6; typecheck/lint exit 0. Compose/migration/integration attempts failed before assertions; [runtime blockers](evidence/local-runtime-blockers.md). No database pass claimed.
- Ruling: retain incomplete runtime checks and continue only independently verifiable source/rules while infrastructure is unavailable; no alternative fake engine substitutes for PostgreSQL races. Cost if wrong: integration fixes remain before activation.
- Pre-flight interfaces: Tasks 2→3/9/10 use decimal-string units, explicit mode/denomination and UTC. Tasks 3→4/5/15 require same-transaction enqueue/scope/locks. Tasks 9→17/20 require separate booking versus authorization methods, no universal submit. Tasks 18/20→19/21 independently require verified provider access and registration; fixtures cannot activate real sleeves. Tasks 10/22→24/25 require append-only revisions and complete frozen cohorts. These boundaries are consistent.
