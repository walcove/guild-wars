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
- [x] **Task 3: Create database schema and repositories** — Migrations 0000–0002 applied on isolated PostgreSQL 16; real constraint test passes, including attribution remedies. Migration guard units and full verify pass. Runtime verification restored.
- [x] **Task 4: Integrate durable PostgreSQL jobs and audit records** — Graphile 0.18 migrations, transactional enqueue, effect deduplication, uncertain delivery, startup/due recovery and reserved pools implemented. Seven real-PG delivery/recovery tests, including actual SIGKILL and web-role enqueue, pass; worker role/readiness smoke verified.
- [ ] **Task 5: Implement browser sessions and Telegram account linking** — Pending.
- [ ] **Task 6: Add the regular Telegram bot transport** — Pending.
- [ ] **Task 7: Bind guilds to groups and enforce membership** — Pending.
- [ ] **Task 8: Implement season schedules and round states** — Domain schedule/state rules implemented, 6 unit checks pass. Persistent transitions/rosters remain blocked by Task 3 runtime.
- [ ] **Task 9: Define quote adapters and provenance controls** — Mode-separated contracts, registry and quote validation implemented. 4 policy and 3 common contract checks pass; no live provider installed.
- [ ] **Task 10: Build payoff calculations and the event ledger** — Exact delivered payoff, currency conversion and append-only ledger projection implemented; 11 unit checks pass. Persistent idempotency integration remains blocked.
- [ ] **Task 11: Integrate SOL history and source-linked events** — Pending.
- [ ] **Task 12: Add member evidence and the beginner research UI** — Independent hypothetical outcome explorer implemented at /learn; 2 interaction tests pass with exact down/flat/rally results, equal Hold choice and retained invalid text. Private guild research, persistence and rendered checks remain pending.
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

- Independent Tasks 8–10 RED→GREEN: schedule stubs 2 relevant failures → 6/6; quote stubs 2 failures → 3/3 plus 2 common contract checks; payoff/ledger stubs 11 failures → 11/11. Typecheck/lint pass. These do not replace required database, licensed-source or live-provider evidence.

- Independent Task 12 calculator RED→GREEN: 2 behavior failures against empty component → 2/2 pass; typecheck/lint exit 0. Uses real exact payoff module, no chart/network dependency, explicit synthetic assumptions and no order action. Latest calculator page has not received a production build or rendered browser verification.
- Environment stop: disk refilled to zero again during new source writes; the two empty failed ballot files were removed. Removed only this task’s generated node_modules to preserve source/Git records, recovering about 845 MiB at that observation. Run `npm ci` again after stable disk capacity is restored. No additional plan task is claimed complete.
- Verification inventory at this checkpoint: 44 targeted unit cases and 2 contract cases passed across their recorded runs; latest typecheck/lint passed before dependency cleanup. Bootstrap `npm run verify` (including production web/worker build) passed before the later domain/calculator increments. PostgreSQL and browser assertions have not passed.

- Checkpoint review: fresh read-only native reviewer found 3 Important boundary defects, 2 material minors. [Record and responses](evidence/checkpoint-review.md). Provider identity regressions RED→GREEN; database attribution fixes are source/migration changes with negative cases, not runtime-verified. No re-review or release clearance claimed.
- Latest verification: `npm run test:unit` → 45/45, `npm run test:contracts` → 3/3; targeted strict TypeScript compile of schema/provider/integration/contract sources → exit 0; `npm run db:generate` → migration 0002. Application manifest/lock unchanged by isolated check tools.
- Deferred minor: research-note proposal-version tenant FK must land before attachment services. Deferred minor: shell browser job must be added to CI after runtime access is restored.
- Next actionable step: free stable disk (several GB), restore Docker/PostgreSQL and browser availability, run `npm ci`, `docker compose -f compose.test.yml up -d --wait`, guarded `npm run db:migrate:test`, schema integration checks, then resume Task 3/4 and the full auth/bot flow. Credentials/permissions remain required only for dependent provider/test-bot checks. No remaining task is silently removed or marked complete.

- Resumed with 17 GiB free. `npm ci` restored the frozen install; `npm run verify` passed including /learn production build. Docker test volume from the ENOSPC incident contains NUL-filled lock data; preserved it and selected a fresh named test volume (no existing volume deleted). Compose healthy; guarded migrations 0000–0002 applied; schema-constraints integration passed on PostgreSQL 16.11. Task 3 no longer blocked.

- Task 4 RED→GREEN: three enqueue/effect failures → passing rollback/replay; missing runner implementation → passing capacity test; ordinary role RLS failure → passing scoped wrapper test. Seven integration checks now pass. Worker SIGKILL uses supported administrative unlock only after death confirmation. Targeted typecheck/lint/worker bundle pass; wrong role cannot report ready, dedicated role boots/exits cleanly. Graphile role ownership/wrapper follows official documentation; all application data remains migrator-owned. See worker recovery runbook.
- Task 4 test correction: an early replay fixture counted another operation under its own audit ID. Keyed its audit effect and interruption to the payload’s canonical operation ID; no application economic effect changed.
