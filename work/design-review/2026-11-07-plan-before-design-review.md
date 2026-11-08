# Guild Wars Solana MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
> **For Codex or another implementer:** Follow the same task-by-task execution and verification workflow. This document authorizes planning, not live financial actions or a production release.

**Goal:** Build a beginner-friendly SOL covered-call game with a responsive research and planning website, linked Telegram discussion and voting, and separate simulated and individually authorized real-trading paths.

**Architecture:** One Next.js application and one persistent TypeScript worker share domain services and PostgreSQL. The Telegram bot is an adapter into those services. Simulation and the selected live provider implement separate execution adapters; Solana Kit handles the optional Solana wallet and on-chain provider boundary.

**Tech Stack:** TypeScript, Next.js, React, Tailwind, Solana Kit and supported RPC/wallet plugins, `@solana/react`, grammY, PostgreSQL, Drizzle, Graphile Worker, SWR, Lightweight Charts, Vitest, React Testing Library, and Playwright for product browser tests.

---

## 1. Read this first

**Plan date:** November 7, 2026. **Revision:** 1.1, engineering review applied. **Status:** Implementation plan only; no application tasks or tests have been executed. The terminal review report records the review's status and remaining launch prerequisites.

The product source is [Guild Wars Solana MVP Design Specification v0.3](../../docs/superpowers/specs/2026-11-07-guild-wars-solana-mvp-design.md). Its acceptance criteria A1–A20 govern this plan. Version 0.3 reconciles the live-cohort wording: deviating members remain recorded and the guild round becomes provisional. The UI reference is [the desktop and mobile prototype](../../outputs/Guild_Wars_Desktop_Mobile_Flow.html). The prototype's prices, messages, votes, and fills are illustrative, not working integrations.

The current workspace has documents and visual prototypes, but no application repository, package manifest, or Git worktree. Do not scaffold over these artifacts. The proposed application root is:

`/Users/cawal/Documents/Codex/2026-11-01/referenced-chatgpt-conversation-this-is-an/guild-wars-mvp`

All **planned file paths** below are relative to that application root unless explicitly identified otherwise. Existing linked files use absolute paths. Create the application repository only when implementation is requested; do not initialize the parent document workspace merely to commit this plan. Once the application repository exists, use an isolated feature checkout/worktree for implementation and commit only task-related files.

### Product rules to preserve

- Covered calls on SOL are the core. Application chain integrations are Solana-only; USDC and technical wrapped SOL are allowed only for approved product mechanics.
- Both simulated and real trading are required. Completing a simulation-only build does not complete this MVP.
- One regular Telegram community bot and an independent web app. No Mini App, embedded web_app launch button, second trading bot, or automatic copy trading.
- All members can research, challenge assumptions, discuss risks, submit evidence, and use core research tools. No research/risk-reviewer role or reputation gate.
- One guild mode per season, up to two candidate proposals plus Keep holding, one vote per eligible member, and individual live authorization.
- No pooled treasury, fractional pool shares, custom options program, launch token, Wheel, or staggered portfolio in this implementation.
- The provider-first recommendation allows an off-chain SOL provider if suitable, while keeping Guild Wars' own chain integrations Solana-only. Record execution/custody explicitly. Do not infer that planning approval grants permission to use a particular provider or another blockchain.

### Work order and readiness gates

| Phase | Tasks | Reviewable result |
| --- | --- | --- |
| Provider readiness | 0, then provider-specific parts of 20–22 | One supported provider path with evidence, data access, capabilities, and a verified settlement route. |
| Foundation | 1–7 | Reproducible app, shared contracts, database, durable jobs, authenticated members and bound groups. |
| Research and decisions | 8–16 | Real source labels, understandable outcomes, member research, immutable proposals, Telegram voting, locked House. |
| Both trading modes | 17–23 | Virtual booking plus separately authorized real trades, verified positions, midweek review, settlement. |
| Results and community | 24–26 | Accurate comparisons, defensible rankings, forecasts and rotating award administration. |
| Release preparation | 27–29 | Verified desktop/mobile journeys, incident recovery, deployment package, and four-round pilot process. |

Start Task 0 first. Tasks 1–19 can make progress while external provider responses are pending, but do not implement provider-specific signing or claim live readiness before Task 0 passes. Do not perform unsolicited provider outreach: use published evidence and existing authorized access; obtain authorization before sending messages to a provider.

This is a dependency plan, not a calendar or a promise of engineering duration. External permissions, quote/data access, and an actual expiration cycle can determine elapsed time.

## 2. Implementation conventions

### Application layout

```text
app/                         Next.js routes and server-rendered pages
src/components/              Focused client components
src/domain/                  Pure rules and financial calculations
src/server/auth/             Browser sessions, account linking, permissions
src/server/db/               Drizzle schema and repositories
src/server/services/         Transactional application operations
src/server/telegram/         Bot transport, commands, rendering
src/server/market/           Price/history and event adapters
src/server/providers/        Shared contract, simulation, selected live provider
src/server/jobs/             Outbox, leases, scheduling, reconciliation
src/server/solana/           Kit client and wallet verification boundary
worker/                      Persistent worker entry point
tests/integration/           Tests against dedicated PostgreSQL
tests/contracts/             Adapter contracts and sanitized provider fixtures
tests/e2e/                   Browser journeys and local bot harness
docs/decisions/              Provider, dependencies, auth and data decisions
docs/runbooks/               Recovery, deployment, pilot and support
```

Keep domain code independent of Next.js, bot libraries, RPC clients, and provider SDKs. API handlers and bot callbacks call the same service functions. No business decision is implemented twice.

### Common verification commands

Task 1 must define these package scripts before later tasks use them:

```text
npm run dev                    Next.js development server
npm run worker:dev             Persistent worker, development mode
npm run typecheck              tsc --noEmit
npm run lint                   ESLint
npm run build                  Next.js production build
npm run test:unit -- <file>     Vitest with vitest.unit.config.ts
npm run test:integration -- <file>
                               Vitest with vitest.integration.config.ts
npm run test:contracts -- <file>
                               Vitest with vitest.contracts.config.ts
npm run test:e2e -- <file>      Playwright product tests
npm run test:load              Staging/local pilot-load harness; fake external
                               providers only, never funded authorization
npm run db:generate            Drizzle migration generation
npm run db:migrate             Explicit development migration command
npm run db:migrate:test        Guarded dedicated test-database migrations
npm run worker:check           Worker compilation/bundle verification
npm run verify                Typecheck, lint, unit tests, production build,
                               worker check; excludes secret-dependent checks
```

Unit configuration includes `src/**/*.test.ts` and `src/**/*.test.tsx`; integration, contract, and browser suites have separate configurations and do not run accidentally during unit tests. CI uses a dedicated PostgreSQL service. Local integration tests use `compose.test.yml`, bound to loopback port 54329 and database `guild_wars_test`. The test migration command must reject production URLs and any database not explicitly designated for testing. Do not add an unrestricted drop/reset command.

Use server-owned UTC instants and an injectable clock for boundary tests. Use `bigint` token units and fixed-precision decimal representations at database/API boundaries. Serialize integers as strings in JSON. Never serialize a JavaScript `bigint` directly or calculate financial values with binary floating point.

Graphile Worker supplies PostgreSQL-backed job delivery, retries, scheduling and worker recovery. Enqueue through its documented SQL API in the same transaction as the domain write. Keep small application operation/delivery records for financial deduplication and uncertain external outcomes; do not build a second scheduler, job-lease engine or outbox relay. Library job keys are scheduling hints, not proof that a financial effect or Telegram send happened once. Use supported library APIs and migrations, not its private tables.

### Per-task working loop

For financial rules, authorization, state machines, and reliable delivery: write the specified failing behavior test, run the targeted suite to observe the relevant failure, implement that behavior, rerun the suite, and commit the explicit changed files. Do not accept a test failure caused only by an unrelated broken environment as a valid red test. Add meaningful regression cases rather than tests that restate the implementation.

For documentation, straightforward configuration, and visual polish: use direct inspection, builds, and the listed UI checks; do not add trivial tests for static text. A task may contain several small behavior increments. Each checkbox below is one concrete action; repeat the test/implementation loop for its additional independent cases.

Commit commands run inside the future application repository. The task's Files list is the allowlist for staging; add documented migrations and lockfile changes when actually changed. Never use `git add .` to scoop up unrelated work. If dependencies change, rerun the relevant compatibility and build checks.

### Test data

All fixtures are marked `synthetic` or `sanitized_provider_record`. Synthetic financial fixtures use USD cents and SOL lamports with explicit units. Do not present fixtures as live quotes or use invented provider program IDs. Keep secrets and personal account IDs out of fixtures and Git history.

The initial application runs with live preparation disabled. `GW_LIVE_PREPARATION_ENABLED=false` and a selected provider's approved capability record are separate checks. A test override exists only in an isolated test configuration, not in a public request field.

## 3. Tasks

### Task 0: Validate the provider and research-data path

**Dependencies:** None. **Spec:** sections 1, 4, 7, 13; A3, A10–A14, A20.

**Before scaffolding:** stage this task's documents under `/Users/cawal/Documents/Codex/2026-11-01/referenced-chatgpt-conversation-this-is-an/docs/plans/guild-wars-readiness`, keeping the future application directory absent. The paths below are relative to that staging root until Task 1 transfers them into the application. After that transfer, continue editing the application copies as the single canonical records. This avoids making the scaffold target nonempty before the scaffold runs.

**Files — create during implementation:**
- `docs/decisions/0001-live-provider.md`
- `docs/decisions/0002-market-data.md`
- `docs/evidence/provider-capabilities.json`
- `docs/evidence/provider-record-index.json`

- [ ] Read the spec and compare the named research candidates against SOL product support, settlement, custody, eligible users, integration permissions, quote access, fills, costs, and settlement evidence. Provider marketing is not sufficient evidence of an API or permission.
- [ ] Record a decision with one chosen provider or a precise Unavailable result. Record whether the chosen path is provider-hosted off-chain execution or on-chain Solana execution. Other-chain signing, pooled custody, or requiring our own option contract does not satisfy this scope.
- [ ] Obtain or identify a permitted, sanitized record for quote, fill, failure, position, and settlement. Index the source, permission, observation date, fields available, and what remains unverified. A missing record is Unavailable, not an invented successful response.
- [ ] Record each capability independently: exact expirations, size increments/minimums, fee currency, quote TTL, physical/cash settlement, early close, roll, long call, protective put, claims, and import verification. Unsupported actions are `false`.
- [ ] Separately record provider order time-in-force, supported expiration/cancellation, cancellation authority, authoritative fill timestamps and terminal-state evidence. Quote validity controls acceptance, not necessarily the lifetime of an already accepted order. A provider without enforced order expiry must still expose verified status/timestamps so outstanding or late fills stay visible and provisional.
- [ ] Verify CoinGecko access and display/storage rights for research. Separately identify permitted option snapshots and hourly marks for simulation/scoring; do not treat the research-data subscription as permission for trading or redistribution.
- [ ] Review Gate 0: a documented, permitted member-authorization path plus verifiable fills and settlement is mandatory. This may be provider-hosted review or an explicitly supported SDK/wallet transaction path; neither is mandatory to the exclusion of the other. An undocumented integration or a screenshot-only import does not pass. If access is missing, continue independent application tasks and record the live blocker; do not build a substitute derivatives venue.

**Verification:** The decision links to evidence for every enabled capability and names a full settlement path. No externally funded trade is performed as part of this research task.

**Commit after Task 1 creates the repository:** `docs: record provider and market data readiness`

### Task 1: Bootstrap the application and compatible dependency set

**Dependencies:** Task 0 started; completion does not require provider access. **Spec:** section 10.

**Files:**
- Create: application repository, `package.json`, `package-lock.json`, `.nvmrc`, `.gitignore`, `.env.example`, `README.md`.
- Create: `docs/decisions/0003-dependency-matrix.md`, `vitest.unit.config.ts`, `vitest.integration.config.ts`, `vitest.contracts.config.ts`, `playwright.config.ts`, `worker/main.ts`, `scripts/worker-check.mjs`, `.github/workflows/ci.yml`.
- Modify: generated `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `tsconfig.json`.

- [ ] Verify Node 24 and available npm/Git locally. Inspect the current official scaffold instructions and registry package metadata. Record the scaffold version and template revision used rather than relying on an undocumented latest combination.
- [ ] From the document workspace, scaffold only the new application child directory. The current documented command shape is:

```bash
GW_SCAFFOLD_VERSION="$(npm view create-solana-dapp version)"
npx --yes "create-solana-dapp@$GW_SCAFFOLD_VERSION" guild-wars-mvp --template solana-foundation/templates/kit/nextjs
```

- [ ] Choose a coherent published dependency set from the starter and peer constraints. Verify Kit, `@solana/react`, RPC/wallet plugins, React, and Next.js together; do not independently upgrade the wallet plugin. Pin and save the lockfile. Add the planned bot, persistence, validation, chart, worker, and test dependencies at compatible published versions.
- [ ] Remove the starter's demo transfers, minting, token creation, and public network-switch controls from the product. Keep only the minimal reusable wallet/provider boundary. Create a clean research landing shell.
- [ ] Transfer Task 0's staged `docs/decisions/` and `docs/evidence/` records into the application only after scaffolding succeeds. Record the relocation and use those application files for subsequent provider work; do not maintain divergent active copies. If Task 0 is still running, its remaining updates use the new paths.
- [ ] Add the common scripts above and a worker entry point that boots, reports readiness, and exits cleanly. Validate configuration without printing secret values. A production build must not make a real Telegram or provider request.
- [ ] Add CI immediately: frozen-lockfile install, typecheck, lint, web/worker build and the unit suite. Task 3 adds the dedicated PostgreSQL service; each subsequent task adds its new suite in the same change. Task 28 extends this existing pipeline for release, rather than introducing CI after the application is built.
- [ ] Run `npm ci`, `npm run verify`, and the worker check. Empty test suites may use an explicit pass-with-no-tests option only until real tests land in Task 2; remove that option then. Record exact successful versions.
- [ ] Create or use the child Git repository and an isolated implementation checkout. Commit only the application bootstrap; retain parent artifacts unchanged.

**Expected result:** Reproducible web and worker builds; no live features, tokens, or transfer demos.

**Commit:** `chore: initialize Guild Wars application foundation`

### Task 2: Define domain contracts and financial units

**Dependencies:** Task 1. **Spec:** sections 5, 7, 8, 11.

**Files — create:**
- `src/domain/types.ts`, `src/domain/money.ts`, `src/domain/clock.ts`, `src/domain/errors.ts`, `src/domain/permissions.ts`.
- `src/domain/types.test.ts`, `src/domain/money.test.ts`, `src/domain/permissions.test.ts`.

- [ ] Add failing tests for mode relabeling, invalid precision/negative sizes, non-finite prices, cross-guild access, and member research permissions. Run `npm run test:unit -- src/domain`.
- [ ] Define the shared contracts below and explicit validation for incoming strings, IDs, UTC instants, token units, modes, quote kinds, and instrument settlement. Validation library objects stay at the boundary; domain functions receive validated types.

```ts
export type TradingMode = 'simulation' | 'live';
export type GuildRole = 'member' | 'captain' | 'administrator';
export type QuoteKind = 'executable' | 'indicative' | 'historical' | 'model';
export type ManagementAction = 'hold' | 'buy_to_close' | 'roll' | 'buy_call' | 'protective_put';
export type Custody = 'user_wallet' | 'provider_custody' | 'protocol_escrow';
export type SettlementLocation = 'solana' | 'off_chain';

export interface SourceStamp {
  sourceId: string;
  observedAt: string;
  receivedAt: string;
  synthetic: boolean;
}

export interface ContractTerms {
  underlying: 'SOL';
  settlementCurrency: 'USDC';
  strike: { amount: string; denomination: 'USD' | 'USDC'; per: 'SOL' };
  expiresAt: string;
  settlement: 'physical' | 'cash';
  custody: Custody;
  location: SettlementLocation;
  instrumentId: string;
  providerId: string;
}
```

- [ ] Implement exact unit parsing/formatting with rejection of excess fractional digits. Keep quote/fee currency explicit; instruments using another settlement asset are out of scope unless the spec changes.
- [ ] Distinguish reporting USD, contractual strike denomination and USDC balances. Use explicit SOL lamport scale 9 and USDC micro-unit scale 6. Each USD conversion records the rate, currency pair, observation time, source and rounding policy. Preserve exact intermediate values; round only at the documented accounting/display boundary. Missing USDC/USD conversion cannot silently use 1.00 for a ranked USD result.
- [ ] Implement `canContributeResearch(member)` as active membership, independent of captain status, XP, reputation, or wallet possession. Platform-operator permissions are a separate application authority, not a selectable guild role.
- [ ] Rerun the targeted tests and typecheck; ensure JSON outputs use decimal strings instead of unsafe numbers. Remove pass-with-no-tests from the real unit suite.

**Commit:** `feat: define mode-safe domain contracts and member permissions`

### Task 3: Create database schema and repositories

**Dependencies:** Task 2. **Spec:** section 11; A1, A2, A6, A9.

**Files — create:**
- `src/server/db/schema/identity.ts`, `src/server/db/schema/guilds.ts`, `src/server/db/schema/rounds.ts`, `src/server/db/schema/proposals.ts`, `src/server/db/schema/ballots.ts`, `src/server/db/schema/research.ts`, `src/server/db/schema/trading.ts`, `src/server/db/schema/ledger.ts`, `src/server/db/schema/jobs.ts`, `src/server/db/schema/audit.ts`.
- `src/server/db/client.ts`, `src/server/db/repositories.ts`, `drizzle.config.ts`, generated `drizzle/` migrations.
- `compose.test.yml`, `scripts/migrate-test.mjs`, `tests/integration/schema-constraints.test.ts`.

- [ ] Write failing integration tests for duplicate Telegram identity, duplicate current ballot vote, duplicate external fill/ledger event, mismatched guild foreign keys, and changing an existing position's mode.
- [ ] Define schema and indexes for the spec's entities. Add unique `(ballot_id,user_id)` current votes, `(bot_id,update_id)` consumed updates, `(provider_id,account_id,external_fill_id)` fills, and idempotency keys for ledger events and job operations. Keep append-only vote/ledger revisions separately.
- [ ] Add tenant-aware repositories requiring an authenticated guild/account scope; never pass unrestricted table queries directly to route components. Database roles/constraints enforce invariants in addition to service checks.
- [ ] Create migrations and the dedicated test database. Run `docker compose -f compose.test.yml up -d --wait`, `npm run db:migrate:test`, and `npm run test:integration -- tests/integration/schema-constraints.test.ts`.
- [ ] Verify test migration safety rejects a production hostname and an undesignated database. Commit schema, migration, scripts, and integration cases together.
- [ ] Extend CI with the isolated PostgreSQL service and migration/integration job now. Give each test worker an isolated test schema or database and scoped credentials; a parallel test cannot erase another worker's ballot or ledger fixtures. Migrations use a separate migration role from the application's least-privilege runtime role.

**Commit:** `feat: persist guilds rounds ballots and trading records`

### Task 4: Integrate durable PostgreSQL jobs and audit records

**Dependencies:** Task 3. **Spec:** sections 6, 12; A5, A8, A18.

**Files — create:**
- `src/server/jobs/queue.ts`, `src/server/jobs/outbox.ts`, `src/server/jobs/scheduler.ts`, `src/server/jobs/handlers.ts`, `src/server/jobs/budgets.ts`.
- `src/server/services/audit.ts`, `tests/integration/job-leases.test.ts`, `tests/integration/outbox-atomicity.test.ts`, `tests/integration/worker-budget.test.ts`.
- Modify: `worker/main.ts`.

- [ ] Add a transaction-rollback test: neither its domain change nor the job enqueued through `graphile_worker.add_job` survives. Exercise duplicate delivery and worker restart through the real library, not a mocked scheduler.
- [ ] Pin a compatible Graphile Worker release, apply its supported migrations and implement a small wrapper in `src/server/jobs/queue.ts`. Use its documented SQL enqueue API inside the current Drizzle transaction. Treat a missing enqueue result as a transaction failure. Do not implement application-owned claims, heartbeat/lease recovery or scheduling tables.
- [ ] Implement atomic domain-change-plus-job writes. Give each effect a unique application operation ID independent of library job keys; a replacement or running job must not reapply a committed financial effect. Track Telegram attempt states separately because a network send cannot be made exactly once by a database constraint. An ambiguous send is Unknown, not a new ballot or a safe blind retry.
- [ ] Add an injectable clock and scheduled handlers for ballot closing, quote capture, midweek notices, settlement checks, and research resolutions. Jobs derive current authorization/state at execution time. On worker startup and a bounded periodic sweep, recover due domain transitions missing a job; deadlines remain enforced in services even while the worker is unavailable.
- [ ] Run both targeted integration suites, interrupt a local worker during an effect, and verify safe replay through application idempotency. Document the pinned library's actual failed-worker recovery timing; alert on a missed domain deadline instead of assuming immediate lock release. Persist actor, reason, affected record and correction links in audit events.
- [ ] Add bounded worker pools with capacity reserved for due round transitions, separate from slow research/provider work. One persistent worker process is sufficient; configure supported library task partitioning and finite queue names. Cap overall database connections across web and worker pools, provider calls and retry attempts. Verify a saturated background queue cannot starve a ballot close or due-state recovery. External requests never run while holding a ballot/database transaction open.

**Commit:** `feat: add durable jobs and transactional publication outbox`

### Task 5: Implement browser sessions and Telegram account linking

**Dependencies:** Tasks 3–4. **Spec:** section 6; A2.

**Files — create:**
- `src/server/auth/sessions.ts`, `src/server/auth/link-challenges.ts`, `src/server/auth/csrf.ts`.
- `src/server/services/link-telegram.ts`, `app/api/account/telegram-link/route.ts`, `app/api/account/telegram-link/confirm/route.ts`.
- `app/connect/page.tsx`, `src/components/account-link.tsx`, `tests/integration/account-linking.test.ts`.
- `docs/decisions/0004-identity-bootstrap.md`.

- [ ] Write failing tests for consumed/expired link tokens, wrong browser session, duplicate Telegram identity, login CSRF, and a second user attempting to claim another account's link.
- [ ] Generate high-entropy opaque browser sessions and five-minute link challenges, storing token hashes. Use HttpOnly cookies, production Secure, SameSite, origin/CSRF checks, and explicit browser confirmation after bot proof.
- [ ] Document first-visit bootstrap: a new user gets a pending browser session; a verified bot interaction plus confirmation creates the account. Existing users link within their authenticated session. An anonymous session alone grants no guild or provider access. This fills in the spec's existing-account linking flow without making a wallet mandatory.
- [ ] Implement the link issue/confirm routes and small UI. The bot's authenticated sender ID proves Telegram control; username and request-supplied user ID never do. Consume the challenge and rotate the browser session atomically.
- [ ] Complete the session lifecycle: 24-hour idle and 7-day absolute expiry as initial settings, checked on the server; logout revokes the stored session, clears its cookie and client caches, and identity/provider-link changes require fresh Telegram proof and revoke affected sessions/credentials. Existing Telegram identity conflicts require the verified existing account, not automatic account merging. No trading permission survives revocation merely because a browser page remains open.
- [ ] Run `npm run test:integration -- tests/integration/account-linking.test.ts` and verify a new simulation member can sign in without wallet connection or transaction.

**Commit:** `feat: link Telegram identities with session-bound account proof`

### Task 6: Add the regular Telegram bot transport

**Dependencies:** Tasks 4–5. **Spec:** section 6; A2, A5–A8.

**Files — create:**
- `src/server/telegram/bot.ts`, `src/server/telegram/webhook.ts`, `src/server/telegram/commands.ts`, `src/server/telegram/callbacks.ts`, `src/server/telegram/render.ts`.
- `app/api/telegram/webhook/route.ts`, `tests/integration/telegram-updates.test.ts`, `tests/contracts/telegram-render.test.ts`.

- [ ] Add failing tests for wrong webhook secret, replayed update, forged callback user, and command text containing untrusted markup.
- [ ] Initialize grammY on the server only. Authenticate the webhook secret and validate the exact update shape. Ordinary commands are durably recorded/enqueued. For ballot and identity-link callbacks, use a short bounded service transaction in the request path, deduplicating the update in the same commit; do not leave time-sensitive votes behind news refresh or settlement jobs. On a retry after a committed vote but failed HTTP response, return the saved receipt. Do not assume command scope grants permission.
- [ ] Implement `/start`, `/help`, and `/privacy`, and the link confirmation callback. Use ordinary URL buttons; prohibit web_app buttons and Mini App configuration. Implement escaping and length-aware message splitting.
- [ ] Return callback feedback promptly but confirm a saved vote or account link only after durable commit. Use private receipts only for users who started the bot; otherwise callback feedback plus a web receipt.
- [ ] Use a compact opaque server lookup token within Telegram's callback-data byte limit, bound to the canonical ballot, version, expected chat and choice. Recheck the authenticated sender, current membership, chat context, state and deadline. A token or forwarded message is not voter authority. Bound database waits to 1 second for the initial target; return an explicit unsaved/retry response on timeout, never success before commit. Do not call remote provider APIs or make Telegram sends while holding a ballot lock.
- [ ] Run both suites against local synthetic Telegram updates; perform a manual check with the separate test bot once its token and HTTPS webhook are authorized/configured. Never point local fixtures at the production bot.

**Commit:** `feat: connect a regular Telegram bot to shared services`

### Task 7: Bind guilds to groups and enforce membership

**Dependencies:** Tasks 5–6. **Spec:** sections 4–6; A1, A2, A19.

**Files — create:**
- `src/server/services/guilds.ts`, `src/server/services/bind-group.ts`, `src/server/services/membership.ts`.
- `app/guilds/[guildId]/page.tsx`, `app/guilds/[guildId]/settings/page.tsx`, `src/components/guild-invitation.tsx`.
- `tests/integration/group-binding.test.ts`, `tests/integration/guild-access.test.ts`.

- [ ] Add failing tests for a non-admin binding a group, a guild admin binding an unrelated group, forwarding a private research URL, and a suspended member voting or submitting new research.
- [ ] Verify both website guild authority and Telegram group administration through supported API behavior; implement the least permissions needed. Record administrator, chat/topic IDs, verification method, and binding history.
- [ ] Support invite acceptance, active/suspended/departed membership states, and roles member/captain/administrator. Do not define a research-reviewer role. An active member can contribute research without appointment or wallet linking.
- [ ] Add bidirectional group navigation and unavailable-message fallback. Enforce access on each API and server page rather than relying on an unguessable URL.
- [ ] Run both integration suites and the invitation flow manually with the test bot. Store only needed commands/replies/membership events even if administrator status causes Telegram to deliver broader messages.

**Commit:** `feat: bind guild groups and open research participation to members`

### Task 8: Implement season schedules and round states

**Dependencies:** Tasks 3–4, 7. **Spec:** sections 1, 5; A7–A9.

**Files — create:**
- `src/domain/round-policy.ts`, `src/domain/round-policy.test.ts`, `src/server/services/rounds.ts`.
- `app/api/guilds/[guildId]/rounds/[roundId]/route.ts`, `tests/integration/round-transitions.test.ts`.

- [ ] Test the state sequence `research → candidate_lock → voting → execution_window → open → midweek → expired → settlement_pending → complete`, plus cancelled/unranked outcomes.
- [ ] Validate a four-round season, fixed mode/provider division, published UTC timetable, candidate limits, 12-hour ballots, at least 24-hour research period, and execution window no longer than 60 minutes. Verify the instrument's actual expiration permits the schedule; do not pretend every weekly round is a contract with exactly seven days remaining.
- [ ] Lock rules/schedule versions and prohibit historical mode changes. Snapshot the eligible voting roster and season's live-cohort participation independently. A live cohort is not the same as all voters.
- [ ] Implement idempotent scheduled transitions and a server-derived next-action response used by web and bot. Corrections append an event; no editable clock field on the client determines eligibility.
- [ ] Run the unit and integration suites with an injected clock at every deadline boundary.

**Commit:** `feat: define versioned seasons and reliable round transitions`

### Task 9: Define quote adapters and provenance controls

**Dependencies:** Tasks 2–3, 8. **Spec:** sections 4, 7; A3, A9, A20.

**Files — create:**
- `src/server/providers/contracts.ts`, `src/server/providers/registry.ts`, `src/server/providers/quote-policy.ts`.
- `src/domain/quote-policy.test.ts`, `tests/contracts/provider-common.test.ts`, `tests/fixtures/synthetic-options.json`.

- [ ] Test stale/expired quotes, missing fee currency, wrong instrument, unsupported size, synthetic executable claims, and an adapter selected from a client-supplied mode.
- [ ] Define shared normalized records and the mode-separated interface:

```ts
export interface OptionQuote {
  id: string;
  mode: TradingMode;
  kind: QuoteKind;
  terms: ContractTerms;
  coveredLamports: string;
  grossPremiumUsdcMicros: string;
  fees: Array<{ currency: 'SOL' | 'USDC'; units: string }>;
  validUntil: string;
  source: SourceStamp;
}

export interface ExecutionAdapter {
  readonly mode: TradingMode;
  listInstruments(roundId: string): Promise<ContractTerms[]>;
  quote(intentId: string): Promise<OptionQuote>;
  reconcile(externalReference: string): Promise<VerifiedExecutionEvent[]>;
}
```

- [ ] Keep provider-hosted authorization preparation on the live adapter and virtual booking on the simulation adapter as different methods/types. The common interface must not expose a universal `submit` method that a simulation call can accidentally invoke. Define `VerifiedExecutionEvent` as a discriminated union for order, fill, position, fee and settlement events with authoritative external IDs.
- [ ] Implement source/freshness checks: provider TTL plus at most 60-second opening snapshot age for ranked simulation. Indicative/model/synthetic inputs cannot become executable live quotes. Unknown size/depth means teaching-only simulation, not a realistic ranked fill.
- [ ] Run both suites with recorded synthetic inputs labeled as such. Live contract fixtures come only from Task 0's permitted records.

**Commit:** `feat: isolate execution modes and validate quote provenance`

### Task 10: Build payoff calculations and the event ledger

**Dependencies:** Tasks 2–3, 9. **Spec:** sections 4, 8; A4, A9, A14.

**Files — create:**
- `src/domain/payoff.ts`, `src/domain/payoff.test.ts`, `src/domain/ledger.ts`, `src/domain/ledger.test.ts`.
- `src/server/services/ledger.ts`, `tests/integration/ledger-idempotency.test.ts`.

- [ ] Write independently worked payoff cases using 1 SOL, a $100 reference price, $110 strike, $2 premium, and $0.10 fee. All values are synthetic. The expected total P&Ls are:

| Expiration SOL price | Covered position | Holding |
| --- | --- | --- |
| $0 | −$98.10 | −$100.00 |
| $80 | −$18.10 | −$20.00 |
| $100 | +$1.90 | $0.00 |
| $110 | +$11.90 | +$10.00 |
| $130 | +$11.90 | +$30.00 |

- [ ] Implement physically delivered terminal payoff with integer-scaled prices. The following kernel is an exact-fixture illustration only; production calculations use the explicit denomination, precision and conversion policy below, not a cent-truncated copy:

```ts
export function deliveredCallPnlCents(input: {
  quantityLamports: bigint;
  entryCentsPerSol: bigint;
  terminalCentsPerSol: bigint;
  strikeCentsPerSol: bigint;
  netPremiumCents: bigint;
}): bigint {
  const terminal = input.terminalCentsPerSol < input.strikeCentsPerSol
    ? input.terminalCentsPerSol : input.strikeCentsPerSol;
  return input.quantityLamports * (terminal - input.entryCentsPerSol)
    / 1_000_000_000n + input.netPremiumCents;
}
```

- [ ] Extend the kernel with input validation, explicit rounding for negative values and provider micro-unit precision, holding payoff, and an explicit unsupported-settlement error. A separate cash-settlement implementation requires the selected contract's actual collateral/payoff terms; do not reuse delivery assumptions.
- [ ] Preserve fractional-SOL and sub-cent intermediate values until the declared boundary. Test 1 lamport, fractional SOL, excess precision, negative-value rounding and fees in both currencies. Independently test 1.90 USDC at an observed 0.98 USD/USDC: 1.862 USD before final display rounding, not 1.90 USD. Missing conversion creates a visible unpriced/provisional result and never a fabricated rate. Freeze the provider's contractual rounding separately from display rounding.
- [ ] Implement append-only asset/cash/liability/fee events and equity projections. Add a settlement regression showing assigned SOL is removed when proceeds are booked; duplicate settlement/fill events have no second effect.
- [ ] Run payoff/ledger unit suites and the PostgreSQL idempotency suite. Include invariants: the simple delivered seller's terminal gain is capped, falling-asset losses remain possible, and cash plus underlying is never double counted.

**Commit:** `feat: calculate covered-call outcomes and auditable ledger events`

### Task 11: Integrate SOL history and source-linked events

**Dependencies:** Tasks 4, 9–10; Task 0 data rights for real data. **Spec:** section 4; A3, A20.

**Files — create:**
- `src/server/market/coingecko.ts`, `src/server/market/cache.ts`, `src/server/market/events.ts`, `src/server/market/source-policy.ts`.
- `src/server/jobs/refresh-market.ts`, `tests/contracts/market-data.test.ts`, `tests/integration/research-data-access.test.ts`, `tests/integration/cache-isolation.test.ts`.
- `app/api/rounds/[roundId]/research/route.ts`.

- [ ] Test rate limits, stale data, changed historical granularity, API errors, missing timestamps, and attempts to expose a server API key in the research payload.
- [ ] Implement a server-side CoinGecko adapter using the permitted plan and SOL identifier. Normalize UTC time, price currency, source and freshness; cache under actual licence/TTL terms. Keep market reference, provider quote, and settlement price separate.
- [ ] Add curated event entries with original URL, scheduled UTC instant, relevance note, author and last-checked time. Import Solana Status RSS/Atom only through a bounded parser; manually curated macro calendars are sufficient for the pilot. Do not invent an economic-calendar API.
- [ ] Return the permitted guild research view with a small call menu from the adapter contract. Quote failures produce Unavailable, not filler values. External data failures may leave the chart visible as stale while disabling affected quote-dependent decisions.
- [ ] Separate shareable instrument/spot-history caches from account-specific quotes, research notes and holdings. Fetch a provider quote only on a member action or a deliberate server refresh, never once per web-status poll. Cache source/time metadata with the value; a fallback source cannot replace official scoring or settlement inputs without an explicit recorded rule.
- [ ] Return private guild, account, quote and order responses with `Cache-Control: private, no-store`; do not place per-user data in Next.js shared caches or static output. Key SWR state by user, guild, mode and record revision, clear it on logout/account change, pause polling in hidden/offline tabs, and refetch after reconnect. Initial target: one combined status poll per visible page every 10 seconds, with data timestamp shown; expiry checks remain server-side. Coalesce public price/history refreshes and serve bounded-stale research context only when labeled. Test different users and guilds against the same path and after account switching.
- [ ] Run both test suites with recorded data and failure fixtures. Perform one authorized read-only provider/data smoke check if credentials are available; record actual access limitations in the data decision.

**Commit:** `feat: add sourced SOL history and expiry event context`

### Task 12: Add member evidence and the beginner research UI

**Dependencies:** Tasks 7, 10–11. **Spec:** section 4; A3, A4, A17, A19–A20.

**Files — create:**
- `src/server/services/research-notes.ts`, `app/guilds/[guildId]/rounds/[roundId]/research/page.tsx`.
- `src/components/research/market-overview.tsx`, `src/components/research/price-chart.tsx`, `src/components/research/call-comparison.tsx`, `src/components/research/outcome-explorer.tsx`, `src/components/research/evidence-list.tsx`, `src/components/research/event-calendar.tsx`.
- `tests/integration/research-contributions.test.ts`, `tests/e2e/research.spec.ts`.

- [ ] Test that any active member can add sourced evidence or a counterargument; a captain has no special research permission. A private guild's notes cannot be read through a forwarded URL.
- [ ] Implement note create/edit/revision records attached to the exact round/proposal version. Store a URL, short claim, uncertainty, disclosures, and optional opposing view. Sanitize text and URLs; user content cannot alter an order or system instruction.
- [ ] Build Understand the market → Compare the calls → Add your evidence. Include a plain-language covered-call explanation, two or three choices, net premium, expiry, settlement, size requirements, and genuine source labels.
- [ ] Add a Lightweight Charts price panel with strike lines and expiration context, fed by our licensed data. Add a separate payoff plot and accessible numeric scenario table using Task 10 calculations. Preserve chart attribution. Keep advanced analytics collapsed and omit unavailable Greeks/probabilities.
- [ ] Load chart and wallet code only in the client components/routes that need them. Keep the numeric table and core explanation available before the chart loads. Paginate research notes and forecasts instead of serializing complete histories; initial page 25 records, hard maximum 100, stable `(created_at,id)` cursor scoped to the authorized guild. Session linking and voting never wait for a chart bundle.
- [ ] Verify the research flow at 390px and 1360px with keyboard focus, labels, no horizontal overflow, and clear mode/source badges. A chart or data-loading failure leaves the explanatory table usable.
- [ ] Run the contribution integration suite and `npm run test:e2e -- tests/e2e/research.spec.ts`. Capture desktop/mobile review screenshots without copying live market values into fixtures.

**Commit:** `feat: provide shared beginner research and covered-call scenarios`

### Task 13: Build immutable proposals and the plan builder

**Dependencies:** Tasks 8–12. **Spec:** sections 4–5; A5, A7, A19.

**Files — create:**
- `src/domain/proposals.ts`, `src/domain/proposals.test.ts`, `src/server/services/proposals.ts`.
- `app/api/rounds/[roundId]/proposals/route.ts`, `app/proposals/[proposalId]/page.tsx`.
- `src/components/plans/plan-builder.tsx`, `src/components/plans/proposal-brief.tsx`, `tests/integration/proposal-versions.test.ts`.

- [ ] Add tests for missing thesis/risk/source, wrong instrument or expiry, stale display quotes, mutating a published version, and material changes after ballot lock.
- [ ] Implement draft edits and immutable publication snapshots. Canonicalize and hash material terms; store fee limits, minimum premium, source timestamps, settlement/custody, authorship and evidence. A typo annotation does not rewrite material terms.
- [ ] Build reference holding → expiration → agreed sale price, followed by Why, Main risk, Evidence, and What would change my view. Core coverage is the full eligible reference allocation excluding the fee reserve.
- [ ] Show the exact brief before sharing, with a 1 SOL comparison and provider minimum-size disclosure. A member's actual trade amount is chosen later and is not secretly embedded in the guild ballot.
- [ ] Run the unit/integration suites and manually verify that switching strikes preserves the member's text, updates outcomes, and invalidates stale review confirmations.

**Commit:** `feat: build readable plans with immutable proposal versions`

### Task 14: Publish proposals and attach Telegram research

**Dependencies:** Tasks 4, 6–7, 13. **Spec:** sections 4–6; A5, A8, A19.

**Files — create:**
- `src/server/services/publish-proposal.ts`, `src/server/jobs/publish-telegram.ts`.
- `app/api/proposals/[proposalId]/publish/route.ts`, `src/server/telegram/research-commands.ts`.
- `tests/integration/proposal-publication.test.ts`, `tests/contracts/proposal-message.test.ts`.

- [ ] Add tests for rollback before outbox write, failed Telegram delivery, ambiguous send timeout, removed messages, duplicate jobs, and a private URL opened by an outsider.
- [ ] Freeze the publication version and queue the message in one database transaction. Render a short plan card with thesis, main risk, terms, mode, source type, and ordinary research/outcome URLs.
- [ ] Save the returned chat/topic/message reference before reporting Published. An unknown delivery is not retried as a new decision. A clearly marked replacement retains the original canonical proposal and ballot references.
- [ ] Implement `/plan`, `/research`, and `/note` handlers. Explicit replies/commands may attach evidence to the proposal; ordinary chat is not bulk mirrored. Website buttons open the associated message or an honest group/replacement fallback.
- [ ] Run publication and rendering suites; verify web → test-group message → exact web proposal → same Telegram discussion using the test bot.

**Commit:** `feat: publish web proposals into linked Telegram discussions`

### Task 15: Implement ballot rules and atomic vote handling

**Dependencies:** Tasks 3–4, 7–8, 13. **Spec:** section 5; A6–A8.

**Files — create:**
- `src/domain/ballots.ts`, `src/domain/ballots.test.ts`, `src/server/services/ballots.ts`.
- `app/api/rounds/[roundId]/ballot/route.ts`, `tests/integration/ballot-concurrency.test.ts`.

- [ ] Write tests for frozen rosters, one/two candidates plus Hold, vote changes, departed/suspended voters, deadlines, quorum, ties, cancellation and superseded proposal versions. Run unit tests to establish the first failing rule.
- [ ] Implement the complete close decision with integer counts. The quorum/winner kernel is:

```ts
export function decideBallot(
  eligibleCount: number,
  counts: ReadonlyArray<{ choiceId: string; votes: number }>,
  holdChoiceId: string,
): string {
  const quorum = Math.floor(eligibleCount / 2) + 1;
  const total = counts.reduce((sum, choice) => sum + choice.votes, 0);
  if (eligibleCount < 1 || total < quorum) return holdChoiceId;
  const top = Math.max(...counts.map(choice => choice.votes));
  const winners = counts.filter(choice => choice.votes === top);
  return winners.length === 1 ? winners[0].choiceId : holdChoiceId;
}
```

- [ ] Add boundary validation before that kernel: counts come only from distinct valid roster votes, no negative/non-integer counts, no more votes than the frozen roster, and the candidate set matches locked versions. Invalid data yields a recorded invalid round/Hold result, never an invented winner.
- [ ] Implement `castVote` and `closeBallot` in PostgreSQL transactions locking the same ballot row before the deadline/state check. After acquiring that lock, read `clock_timestamp()` and accept only when it is strictly before `closes_at`; `now()`/`CURRENT_TIMESTAMP` reflect transaction start and are unsuitable for this post-wait check. At or after the deadline reject the vote even if a delayed close job has not updated the visible status. Keep unique current votes, monotonic revisions and update deduplication. An acknowledgement failure after commit does not undo a vote.
- [ ] Add a real PostgreSQL two-connection test: begin a vote transaction before closing, block it on the ballot lock, advance past closing, release the lock, and assert rejection. Check just-before, exactly-at and just-after boundaries, repeated callbacks, closed/superseded tokens, worker backlog and database timeout. Public results remain hidden until canonical closure; only valid committed votes count.
- [ ] Run `npm run test:integration -- tests/integration/ballot-concurrency.test.ts` with concurrent vote changes and closure. Confirm only one final result and no success receipt for a rolled-back vote.

**Commit:** `feat: enforce fair Telegram ballot rules atomically`

### Task 16: Add Telegram ballot UX and lock the paper House

**Dependencies:** Tasks 9, 14–15. **Spec:** sections 5, 9; A6–A8, A15.

**Files — create:**
- `src/server/telegram/ballot-callbacks.ts`, `src/server/telegram/ballot-messages.ts`, `src/server/jobs/close-ballot.ts`.
- `src/domain/house.ts`, `src/domain/house.test.ts`, `src/server/services/house.ts`.
- `tests/contracts/ballot-message.test.ts`, `tests/integration/telegram-voting.test.ts`.

- [ ] Test that public messages show participation only before closure, the member receipt shows only their own choice, and old buttons cannot create a new ballot.
- [ ] Render callback buttons tied to a canonical ballot/version and route through Task 15. After commit, update participation and receipt; queue result announcements at close. A failed message edit cannot reopen the ballot.
- [ ] Implement the versioned House rule: highest eligible strike above reference spot meeting the locked premium and capacity policy, otherwise Hold. Store its choice and input snapshot before the member ballot opens; no live order authorization is attached.
- [ ] Test equal data cutoffs, absent quotes, supported minimum sizes, policy replay and refusal to overwrite a locked House choice. AI-generated explanation is optional and cannot choose or execute a different trade.
- [ ] Run all three suites and check a full test-group ballot with changing votes and closing. Forwarded messages and screenshots do not grant voter eligibility.

**Commit:** `feat: add Telegram ballots receipts and a precommitted House`

### Task 17: Implement deterministic simulation booking

**Dependencies:** Tasks 8–10, 15–16. **Spec:** section 7; A3, A9, A14.

**Files — create:**
- `src/server/providers/simulation/adapter.ts`, `src/server/providers/simulation/fill-policy.ts`, `src/server/providers/simulation/settlement.ts`.
- `src/server/jobs/book-simulation.ts`, `src/server/services/simulation-enrollment.ts`.
- `tests/contracts/simulation-adapter.test.ts`, `tests/integration/simulation-round.test.ts`.

- [ ] Test season opt-in, automatic winning-plan booking at one frozen timestamp, fee reserve exclusion, insufficient size/depth, stale snapshots, Hold, duplicate jobs, and no possible live submission call.
- [ ] Create a 10 SOL weekly virtual sleeve including the fixed uncovered reserve. Book the winning reference plan only from the approved snapshot and fee policy; missing suitable data makes the round unranked, not retrospectively repriced.
- [ ] Persist virtual fills and obligations through the shared ledger. Keep each weekly sleeve independent; the season index is not a funded wallet or an implicit Wheel/reinvestment strategy.
- [ ] Implement virtual expiration settlement from the frozen contract-specific source/rule. For synthetic datasets, retain teaching-only status in every UI/API output and exclude them from claims of real execution.
- [ ] Run contract/integration suites through a synthetic complete round and confirm duplicate booking/settlement cannot duplicate premium or capital.

**Commit:** `feat: book and settle deterministic simulated covered calls`

### Task 18: Add Solana wallet linking without trading authority

**Dependencies:** Tasks 1–2, 5, 9. **Spec:** section 7; A2, A10.

**Files — create:**
- `src/server/solana/client.ts`, `src/server/solana/wallet-proof.ts`, `src/components/wallet/solana-provider.tsx`, `src/components/wallet/connect-wallet.tsx`.
- `app/api/account/wallet-challenge/route.ts`, `app/api/account/wallet-link/route.ts`.
- `tests/integration/wallet-linking.test.ts`, `src/components/wallet/connect-wallet.test.tsx`.

- [ ] Test nonce reuse, wrong domain/account, unsupported message signing, disconnected wallet, and attempted login proofs carrying a trade permission.
- [ ] Use the validated Kit/plugin/React dependency set and Wallet Standard discovery. Isolate client components; server reads never import a browser signer. Support provider-required wallet capabilities without requesting seed phrases.
- [ ] Link an address using a readable domain/session/nonce/purpose-bound message and server verification. Prefer supported standardized signing; do not add a transaction-based login fallback silently.
- [ ] Keep simulation and ordinary voting usable with no wallet. Never interpret an address link as provider account authorization, unique-human proof, or ownership of an arbitrary imported trade.
- [ ] Run integration/component tests and a devnet wallet capability smoke check. Record supported transaction versions for later provider integration, without sending a funded trade.

**Commit:** `feat: link Solana wallets with scoped ownership proof`

### Task 19: Register the live cohort and account boundaries

**Dependencies:** Tasks 7–9, 15, 18. **Spec:** section 8; A10, A15.

**Files — create:**
- `src/server/services/live-enrollment.ts`, `src/server/services/sleeves.ts`, `src/domain/cohort-policy.ts`, `src/domain/cohort-policy.test.ts`.
- `src/components/trading/cohort-registration.tsx`, `tests/integration/live-cohort.test.ts`.

- [ ] Test enrollment cutoff, frozen season membership, verified starting holdings, duplicate enrollment in the same division, declining an order, a missing round, and removing a losing sleeve from the cohort.
- [ ] Register each member's eligible SOL allocation and fee reserve before execution. Record permission to read performance separately from permission to trade. Do not require a real order for research, voting, or cohort participation if holding is verifiable.
- [ ] Freeze the cohort for four rounds and retain failed/declined/holding outcomes. Unverifiable or deviating sleeves make the affected guild result provisional; they do not disappear.
- [ ] Build registration and provider-read verification against the Task 9 contracts using clearly labeled fixtures, then complete real ownership/balance verification once Task 20 supplies the approved adapter. A fixture never activates a real sleeve. Task 21 checks both registration and verified provider access before preparing a live order; Task 20 does not need to depend on a live enrollment that cannot yet be verified.
- [ ] Enforce exclusive attribution of each verified provider position/account allocation to its registered sleeve in the mode/division. Different Telegram identities or intents cannot count the same covered assets twice. This proves attribution, not unique personhood; keep the original membership/Sybil review rules.
- [ ] Show separate normalized guild-plan, member-account and verified-cohort views. Publish only consented aggregates; individual account amounts remain owner-visible by default.
- [ ] Run unit/integration suites and verify that capital size never changes a vote or research award.

**Commit:** `feat: preregister live performance sleeves without trade delegation`

### Task 20: Implement the single approved live provider adapter

**Dependencies:** Gate 0 passed; Tasks 7, 9–10, 18. **Spec:** section 7; A10–A14.

**Files — create:**
- `src/server/providers/live/selected-provider.ts`, `src/server/providers/live/normalization.ts`, `src/server/providers/live/capabilities.ts`, `src/server/providers/live/authorization.ts`.
- `tests/contracts/selected-provider.test.ts`, permitted `tests/fixtures/provider/` records.
- Modify: `src/server/providers/registry.ts`, `docs/evidence/provider-capabilities.json`.

- [ ] Turn Task 0's actual API/hosted-flow evidence into contract tests for instrument/quote, size, fees, expiry, custody, order status, partial fill and settlement. Synthetic fixtures cannot be the only evidence for this task.
- [ ] Implement only documented, permitted provider behavior. For a hosted provider, prepare its supported authorization link/session or a clearly labeled manual handoff. Never invent a quote endpoint, SDK, deep-link parameter, OAuth grant, or trade-signing method.
- [ ] Normalize authoritative provider events and verified owner/account references. If the SDK uses a different Solana library, keep it inside this adapter. Do not rewrite audited provider transaction logic solely to eliminate a compatibility boundary.
- [ ] Enforce eligibility, quote TTL, minimum net premium, maximum fees, exact strike/expiry/settlement and allowed size. Record a personal deviation rather than misrepresenting a different order as the guild's plan.
- [ ] Test an off-chain or on-chain path according to the selected provider's actual design. For on-chain transactions validate program/mints/accounts/recipients/fees/version and require successful preflight before member signing. Off-chain execution uses provider authorization; Kit does not turn it into an on-chain position.
- [ ] Run the adapter contract suite and permitted sandbox checks. Document any unexercised mainnet capability and keep production preparation disabled until release evidence is complete.

**Commit:** `feat: integrate the validated SOL options provider`

### Task 21: Build individual order review and provider handoff

**Dependencies:** Tasks 10, 15, 18–20. **Spec:** sections 4, 7; A10–A12, A17.

**Files — create:**
- `src/server/services/order-intents.ts`, `app/api/rounds/[roundId]/order-intents/route.ts`, `app/api/orders/[orderId]/route.ts`.
- `app/rounds/[roundId]/trade/page.tsx`, `src/components/trading/order-review.tsx`, `src/components/trading/provider-handoff.tsx`.
- `tests/integration/order-intents.test.ts`, `tests/e2e/live-review.spec.ts`.

- [ ] Test that a guild vote cannot authorize an order; an outsider cannot access another member's intent; mode is taken from the round; quote/amount changes invalidate previous review; and duplicate clicks reuse the economic intent.
- [ ] Implement the order state machine in the spec. Treat ambiguous submission as Unknown and reconcile before allowing an economically duplicate retry. A failed HTTP request alone does not prove no order was placed.
- [ ] Bind review server-side to the authenticated owner/provider account, linked wallet where applicable, round and proposal version, instrument, cluster/location, quantity, quote ID/expiry, fee bounds, and settlement terms. Hash the canonical review content, store its revision, and issue a short-lived single-use authorization-preparation token. Consume it atomically only for that intent and idempotency key; a client checkbox or supplied user ID is not evidence of review. Re-fetch current eligibility, credentials and the live-preparation pause flag before handoff. Any material change requires a fresh review. For an SDK transaction path, validate the member-returned transaction against the approved instructions and bounds; blockhash/fee changes cannot conceal additional asset transfers.
- [ ] Atomically reserve the intent's covered allocation across all active intents/sleeves for that provider account, mode and asset. Use a fresh verified unencumbered-balance snapshot and count only local commitments not already reflected in it, avoiding double subtraction of provider-locked assets. Keep network reads outside the database lock. Reconcile pending, partial and Unknown commitments before releasing their reservations; release only on definitive non-submission, supported expiry/cancellation or authoritative settlement. This is an internal allocation record, not custody/escrow, and the provider remains responsible for enforcing actual coverage against external/direct trades. Test two different reviewed intents competing for the same allocation and one fill imported into two sleeves.
- [ ] Bind opening preparation to the published execution window and use supported provider order expiry/time-in-force when available. At cutoff reconcile outstanding orders and offer supported cancellation; obtain member authorization if cancellation requires it. Do not assume an expired quote cancelled an accepted order. An unresolved or genuinely late fill keeps its actual record/timestamp and makes the affected matched cohort provisional. Judge eligibility by authoritative fill time, not delayed ingestion time; missing time is unverifiable. A direct provider action is never falsely labeled prevented by Guild Wars.
- [ ] Build quantity, current premium, all fees, net premium, upside cap, downside risk, settlement and custody/location review. Require explicit member action to enter the provider's authorization flow. Do not store seed phrases or trade-enabled/withdrawal API keys.
- [ ] Add a clear decline/Keep participating route. For unmatched terms, record a personal deviation in the frozen cohort and explain the resulting provisional guild round. Do not remove the member or losing result from the registered cohort. An intentional new trade requires a new reviewed intent; repeating a request for the same intent returns its current result rather than another economic order.
- [ ] Run integration/browser checks with the sandbox adapter, including expired quote, wallet rejection and repeated clicks. Browser tests never click through a real funded order confirmation.

**Commit:** `feat: review individual live orders before provider authorization`

### Task 22: Reconcile real fills and settlement records

**Dependencies:** Tasks 4, 10, 20–21. **Spec:** sections 7–8, 12; A11–A14, A18.

**Files — create:**
- `src/server/jobs/reconcile-orders.ts`, `src/server/jobs/reconcile-positions.ts`, `src/server/services/import-provider-events.ts`.
- `tests/integration/provider-reconciliation.test.ts`, `tests/contracts/provider-settlement.test.ts`, `docs/runbooks/provider-reconciliation.md`.

- [ ] Add cases for timeout after accepted order, partial fill, stale external status, duplicate fill, out-of-order events, dropped/expired signature, and delayed settlement.
- [ ] Reconcile by verified external order/account IDs or approved on-chain event references. Cross-check owner, instrument, amount and costs. A transaction hash or screenshot alone cannot produce a ranked fill.
- [ ] Persist authoritative events once through Task 10's ledger. Keep Submitted, Confirmed and Finalized distinct for Solana; confirmed events are provisional until the final policy is met. Read-only provider imports require least-privilege credentials.
- [ ] Distinguish delivery duplicates from provider corrections. Store a provider event/revision identifier and payload fingerprint beside the stable fill ID. A changed fill amount/fee with the same fill ID is an explicit amendment or void, linked to the original ledger event; append reversal/replacement events and recalculate an auditable result revision. Never silently ignore a corrected fill or overwrite a finalized result. If the provider supplies no versioning, compare authoritative snapshots and queue an explicit discrepancy for reconciliation. A late stale status cannot regress a known fill to Submitted; contradictory data stays visible as unverified until resolved.
- [ ] Separate expiration, settlement, claimable balance and completed withdrawal. No automatic capital unlock based only on a wall clock. A claim transaction requires its own supported provider/member authorization where applicable.
- [ ] At an opening cutoff or weekly boundary, reconcile unfilled/partial/Unknown orders and retain outstanding collateral commitments. Test a partial fill before cutoff followed by another after it, cancellation timeout, a late-arriving record proving an earlier in-window fill, and a fill lacking authoritative time. Never fabricate cancellation success or release assets solely because the scheduled round ended.
- [ ] Run integration/contract suites, exercise a worker restart and replay, and document direct provider management during an outage. Do not add Helius unless the chosen on-chain path actually needs it.

**Commit:** `feat: reconcile verified live positions and settlement exactly once`

### Task 23: Add positions and the scheduled midweek response

**Dependencies:** Tasks 8, 14–17, 20–22. **Spec:** sections 4, 7; A13, A14, A17.

**Files — create:**
- `app/positions/[positionId]/page.tsx`, `src/components/trading/position-summary.tsx`, `src/components/trading/management-comparison.tsx`.
- `src/server/services/midweek.ts`, `src/server/jobs/midweek-notice.ts`, `tests/integration/midweek-actions.test.ts`.
- `tests/e2e/positions-midweek.spec.ts`.

- [ ] Test a locked product, Hold, supported management actions, unsupported direct API calls, extra fees, changed expiry, and a member refusing a management order after a guild response vote.
- [ ] Show actual fill, covered quantity, reserved assets, received premium versus total equity, remaining obligation, exact expiration and record-verification status.
- [ ] Reuse ballot services for one scheduled midweek decision. Offer only the selected product's real capabilities. A locked product gets Hold and a thesis update, not a fake Roll button.
- [ ] For supported buy-to-close, roll, long-call or protective-put changes, show current costs and correct revised payoff through the adapter, followed by new individual authorization. A request for review is not itself permission to change a trade.
- [ ] Preserve provider-supported roll-outs and direct member management. If management extends exposure beyond the original comparison horizon, record a personal deviation and provisional guild round under the existing cohort rule. Carry the actual remaining liability and reserved assets across rounds until authoritative close/settlement, with no forced close or live account reset. The next round can use only newly verified unencumbered assets; an unsettled or rolled position cannot be counted again in a fresh sleeve. Test a roll beyond the next opening and delayed settlement overlapping two rounds. The simulation's weekly reset is not applied to real assets.
- [ ] Run integration/browser suites for both modes. The simulation rules must not grant management capabilities unavailable in its declared comparison division.

**Commit:** `feat: track obligations and coordinate a capability-aware midweek review`

### Task 24: Implement holding benchmarks and results views

**Dependencies:** Tasks 10, 16–17, 19, 22–23. **Spec:** section 8; A14–A15, A17.

**Files — create:**
- `src/domain/benchmarks.ts`, `src/domain/benchmarks.test.ts`, `src/server/services/results.ts`.
- `app/api/rounds/[roundId]/results/route.ts`, `app/rounds/[roundId]/results/page.tsx`, `src/components/results/comparison.tsx`.
- `tests/integration/results-cohorts.test.ts`.

- [ ] Write independent cases matching the underlying, cash reserve, timestamp and valuation source. Check that holding never reinvests the call premium and the House pays its declared fees.
- [ ] Calculate whole-position net P&L from the ledger, with estimated/pending labels until authoritative settlement. Display premium, underlying change, fees and excess versus holding separately.
- [ ] Keep the precommitted House policy distinct from the timestamp at which its paper position is priced. For a matched comparison, price the House-selected contract and holding benchmark from permitted contemporaneous inputs for the same entry window, size basis, expiry, reserve, valuation and fee policy as the evaluated sleeve. If a live member entered at a different time and matching House inputs are unavailable, label that House comparison informational/different timing; do not invent a matched quote or claim the member beat it on identical conditions.
- [ ] Aggregate the complete registered live cohort and show cohort size, participating capital and member result range under consent rules. Do not pool live/simulation, custody/provider divisions, or normalized paper results with actual money.
- [ ] Retain declined/failed/losing/deviating positions and mark incomplete cohorts provisional. Give each owner their full actual account record; keep guild paper benchmarks visibly paper.
- [ ] Calculate immutable result snapshots after relevant ledger/valuation revisions instead of replaying the whole season for every browser poll. Scope cached results to the authorized cohort, mode, valuation/rules revision and consent state. Add indexes for the actual hot predicates: memberships by guild/user, round/status, quotes by instrument/time, positions by owner/mode/status, ledger events by sleeve/time and note pagination by guild/time/id. Inspect query plans against seeded pilot data and retain an audit link to each result snapshot's inputs.
- [ ] Run unit/integration suites and inspect desktop/mobile results with a negative round where the guild nevertheless ranks well. No green-only or guaranteed-profit messaging.

**Commit:** `feat: compare actual covered-call results with matched holding benchmarks`

### Task 25: Add risk-adjusted rankings with quality gates

**Dependencies:** Tasks 8, 10–11, 19, 24. **Spec:** section 8; A15.

**Files — create:**
- `src/domain/scoring.ts`, `src/domain/scoring.test.ts`, `src/server/services/valuations.ts`, `src/server/services/rankings.ts`.
- `app/seasons/[seasonId]/leaderboard/page.tsx`, `tests/integration/scoring-quality.test.ts`.

- [ ] Test 60/25/15 weights, percentile tie midranks, orientation of lower drawdown/stress, fewer than five guilds, a live cohort below three members, a missing round, insufficient marks, and a removed loser.
- [ ] Implement the hourly valuation grid, 95% coverage requirement, no gap above two hours, maximum drawdown, and the declared five-point terminal stress grid. Do not fill absent option marks with zero liability or zero drawdown.
- [ ] Implement the four-round index starting at 100 and compounding weekly sleeve return factors; connect hourly returns within a round and hold the index flat between rounds. Holding uses the same convention. Publish that this is a standardized index, not continuous reinvested account wealth.
- [ ] Calculate percentiles only in matching mode/provider/product/schedule/settlement divisions. Return structured reasons for provisional/unranked states. Keep raw returns, drawdown, stress loss and source quality visible next to points.
- [ ] Run unit/integration suites and replay a data correction. A correction creates a new score revision and source reference; no silent historical rewrite or one-week annualized Sharpe statistic.

**Commit:** `feat: rank matched strategies with transparent risk and data gates`

### Task 26: Implement research forecasts, bounties and reputation

**Dependencies:** Tasks 4, 7, 12, 14. **Spec:** section 9; A16, A19.

**Files — create:**
- `src/domain/research-awards.ts`, `src/domain/research-awards.test.ts`, `src/server/services/forecasts.ts`, `src/server/services/bounties.ts`, `src/server/services/award-decisions.ts`.
- `app/guilds/[guildId]/community/page.tsx`, `src/server/telegram/community-commands.ts`, `src/server/jobs/research-digest.ts`.
- `tests/integration/research-reputation.test.ts`.

- [ ] Test claim registration before outcome, immutable terms, retained misses, forecast caps, duplicate work, conflicted award decisions, appeal timing and no reward for activity volume.
- [ ] Implement three forecasts/member/week, one focused bounty/guild/week, source/benchmark/deadline/confidence/disclosure records, and measurable resolution rules. Stock or macro claims do not enable stock execution.
- [ ] Allow any active member to research or challenge. For awards only, assign two conflict-free members on a rotating basis; record reasons and a 48-hour appeal. There is no research-reviewer role, special vote weight, or permission to approve another's trade.
- [ ] Keep learning XP, research reputation and season points in distinct ledgers. Start with nontransferable recognition; valuable awards remain unavailable unless a funded budget and criteria were published before entry. No per-message, click, referral, trade-volume, profit or capital rewards; no token conversion.
- [ ] Implement `/track`, `/bounty`, `/results` and an opt-in weekly digest showing useful evidence, challenges, resolved calls and misses. Run unit/integration suites and verify full-chat ingestion is absent.

**Commit:** `feat: recognize verified research without restricting participation`

### Task 27: Verify complete desktop, mobile and Telegram journeys

**Dependencies:** Tasks 12–26. **Spec:** A1–A20.

**Files — create:**
- `tests/e2e/simulation-journey.spec.ts`, `tests/e2e/live-provider-journey.spec.ts`, `tests/e2e/telegram-handoffs.spec.ts`, `tests/e2e/accessibility.spec.ts`.
- `tests/e2e/helpers/bot-harness.ts`, `tests/e2e/helpers/seed.ts`, `docs/evidence/acceptance-matrix.md`.
- `tests/performance/pilot-load.test.ts`.
- Modify only components/routes with reproduced defects.

- [ ] Map each acceptance criterion to a test or explicit manual evidence item before running the full journey. Distinguish synthetic end-to-end checks from real provider evidence.
- [ ] Exercise invitation → account link → research → plan → Telegram publication → vote/change vote → result → simulated booking → midweek → settlement/results. Use the real domain/service layer and a local Telegram HTTP harness, not a second implementation of voting rules.
- [ ] Exercise the live review path with the approved sandbox/recorded adapter: eligibility, fresh quote, separate authorization, partial/unknown order state, verified fill and settlement. A mock success alone does not satisfy A12.
- [ ] Run every core screen at 390×900 and 1360×1080, keyboard-only navigation, visible focus, labels, screen-reader-friendly numeric alternatives, zoom and loading/error states. Save review screenshots of research, proposal, Telegram ballot and trade review.
- [ ] Add interruption and isolation journeys in the feature change itself: two tabs racing on one intent, close/reopen during provider handoff, session revoked while an old trade page is open, quote expiry while reading, retry after committed vote/failed response, delayed provider callback, account switch clearing SWR data, stale cross-guild URLs, malformed callback tokens and no-network recovery. Assert the saved canonical state and the recovery message, not just that a component renders. Add fractional-unit/depeg, amended-fill, worker-death and locked-past-deadline cases to their respective domain/integration suites.
- [ ] Run `npm run test:load` against local/staging services with fake external providers: 100 members across five guilds, 200 visible clients polling every 10 seconds, a background backlog, one provider timeout and simultaneous ballot closure. Initial engineering targets are p95 ordinary status reads below 500 ms and vote-transaction completion below 1 second, excluding Telegram network time. Record test hardware, dataset and pool limits; calibrate these targets before pilot release. Verify public data is coalesced, private data stays isolated, queue lag is visible, and the configured connection/provider budgets are never exceeded. This is not a claim that production capacity has already been measured.
- [ ] Run the unit, integration, contract and browser suites plus `npm run verify`. Triage real failures and rerun affected checks; do not repeatedly broaden testing after all relevant checks pass without a new reason.

**Commit:** `test: verify both-mode Telegram and web product journeys`

### Task 28: Prepare operations and the production release package

**Dependencies:** Tasks 4, 20–27. **Spec:** sections 12–13; A18.

**Files — create:**
- `docs/runbooks/deployment.md`, `docs/runbooks/incidents.md`, `docs/runbooks/backup-restore.md`, `docs/runbooks/support-and-privacy.md`.
- `src/server/operations/feature-flags.ts`, `src/server/operations/health.ts`, `src/server/operations/logging.ts`, `app/api/health/route.ts`.
- `.github/workflows/ci.yml`, deployment configuration for the actually selected host, `docs/evidence/release-readiness.md`.

- [ ] Configure separate web/worker services and environments, a managed PostgreSQL instance, scoped secrets, backups and an authorized test-bot webhook. Choose a hosting provider only after checking worker persistence, region, cost and data requirements; this plan does not invent a hosting contract.
- [ ] Add health/readiness signals, queue and reconciliation lag alerts, job failure/quote error visibility, redacted logs, provider capability flags and a new-live-order-preparation pause control. The flag cannot pretend to close already open positions.
- [ ] Exercise bot removal, Telegram outage, provider outage, stale prices, worker death, revoked credentials and database restore in staging. Confirm members retain access to the provider's direct management route.
- [ ] Produce the release evidence packet: chosen provider/permissions, contract capabilities, data rights, applicable jurisdiction/eligibility review, risk/privacy disclosures, passing acceptance matrix, remaining provisional rankings, rollback steps and support ownership.
- [ ] Extend the CI already introduced in Task 1 and Task 3: install, typecheck, lint, unit/integration/contract tests, web/worker build and critical browser tests on every relevant change. Freeze and test schema/library migrations, and isolate secret-dependent provider checks; no production secrets in pull-request jobs. Build one immutable web/worker release revision and record migration compatibility, readiness checks, rollback limits and the HTTPS web entry point. Users receive a hosted site and a regular Telegram bot; no desktop binary, mobile package, public SDK or container registry release is in scope.
- [ ] Present a concrete deployment configuration and release packet for the user's final release decision. Do not deploy, create paid resources, configure a production bot, or enable real preparation merely because this plan exists. Any required funded validation is performed by an authorized human/provider with explicit transaction confirmation, then its evidence is recorded.

**Commit:** `ops: prepare verified deployment and incident recovery`

### Task 29: Run and review the dual-mode pilot

**Dependencies:** Task 28 and an explicit release decision. **Spec:** section 15.

**Files — create:**
- `docs/runbooks/four-round-pilot.md`, `docs/evidence/pilot-rounds.md`, `docs/evidence/pilot-review.md`.

- [ ] Register small eligible live guilds and simulation guilds, announce mode/division/rules/schedule, freeze cohort participation and verify members understand premium versus total profit, capped upside, downside and provider custody.
- [ ] Verify a complete permitted real provider lifecycle, including settlement/withdrawal or claim mechanics, before declaring live readiness. An actual expiration may require elapsed calendar time; do not replace it with an invented settled fixture. Sandbox evidence and funded evidence are labeled separately.
- [ ] Run four weekly rounds with opt-in notifications and support. Record provider access, rejected/declined orders, data gaps, source quality and reconciliation incidents, without pressuring anyone to trade for participation.
- [ ] Review research-to-vote participation, retention, breadth of contribution, useful opposing views, member comprehension, quote availability and net execution costs. Compare like-for-like eligible quotes only; do not attribute favorable market movement to guild skill automatically.
- [ ] Publish a source-backed review with privacy-safe aggregates and a decision on the next season. Change rules only through a new version. The MVP is complete only when both modes, the integration evidence and A1–A20 are satisfied or explicitly changed by the user.

**Verification:** Human-reviewed pilot evidence rather than a test pretending calendar time or actual trades occurred.

**Commit:** `docs: record dual-mode pilot results and next-season decisions`

## 4. Acceptance coverage and dependencies

| Spec acceptance | Implementation tasks |
| --- | --- |
| A1 · Secure guild/group binding | 3, 6–7, 27 |
| A2 · Telegram onboarding without mandatory wallet | 5–7, 18, 27 |
| A3 · Sourced/fresh research and quote gating | 0, 9, 11–12, 17, 27 |
| A4 · Correct covered-call scenarios | 10, 12, 27 |
| A5 · Exact proposal publication and links | 13–14, 27 |
| A6 · Telegram vote/change/receipt | 6, 15–16, 27 |
| A7 · Quorum, deadlines, versions, concurrency | 8, 13, 15–16, 27 |
| A8 · Shared authoritative state and closed ballots | 4, 8, 14–16, 27 |
| A9 · Simulation/live isolation | 2–3, 9, 17, 21, 27 |
| A10 · Individual live review and authorization | 0, 18–21, 27 |
| A11 · Honest failures and verified fills | 20–22, 27 |
| A12 · Complete real provider path | 0, 20–22, 27–29 |
| A13 · Capability-aware midweek actions | 0, 20, 23, 27 |
| A14 · Actual settlement and no double counting | 10, 17, 22–24, 27 |
| A15 · Fair mode/cohort/risk comparisons | 16, 19, 24–25, 27 |
| A16 · Verified research, awards and appeals | 26–27 |
| A17 · Beginner desktop/mobile accessibility | 12–13, 21, 23–24, 27 |
| A18 · Recovery and operational checks | 4, 22, 28–29 |
| A19 · Research open to all members | 2, 7, 12, 26–27 |
| A20 · Data provenance and honest model labels | 0, 9, 11–12, 27 |

The first reviewable vertical slice is Tasks 1–16: a real member researches, publishes a versioned proposal, and votes through the test bot. It is a checkpoint, not the complete MVP. Both execution paths, reconciliation, and settlement remain required.

## 5. Decisions the implementation must not invent

| Decision | Required evidence and owner | Independent work that may continue |
| --- | --- | --- |
| Selected live provider and custody/settlement | Task 0 provider evidence, user/provider authorization, and applicable eligibility review. | Domain rules, UI, Telegram link/vote flow, synthetic adapter contract checks. |
| Off-chain fallback versus strict on-chain launch | The spec's provider-first recommendation remains visible in the provider decision. Confirm a material change in execution/custody before implementing a different product. | Solana wallet boundary and all mode-neutral services. |
| Quote/mark storage and distribution rights | Provider/data terms and actual access. Research charts do not imply ranked-mark rights. | Provenance schema, calculator, teaching-labeled fixtures. |
| Host, paid resources and production accounts | Concrete configuration and costs reviewed at Task 28. | Local builds, test database, CI configuration draft. |
| Valuable award funding | Published budget and criteria before entry. | Nontransferable XP/reputation and conflict-free award administration. |

If one of these blocks dependent work, report the precise missing item, keep unrelated tasks moving, and retain its launch gate. Do not quietly downgrade the required live mode, choose unsupported provider capabilities, or add a custom protocol.

## 6. Execution handoff

The plan is complete when this file is checked for dependency order, source-spec coverage, exact paths/commands, financial examples, and consistent mode/provider boundaries. It does not mean application tests have passed; there is no application yet.

Execution options after the user requests implementation:

1. **This chat, task by task:** use the applicable executing-plans workflow, verify each task and review changes before advancing. If the user chooses subagent-driven execution, use the corresponding subagent-driven-development skill and bounded independent tasks.
2. **Separate implementation chat:** provide this plan and the source spec, select the application checkout/worktree, and execute with checkpoints. A separate chat is created only at the user's request.

Start with Task 0 and Task 1. Keep the completed visual/document artifacts in the parent workspace intact.

## 7. Engineering review execution rules

The user authorized automatic acceptance of recommendations that preserve the agreed end workflows. The changes below preserve research on the web, discussion/voting in Telegram, equal member participation, separate simulation/live records, and individual provider authorization. They do not select a provider, change custody, remove live trading, or authorize a production release.

### What already exists

The workspace has a product spec and the 13-screen desktop/mobile prototype, including plain-language outcomes and Telegram handoffs. Reuse their approved visual/content direction. No production authentication, queue, option execution, ledger, tests or deployment exists to reuse. Start from the Foundation Kit template; use Kit/Wallet Standard for chain support, grammY for Telegram, Graphile Worker for PostgreSQL delivery, and Lightweight Charts for rendering. Implement only the product's rules and provider-specific normalization that those tools do not supply.

### NOT in scope

- Telegram Mini App, additional chains and wallet bridges: explicitly deferred by product decisions.
- Custom derivatives programs, pooled/fractional treasury products and auto-copy trading: change custody or execution authority.
- Wheel, staggered portfolios and live buyer/seller matching: expand the beginner trading workflow.
- Tokens, valuable unfunded prizes and paid research-data tiers for official decisions: outside the launch reward design.
- A custom job-lease engine, Redis, websocket platform or microservice split: the same workflows fit the web/worker/PostgreSQL deployment.
- Default LLM research advice, private-chat ingestion and unlicensed news/equities feeds: no requirement to introduce these in the core MVP. Enabling optional LLM explanations later requires source-grounding, permission-leak and unsafe-action evaluations first.
- Desktop/mobile installers, a distributable SDK and a public container registry: delivery is the hosted responsive website plus the regular bot.

### Authoritative transaction and message flow

```text
WEB PROPOSAL
  authenticated member -> validate guild + draft/version
    -> BEGIN [freeze version + record operation + add_job(SQL)] -> COMMIT
    -> worker -> Telegram send
         acknowledged -> save message reference -> Published
         definite failure -> retry same operation within policy
         ambiguous send -> Unknown -> reconcile/marked replacement
  Never infer exactly-once network delivery from a queue key.

TELEGRAM VOTE
  secret + valid update -> opaque token lookup -> actor/chat/version checks
    -> short DB transaction -> lock ballot -> read clock_timestamp()
         closed / at deadline / revoked member -> reject, no tally write
         duplicate committed update -> return saved receipt
         valid -> vote revision + current vote + consumed update -> COMMIT
    -> success receipt + asynchronously refresh group message
  Database timeout -> explicit unsaved state; provider work is not on this path.

LIVE ORDER
  member -> current provider quote -> server review digest/revision
    -> member accepts -> consume scoped preparation token -> provider/wallet
         rejected/expired/changed/revoked -> no new authorized intent
         unknown submission -> reconcile existing intent; do not resubmit blindly
         verified fill -> append ledger event -> observed settlement -> result
         amended/void fill -> append correction -> new auditable result revision
```

Add compact matching diagrams to the future ballot service, order-intent service, job wrapper and provider-event normalizer where they clarify the state transitions. Update those comments when behavior changes.

### Performance and access budgets

These are initial engineering targets for Task 27, not measured production claims:

- A visible page polls one composed status response every 10 seconds; hidden/offline tabs pause. Quotes refresh through explicit actions/server policy, not each poll.
- Reads return 25 research records by default and at most 100 per page. History uses stable authorized cursors. Financial results reference precomputed immutable revisions rather than replaying all events on each read.
- Start with at most four background job handlers, reserving capacity for due transitions. Enforce a single total connection budget across all web/worker pools; a staging example is 10 web plus 5 worker connections with server capacity reserved for migrations/support. Recalculate for actual instance counts and host limits before release.
- No external provider or Telegram call occurs while holding a ballot lock. Bound vote lock/statement waits to the 1-second response target; a failed wait returns an honest unsaved response.
- Provider concurrency/rate budgets come from the selected provider's documented limits. Honor Retry-After, bounded retries and an overall operation deadline. Research/data backlogs cannot consume deadline-critical capacity.
- Private data uses authenticated server-only access and `private, no-store`; only explicitly shareable public/reference data is coalesced across members. Clear client caches on logout or account change.
- Test 100 members/five guilds and 200 visible clients under the stated polling policy, with a saturated background queue. Record p95 status and vote commit time, query counts, pool use, provider requests and queue lag.

### Parallelization and merge ownership

| Workstream | Modules | Dependencies |
| --- | --- | --- |
| Foundation | app setup, schema, auth, bot transport, guild/round services | Tasks 1–8 sequential; Task 0 research starts independently. |
| Financial/research core | domain, market, research/plans UI, proposal/ballot services | Task 9, then Tasks 10–17 in dependency order. |
| Wallet/provider boundary | Solana and live-provider adapters | Task 18 after Task 9; Task 20 after Task 18 and Gate 0. |
| Integration and release | cohorts, order review, reconciliation, results, community, operations | Tasks 19 and 21–29 follow their declared prerequisites. |

Lane A is the financial/research core. Lane B is Task 18, which may run in parallel with Task 10 after Task 9 freezes common contracts. Lane C is Task 20 once Gate 0 and Task 18 pass; it may proceed beside independent research/UI work against those frozen contracts. Lane D integrates Tasks 19 and 21–29 after their required inputs merge.

Tasks touching shared `src/server/services/`, bot dispatch, schemas, provider registry, test harnesses, package manifests or lockfiles require one merge owner and sequential edits to shared files. Do not claim the community workflow or schema changes are conflict-free parallel work. Run integration tests in isolated databases/schemas in each worktree. Parallel opportunities are optional execution choices, not new prerequisites or authorization to spawn agents.

### Verification status

There is no application/test framework in the current workspace. The future framework is specified as Vitest, real PostgreSQL integration tests and Playwright. The companion [engineering test plan](../../docs/reviews/2026-11-07-guild-wars-eng-review-test-plan.md) maps proposed branches and recovery flows. They are planned assertions, not executed tests or a measured coverage percentage. No existing-code regression is claimed by this document review.

## Implementation Tasks

These actions are folded into Tasks 0–29 above. Check them off when the application work is implemented and verified, not when this document is edited. Each recommendation was individually assessed as preserving the agreed workflows and accepted under the user’s automatic-approval instruction. Effort ranges are rough and exclude external waiting.

- [ ] **T1 (P2, human: ~3–6h / coding agent: ~45–90min)** · jobs · Use Graphile Worker with transactional enqueue and application effect deduplication.
  - Surfaced by: Architecture, R01; confidence 8/10. Decision: recommended remedy accepted; no fundamental end-workflow change.
  - Planned files: `src/server/jobs/queue.ts`, `src/server/jobs/outbox.ts`, `worker/main.ts`.
  - Verify: job-leases and outbox-atomicity integration suites.
- [ ] **T2 (P2, human: ~30–60min plus provider response / coding agent: ~10–20min plus provider response)** · provider readiness · Accept one verified hosted or supported wallet authorization path.
  - Surfaced by: Architecture, R02; confidence 8/10. Decision: recommended remedy accepted; no fundamental end-workflow change.
  - Planned files: `docs/decisions/0001-live-provider.md`, `docs/evidence/provider-capabilities.json`, `src/server/providers/live/selected-provider.ts`.
  - Verify: Gate 0 evidence and selected-provider contract suite.
- [ ] **T3 (P1, human: ~4–8h / coding agent: ~1–2h)** · order authorization · Bind preparation to the exact server-owned review digest and single-use intent token.
  - Surfaced by: Architecture, R03; confidence 8/10. Decision: recommended remedy accepted; no fundamental end-workflow change.
  - Planned files: `src/server/services/order-intents.ts`, `tests/integration/order-intents.test.ts`.
  - Verify: quote/owner/version substitution and two-tab replay tests.
- [ ] **T4 (P1, human: ~3–5h / coding agent: ~45–90min)** · ballots · Check the real post-lock clock and process deadline-sensitive callbacks without background backlog.
  - Surfaced by: Architecture, R04; confidence 8/10. Decision: recommended remedy accepted; no fundamental end-workflow change.
  - Planned files: `src/server/services/ballots.ts`, `src/server/telegram/webhook.ts`, `tests/integration/ballot-concurrency.test.ts`.
  - Verify: two-connection locked-past-deadline, duplicate update and commit/response recovery tests.
- [ ] **T5 (P1, human: ~4–8h / coding agent: ~1–2h)** · money · Carry explicit strike denomination, currency conversion provenance and fractional precision.
  - Surfaced by: Code Quality, R05; confidence 8/10. Decision: recommended remedy accepted; no fundamental end-workflow change.
  - Planned files: `src/domain/types.ts`, `src/domain/money.ts`, `src/domain/payoff.ts`, `src/domain/ledger.ts`.
  - Verify: fractional SOL, negative rounding, cross-currency fees and USDC/USD tests.
- [ ] **T6 (P1, human: ~4–8h / coding agent: ~1–2h)** · provider event normalization · Process amended and voided fills as explicit ledger corrections.
  - Surfaced by: Code Quality, R06; confidence 8/10. Decision: recommended remedy accepted; no fundamental end-workflow change.
  - Planned files: `src/server/services/import-provider-events.ts`, `src/server/jobs/reconcile-orders.ts`, `tests/integration/provider-reconciliation.test.ts`.
  - Verify: same-ID correction, void, stale status and replay tests.
- [ ] **T7 (P1, human: ~3–6h / coding agent: ~45–90min)** · identity · Complete session expiry, revocation, logout and conflicting-account recovery.
  - Surfaced by: Code Quality, R07; confidence 8/10. Decision: recommended remedy accepted; no fundamental end-workflow change.
  - Planned files: `src/server/auth/sessions.ts`, `src/server/services/link-telegram.ts`, `tests/integration/account-linking.test.ts`.
  - Verify: revoked session and stale live-review page tests.
- [ ] **T8 (P2, human: ~2–4h / coding agent: ~30–60min)** · benchmarks · Separate House policy commitment from matched execution pricing.
  - Surfaced by: Code Quality, R08; confidence 8/10. Decision: recommended remedy accepted; no fundamental end-workflow change.
  - Planned files: `src/domain/benchmarks.ts`, `src/server/services/results.ts`, `tests/integration/results-cohorts.test.ts`.
  - Verify: late entry and missing matched House quote tests.
- [ ] **T9 (P2, human: ~2–4h / coding agent: ~30–60min)** · CI · Start CI at bootstrap and add isolated PostgreSQL integration checks with the schema.
  - Surfaced by: Tests, R09; confidence 8/10. Decision: recommended remedy accepted; no fundamental end-workflow change.
  - Planned files: `.github/workflows/ci.yml`, `compose.test.yml`, `scripts/migrate-test.mjs`.
  - Verify: frozen install, intentional failing check and isolated migration evidence.
- [ ] **T10 (P2, human: ~1–2 days / coding agent: ~2–4h plus runtime)** · cross-interface recovery · Add interruption, identity-switch and canonical-state recovery journeys with each feature.
  - Surfaced by: Tests, R10; confidence 8/10. Decision: recommended remedy accepted; no fundamental end-workflow change.
  - Planned files: `tests/e2e/live-provider-journey.spec.ts`, `tests/e2e/telegram-handoffs.spec.ts`, `tests/e2e/live-review.spec.ts`.
  - Verify: G1–G10 named assertions in the engineering test plan.
- [ ] **T11 (P1, human: ~3–6h / coding agent: ~45–90min)** · private caching · Scope and revoke private caches while coalescing public market-data refreshes.
  - Surfaced by: Performance, R11; confidence 8/10. Decision: recommended remedy accepted; no fundamental end-workflow change.
  - Planned files: `src/server/market/cache.ts`, `app/api/rounds/[roundId]/research/route.ts`, `tests/integration/cache-isolation.test.ts`.
  - Verify: cross-user/guild/account-switch isolation and provider-call coalescing.
- [ ] **T12 (P2, human: ~3–5h / coding agent: ~45–90min plus runtime)** · worker and connection budgets · Reserve deadline capacity and cap provider, worker and database concurrency.
  - Surfaced by: Performance, R12; confidence 8/10. Decision: recommended remedy accepted; no fundamental end-workflow change.
  - Planned files: `src/server/jobs/budgets.ts`, `worker/main.ts`, `tests/integration/worker-budget.test.ts`, `tests/performance/pilot-load.test.ts`.
  - Verify: backlog, provider timeout, connection cap and deadline-load checks.
- [ ] **T13 (P2, human: ~3–6h / coding agent: ~45–90min plus query inspection)** · research and results reads · Add authorized cursors, query indexes, result snapshots and lazy chart/wallet loading.
  - Surfaced by: Performance, R13; confidence 8/10. Decision: recommended remedy accepted; no fundamental end-workflow change.
  - Planned files: `src/server/services/results.ts`, `src/server/services/research-notes.ts`, `src/components/research/price-chart.tsx`.
  - Verify: cursor boundary, snapshot revision, bounded query count and mobile fallback checks.
- [ ] **T14 (P1, human: ~30–60min / coding agent: ~10–20min)** · cohort integrity · Retain deviating members and mark the guild round provisional consistently.
  - Surfaced by: Code Quality, R14; confidence 8/10. Decision: recommended remedy accepted; no fundamental end-workflow change.
  - Planned files: `src/server/services/order-intents.ts`, `src/server/services/live-enrollment.ts`, `tests/integration/live-cohort.test.ts`.
  - Verify: losing/deviating sleeve remains in the frozen cohort.
- [ ] **T15 (P1, human: ~4–8h / coding agent: ~1–2h)** · coverage reservations · Reserve free covered allocation atomically across separate intents and sleeves.
  - Surfaced by: Native challenge, R15; confidence 8/10. Decision: recommended remedy accepted; no fundamental end-workflow change.
  - Planned files: `src/server/services/order-intents.ts`, `src/server/services/sleeves.ts`, `tests/integration/order-intents.test.ts`.
  - Verify: concurrent distinct-intent, unknown commitment and duplicate sleeve attribution tests.
- [ ] **T16 (P2, human: ~3–6h / coding agent: ~45–90min plus provider tests)** · execution cutoff · Reconcile order lifetime separately from quote expiry and classify late fills honestly.
  - Surfaced by: Native challenge, R16; confidence 8/10. Decision: recommended remedy accepted; no fundamental end-workflow change.
  - Planned files: `docs/evidence/provider-capabilities.json`, `src/server/services/order-intents.ts`, `src/server/jobs/reconcile-orders.ts`.
  - Verify: partial fills across cutoff, cancellation timeout and delayed ingestion of in-window fill.
- [ ] **T17 (P2, human: ~3–6h / coding agent: ~45–90min plus provider evidence)** · cross-round obligations · Carry rolled and settlement-pending liabilities without reusing collateral in the next round.
  - Surfaced by: Native challenge, R17; confidence 8/10. Decision: recommended remedy accepted; no fundamental end-workflow change.
  - Planned files: `src/server/services/midweek.ts`, `src/server/services/sleeves.ts`, `src/server/services/results.ts`.
  - Verify: roll past next opening and settlement overlapping two rounds.

## GSTACK REVIEW REPORT

Review date: November 7, 2026. Scope: this implementation plan against design spec v0.3. The user authorized automatic adoption of engineering recommendations unless they fundamentally change end workflows. All 17 applied recommendations preserve those workflows. No production application exists and no implementation test has run.

| Review | Trigger | Why | Runs | Status | Findings |
| --- | --- | --- | --- | --- | --- |
| Eng Review | plan-eng-review | Architecture, code quality, tests, performance | 1 | CLEAR · PLAN | 14 main-pass findings incorporated; no open engineering decisions |
| Native fresh-context challenge | Invoked skill fallback | Challenge missed assumptions | 1 | COMPLETED · in-host | 3 additional findings incorporated: cross-intent coverage, order cutoff, cross-round obligations |
| Independent outside-provider review | Skill outside-voice preflight | Independent model/provider coverage | 0 | UNAVAILABLE | Codex-host mismatch guard; no nested CLI was started; native pass does not supply outside coverage |
| CEO Review | Not invoked | Product scope unchanged | 0 | NOT RUN | No product-scope recommendation applied |
| Design Review | Not invoked | Separate visual review | 0 | NOT RUN | Existing approved prototype remains the visual reference |

**Completion summary:** Step 0 scope retained; Architecture 4 findings, Code Quality 5, Tests 2, Performance 3, plus 3 native-challenge findings. Thirteen added adversarial scenario groups are specified; this is planned coverage, not a measured percentage. NOT in scope, reuse, diagrams, failure handling and parallelization are written. Four execution lanes and two bounded parallel opportunities are documented; shared contracts/schema/dispatch edits stay sequential. Zero new TODO deferrals, zero unhandled critical silent-failure requirements and zero fundamental end-workflow changes. Lake score: 15/15 coverage choices select the complete remedy; R01 and R02 differ in kind and have no completeness score.

**Evidence:** [Detailed findings and tradeoffs](../../docs/reviews/2026-11-07-guild-wars-eng-review.md), [test plan and branch/user-flow diagram](../../docs/reviews/2026-11-07-guild-wars-eng-review-test-plan.md), and [native challenge output](../eng-review/2026-11-07-native-review.txt). Review/task/decision/learning records are project-local under `work/eng-review/gstack-state`; the prescribed startup helper path is absent and global startup/telemetry was not run. Plan-tier metadata is bound to the plan file rather than a nonexistent Git commit.

**OUTSIDE COVERAGE:** Independent provider unavailable. One native fresh-context pass completed; no cross-model independence or consensus is claimed.

**Remaining implementation gates:** select and validate the actual provider and execution/custody path; obtain permitted quote/mark data and required access; implement and pass A1–A20; review the concrete production release. These are retained prerequisites, not unresolved engineering-review decisions. No simulation-only substitute, fabricated live quote/fill, autonomous trade or funded transaction is approved by this review.

**VERDICT:** ENG CLEAR FOR IMPLEMENTATION · DONE_WITH_CONCERNS about unavailable independent-provider coverage and unvalidated live-provider readiness. This is not a deployment, live-trading or profitability clearance.

NO UNRESOLVED DECISIONS
