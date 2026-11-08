# Guild Wars Solana MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
> **For Codex or another implementer:** Follow the same task-by-task execution and verification workflow. This document authorizes planning, not live financial actions or a production release.

**Goal:** Build a beginner-friendly SOL covered-call game with a responsive research and planning website, linked Telegram discussion and voting, and separate simulated and individually authorized real-trading paths.

**Architecture:** One Next.js application and one persistent TypeScript worker share domain services and PostgreSQL. The Telegram bot is an adapter into those services. Simulation and the selected live provider implement separate execution adapters; Solana Kit handles the optional Solana wallet and on-chain provider boundary.

**Tech Stack:** TypeScript, Next.js, React, Tailwind, Solana Kit and supported RPC/wallet plugins, `@solana/react`, grammY, PostgreSQL, Drizzle, SWR, Lightweight Charts, Vitest, React Testing Library, and Playwright for product browser tests.

---

## 1. Read this first

**Plan date:** November 7, 2026. **Status:** Ready for implementation planning review; no tasks have been executed.

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
npm run db:generate            Drizzle migration generation
npm run db:migrate             Explicit development migration command
npm run db:migrate:test        Guarded dedicated test-database migrations
npm run worker:check           Worker compilation/bundle verification
npm run verify                Typecheck, lint, unit tests, production build,
                               worker check; excludes secret-dependent checks
```

Unit configuration includes `src/**/*.test.ts` and `src/**/*.test.tsx`; integration, contract, and browser suites have separate configurations and do not run accidentally during unit tests. CI uses a dedicated PostgreSQL service. Local integration tests use `compose.test.yml`, bound to loopback port 54329 and database `guild_wars_test`. The test migration command must reject production URLs and any database not explicitly designated for testing. Do not add an unrestricted drop/reset command.

Use server-owned UTC instants and an injectable clock for boundary tests. Use `bigint` token units and fixed-precision decimal representations at database/API boundaries. Serialize integers as strings in JSON. Never serialize a JavaScript `bigint` directly or calculate financial values with binary floating point.

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
- [ ] Verify CoinGecko access and display/storage rights for research. Separately identify permitted option snapshots and hourly marks for simulation/scoring; do not treat the research-data subscription as permission for trading or redistribution.
- [ ] Review Gate 0: a provider-hosted user order path plus verifiable fills and settlement is mandatory. An embeddable SDK is optional. If access is missing, continue independent application tasks and record the live blocker; do not build a substitute derivatives venue.

**Verification:** The decision links to evidence for every enabled capability and names a full settlement path. No externally funded trade is performed as part of this research task.

**Commit after Task 1 creates the repository:** `docs: record provider and market data readiness`

### Task 1: Bootstrap the application and compatible dependency set

**Dependencies:** Task 0 started; completion does not require provider access. **Spec:** section 10.

**Files:**
- Create: application repository, `package.json`, `package-lock.json`, `.nvmrc`, `.gitignore`, `.env.example`, `README.md`.
- Create: `docs/decisions/0003-dependency-matrix.md`, `vitest.unit.config.ts`, `vitest.integration.config.ts`, `vitest.contracts.config.ts`, `playwright.config.ts`, `worker/main.ts`, `scripts/worker-check.mjs`.
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
  strikeUsd: string;
  expiresAt: string;
  settlement: 'physical' | 'cash';
  custody: Custody;
  location: SettlementLocation;
  instrumentId: string;
  providerId: string;
}
```

- [ ] Implement exact unit parsing/formatting with rejection of excess fractional digits. Keep quote/fee currency explicit; instruments using another settlement asset are out of scope unless the spec changes.
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

**Commit:** `feat: persist guilds rounds ballots and trading records`

### Task 4: Implement durable jobs, outbox, and audit records

**Dependencies:** Task 3. **Spec:** sections 6, 12; A5, A8, A18.

**Files — create:**
- `src/server/jobs/queue.ts`, `src/server/jobs/outbox.ts`, `src/server/jobs/scheduler.ts`, `src/server/jobs/handlers.ts`.
- `src/server/services/audit.ts`, `tests/integration/job-leases.test.ts`, `tests/integration/outbox-atomicity.test.ts`.
- Modify: `worker/main.ts`.

- [ ] Add a test where a service transaction rolls back: neither its domain change nor outbound job survives. Add a two-worker claim test proving one active lease per job.
- [ ] Implement PostgreSQL job claims using a transaction and `FOR UPDATE SKIP LOCKED`, leases, bounded retry, terminal failure, and dedupe keys. Release or expire leases after worker interruption.
- [ ] Implement atomic domain-change-plus-outbox writes. Separate operation IDs from delivery attempts; an ambiguous Telegram send is recorded as Unknown, not retried as a new ballot.
- [ ] Add an injectable clock and scheduled handlers for ballot closing, quote capture, midweek notices, settlement checks, and research resolutions. Jobs derive current authorization/state at execution time.
- [ ] Run both targeted integration suites, interrupt a local worker during a leased synthetic job, and verify safe recovery. Persist actor, reason, affected record and correction links in audit events.

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
- [ ] Run `npm run test:integration -- tests/integration/account-linking.test.ts` and verify a new simulation member can sign in without wallet connection or transaction.

**Commit:** `feat: link Telegram identities with session-bound account proof`

### Task 6: Add the regular Telegram bot transport

**Dependencies:** Tasks 4–5. **Spec:** section 6; A2, A5–A8.

**Files — create:**
- `src/server/telegram/bot.ts`, `src/server/telegram/webhook.ts`, `src/server/telegram/commands.ts`, `src/server/telegram/callbacks.ts`, `src/server/telegram/render.ts`.
- `app/api/telegram/webhook/route.ts`, `tests/integration/telegram-updates.test.ts`, `tests/contracts/telegram-render.test.ts`.

- [ ] Add failing tests for wrong webhook secret, replayed update, forged callback user, and command text containing untrusted markup.
- [ ] Initialize grammY on the server only. Authenticate the webhook secret, durably record/enqueue updates, and deduplicate before dispatch. Do not assume a command's advertised scope grants permission.
- [ ] Implement `/start`, `/help`, and `/privacy`, and the link confirmation callback. Use ordinary URL buttons; prohibit web_app buttons and Mini App configuration. Implement escaping and length-aware message splitting.
- [ ] Return callback feedback promptly but confirm a saved vote or account link only after durable commit. Use private receipts only for users who started the bot; otherwise callback feedback plus a web receipt.
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

- [ ] Implement physically delivered terminal payoff with integer-scaled prices. A complete arithmetic kernel for the synthetic cent-based fixture is:

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
- [ ] Implement append-only asset/cash/liability/fee events and equity projections. Add a settlement regression showing assigned SOL is removed when proceeds are booked; duplicate settlement/fill events have no second effect.
- [ ] Run payoff/ledger unit suites and the PostgreSQL idempotency suite. Include invariants: the simple delivered seller's terminal gain is capped, falling-asset losses remain possible, and cash plus underlying is never double counted.

**Commit:** `feat: calculate covered-call outcomes and auditable ledger events`

### Task 11: Integrate SOL history and source-linked events

**Dependencies:** Tasks 4, 9–10; Task 0 data rights for real data. **Spec:** section 4; A3, A20.

**Files — create:**
- `src/server/market/coingecko.ts`, `src/server/market/cache.ts`, `src/server/market/events.ts`, `src/server/market/source-policy.ts`.
- `src/server/jobs/refresh-market.ts`, `tests/contracts/market-data.test.ts`, `tests/integration/research-data-access.test.ts`.
- `app/api/rounds/[roundId]/research/route.ts`.

- [ ] Test rate limits, stale data, changed historical granularity, API errors, missing timestamps, and attempts to expose a server API key in the research payload.
- [ ] Implement a server-side CoinGecko adapter using the permitted plan and SOL identifier. Normalize UTC time, price currency, source and freshness; cache under actual licence/TTL terms. Keep market reference, provider quote, and settlement price separate.
- [ ] Add curated event entries with original URL, scheduled UTC instant, relevance note, author and last-checked time. Import Solana Status RSS/Atom only through a bounded parser; manually curated macro calendars are sufficient for the pilot. Do not invent an economic-calendar API.
- [ ] Return the permitted guild research view with a small call menu from the adapter contract. Quote failures produce Unavailable, not filler values. External data failures may leave the chart visible as stale while disabling affected quote-dependent decisions.
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
- [ ] Implement `castVote` and `closeBallot` in PostgreSQL transactions locking the same ballot row before the deadline/state check. Use database/server UTC, unique current votes, monotonic revision events, and deduplicated Telegram update IDs. Reject forged or late callbacks.
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
- [ ] Show separate normalized guild-plan, member-account and verified-cohort views. Publish only consented aggregates; individual account amounts remain owner-visible by default.
- [ ] Run unit/integration suites and verify that capital size never changes a vote or research award.

**Commit:** `feat: preregister live performance sleeves without trade delegation`

### Task 20: Implement the single approved live provider adapter

**Dependencies:** Gate 0 passed; Tasks 9–10, 18–19. **Spec:** section 7; A10–A14.

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
- [ ] Build quantity, current premium, all fees, net premium, upside cap, downside risk, settlement and custody/location review. Require explicit member action to enter the provider's authorization flow. Do not store seed phrases or trade-enabled/withdrawal API keys.
- [ ] Add a clear decline/Keep participating route. For unmatched terms, explain that an individually authorized personal trade is outside the guild's matched-plan cohort and remains in its actual account history.
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
- [ ] Separate expiration, settlement, claimable balance and completed withdrawal. No automatic capital unlock based only on a wall clock. A claim transaction requires its own supported provider/member authorization where applicable.
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
- [ ] Aggregate the complete registered live cohort and show cohort size, participating capital and member result range under consent rules. Do not pool live/simulation, custody/provider divisions, or normalized paper results with actual money.
- [ ] Retain declined/failed/losing/deviating positions and mark incomplete cohorts provisional. Give each owner their full actual account record; keep guild paper benchmarks visibly paper.
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
- Modify only components/routes with reproduced defects.

- [ ] Map each acceptance criterion to a test or explicit manual evidence item before running the full journey. Distinguish synthetic end-to-end checks from real provider evidence.
- [ ] Exercise invitation → account link → research → plan → Telegram publication → vote/change vote → result → simulated booking → midweek → settlement/results. Use the real domain/service layer and a local Telegram HTTP harness, not a second implementation of voting rules.
- [ ] Exercise the live review path with the approved sandbox/recorded adapter: eligibility, fresh quote, separate authorization, partial/unknown order state, verified fill and settlement. A mock success alone does not satisfy A12.
- [ ] Run every core screen at 390×900 and 1360×1080, keyboard-only navigation, visible focus, labels, screen-reader-friendly numeric alternatives, zoom and loading/error states. Save review screenshots of research, proposal, Telegram ballot and trade review.
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
- [ ] Verify CI on the frozen lockfile: install, typecheck, lint, unit/integration/contract tests, web/worker build and critical browser tests. Isolate secret-dependent provider checks; no production secrets in pull-request jobs.
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
