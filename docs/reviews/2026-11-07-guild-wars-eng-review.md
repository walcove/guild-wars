# Guild Wars engineering plan review

**Date:** November 7, 2026. **Scope:** the Solana MVP implementation plan, all four engineering sections. **Authority:** auto-apply recommendations unless they change end workflows, as directed by the user. No application implementation or production action is part of this review.

## Step 0 scope challenge

The existing spec and prototype supply the product decisions, visual language and member journey. There is no application repository or existing production logic to reuse. Many files are justified for a greenfield product with money, identity, external execution and a community interface; a large file count alone is not a reason to remove agreed features. Keep one website, one worker and PostgreSQL. Reuse the chosen SDK/template and replace generic queue infrastructure with a supported PostgreSQL job library.

**Decision:** retain the complete dual-mode MVP, simplify its internals, and do not change custody, trading strategy, voting, research participation or the member authorization journey. No new product features are added. No `TODOS.md` exists; zero new scope deferrals are proposed. Existing deferred features remain explicitly out of scope in the plan. The hosted web/worker deployment and CI/release path are included; binaries/mobile packages/public SDK distribution are not.

Scope and each remedy below are individually auto-approved under the user's instruction. This replaces the skill's default per-issue questions for this invocation. None is a destructive action or a fundamental end-workflow change.

## Evidence and calibration

All line references below refer to the preserved [pre-review plan snapshot](../../work/eng-review/2026-11-07-plan-before-review.md), so subsequent edits cannot move the cited evidence. The plan describes future work; findings identify omissions or contradictions in requirements, not observed production exploits. Confidence 8 means the plan evidence and documented interface support the recommendation. No executed application coverage is claimed.

## Architecture review

### R01 P2 confidence 8/10: avoid a second job platform implementation

**Evidence:** baseline task 4, line 244, instructs: “Implement PostgreSQL job claims using a transaction and `FOR UPDATE SKIP LOCKED`, leases, bounded retry, terminal failure, and dedupe keys.”

**Problem:** this recreates generic delivery and crash-recovery machinery before any product workflow exists. It also makes queue correctness another custom financial dependency.

**Recommendation A, accepted [Layer 1]:** use Graphile Worker's documented PostgreSQL enqueue/scheduling/retry API inside the existing domain transaction. Keep application operation IDs and uncertain delivery records. Its job keys do not establish once-only business effects.

**Alternative B:** keep the bespoke implementation and own lease recovery, polling, rescheduling and concurrency behavior. It avoids a dependency but increases the code and tests the team must maintain. Both approaches can cover the workflow, so they differ in kind, not coverage.

**Tradeoff:** one pinned library/migration dependency replaces a larger custom subsystem; effect deduplication and external-send ambiguity still require product code. Estimated implementation/validation effort: human 3–6h; coding-agent active work 45–90min, excluding external environment setup. **Plan changes:** Task 4 and common conventions. **Verification:** real-library transaction rollback, duplicate execution, crash replay and missed-domain-transition recovery.

### R02 P2 confidence 8/10: allow either supported authorization path

**Evidence:** line 138 requires “a provider-hosted user order path” while line 578 plans “an off-chain or on-chain path according to the selected provider's actual design.”

**Problem:** the readiness gate could reject a valid wallet/SDK provider merely because it is not a hosted website, despite the planned on-chain path.

**Recommendation A, accepted [Layer 1]:** require a permitted member-authorization path, either provider-hosted or supported SDK/wallet, plus verifiable fills and settlement. Choose exactly one actual provider path at Gate 0.

**Alternative B:** require only hosted providers and remove SDK execution. That narrows the provider set and may change the approved launch route; it is not necessary. These differ in kind, not coverage.

**Tradeoff:** a precise gate requires provider-specific evidence instead of assuming every SDK or deep link is suitable. Human 30–60min; agent 10–20min plus provider response time. **Plan changes:** Task 0; Task 20 no longer depends on a live cohort that is waiting for the same provider adapter. Task 19 prepares registration against contracts, and Task 21 verifies both registration and real provider access before use. **Verification:** evidence-backed hosted or wallet path, not a fake integration.

### R03 P1 confidence 8/10: bind authorization to the server's reviewed terms

**Evidence:** line 592 requires “quote/amount changes invalidate previous review” but the preparation flow at lines 593–596 does not specify a durable review revision or scoped token.

**Problem:** a client checkbox and a correctly rendered quote do not establish which exact terms a server may prepare after another tab, credential change or quote refresh.

**Recommendation A, accepted [Layer 1]:** store the canonical owner/account/round/version/instrument/quantity/quote/fees/expiry/settlement digest and revision. Consume a scoped single-use preparation token with the intent's idempotency key and recheck current permissions and pause state. Validate signed transaction instructions against the reviewed bounds where applicable.

**Alternative B:** rely on UI state and existing broad intent validation. This is happy-path coverage, 6/10, versus A at 10/10 for this decision. It leaves two-tab and stale-session cases ambiguous.

**Tradeoff:** a small persisted state machine buys explicit financial authority; no new user-facing review step is added. Human 4–8h; agent 1–2h. **Plan changes:** Task 21. **Verification:** token replay, swapped owner/wallet/quote, modified transaction, two tabs, changed amount and ambiguous retry.

### R04 P1 confidence 8/10: fix the vote's authoritative time boundary

**Evidence:** line 493 says “locking the same ballot row before the deadline/state check” and “Use database/server UTC”; line 278 enqueues incoming updates without distinguishing vote latency.

**Problem:** PostgreSQL `now()` is the transaction's start time. A transaction can start before the deadline, wait for the lock, and later use that old time. Queuing ballots behind slow research work also creates avoidable late processing.

**Recommendation A, accepted [Layer 1]:** process vote/link callbacks in a short bounded request transaction; use `clock_timestamp()` after the ballot lock. Accept strictly before the deadline, reject at/after it, and return saved receipts for committed duplicates. A close-job backlog cannot extend voting. Use opaque short callback tokens with server-side context lookup.

**Alternative B:** keep a generic queued callback path with an unspecified clock. It is simpler to describe but leaves boundary and receipt behavior incomplete: 6/10 versus A at 10/10.

**Tradeoff:** deadline-sensitive callbacks get a dedicated small service path, while slow work remains queued. The user still votes in Telegram. Human 3–5h; agent 45–90min. **Plan changes:** Tasks 6 and 15. **Verification:** real two-connection lock-wait test, exact deadline, worker backlog, rollback and response failure after commit.

## Code quality review

### R05 P1 confidence 8/10: make money denominations and rounding explicit

**Evidence:** line 201 names `strikeUsd`, line 336 stores `grossPremiumUsdcMicros`, and lines 386–387 divide a result into cents. General precision requirements exist, but conversion records and intermediate rounding are not defined.

**Recommendation A, accepted [Layer 1]:** type the strike denomination, preserve SOL/USDC unit scales, record USD conversion source/time/rate, retain sub-cent intermediate values, and round at explicit boundaries. Keep the cents kernel as an exact synthetic-fixture illustration only.

**Alternative B:** treat dollar-denominated inputs as interchangeable and add rounding as needed. That would silently imply a USDC/USD peg and lose small fractional amounts: 5/10 versus A at 10/10.

**Tradeoff:** more explicit monetary records and a few pure-function tests prevent inconsistent results across calculators, ledgers and leaderboards. Human 4–8h; agent 1–2h. **Plan changes:** Tasks 2 and 10. **Verification:** 1 lamport, fractional SOL, negative rounding, cross-currency fees, missing FX and 1.90 USDC × 0.98 = 1.862 USD before display rounding.

### R06 P1 confidence 8/10: separate duplicate fills from corrected fills

**Evidence:** line 227 makes external fill IDs unique; lines 608–610 list duplicate/out-of-order cases but do not define amendments with the same fill ID.

**Recommendation A, accepted [Layer 1]:** keep the stable fill identity plus provider event/revision/fingerprint. A verified amendment/void appends reversal/replacement events and a result revision. Unknown corrections stay visibly unverified. A stale status cannot regress a known fill.

**Alternative B:** ignore everything with a previously seen fill ID or overwrite it. Either can hide corrected quantities/fees or remove audit history: 5/10 versus A at 10/10.

**Tradeoff:** a versioned event normalizer adds work but makes repeat imports and provider corrections safe. Human 4–8h; agent 1–2h. **Plan changes:** Task 22. **Verification:** duplicate unchanged event, same-ID corrected fee/size, void, out-of-order stale status and repeated correction replay.

### R07 P1 confidence 8/10: complete session revocation and account boundaries

**Evidence:** line 262 defines five-minute challenges and secure cookies; line 264 rotates the link session. There is no session idle/absolute expiry, logout revocation or identity-conflict rule in Task 5.

**Recommendation A, accepted [Layer 1]:** add server-checked idle/absolute expiry, revocation, logout and fresh identity proof for link changes. Do not merge accounts just because a link is presented. Recheck credentials before trade preparation and clear the client cache on identity changes.

**Alternative B:** allow sessions and linked credentials to survive until manually replaced. This omits recovery and stale-page authorization boundaries: 6/10 versus A at 10/10.

**Tradeoff:** small settings and session-repository operations close a lifecycle gap without replacing the Telegram sign-in flow. Human 3–6h; agent 45–90min. **Plan changes:** Tasks 5, 11 and 21. **Verification:** expired/revoked sessions, identity collision, account switch and an old live-review page.

### R08 P2 confidence 8/10: distinguish House policy lock from matched pricing

**Evidence:** line 509 locks the House choice before voting, while line 642 promises matching the evaluation timestamp and data source.

**Recommendation A, accepted [Layer 1]:** keep the House's decision precommitted, but price its paper position using permitted contemporaneous comparison inputs. If those do not exist for a live fill time, label the House comparison informational with different timing.

**Alternative B:** compare a pre-vote paper premium to a later member fill as if timing matched. That produces a cleaner-looking but unsupported contest result: 6/10 versus A at 10/10.

**Tradeoff:** some live House comparisons may be informational until suitable data is available. Raw member results and holding benchmarks remain available. Human 2–4h; agent 30–60min, excluding data-access negotiation. **Plan changes:** Task 24. **Verification:** late entry, absent matching House quote and unchanged locked House choice.

### R14 P1 confidence 8/10: keep deviating members in the registered cohort

**Evidence:** line 559 says “Unverifiable or deviating sleeves make the affected guild result provisional; they do not disappear.” Line 595 describes a personal trade as “outside the guild's matched-plan cohort.” The latter contradicts the spec and the former rule.

**Recommendation A, accepted [Layer 1]:** make the order-review wording and service result retain the frozen cohort record and mark the guild round provisional. The member can always trade independently.

**Alternative B:** remove the deviating record from the denominator. This permits cherry-picking and conflicts with the agreed rule: 4/10 versus A at 10/10.

**Tradeoff:** a guild may be provisional, but its result cannot improve by hiding a member. Human 30–60min; agent 10–20min for wording/service contract tests. **Plan changes:** Task 21, consistent with Task 19. **Verification:** a losing/deviating sleeve stays present and invalidates official matched ranking as specified.

## Test review

### R09 P2 confidence 8/10: establish CI before feature work

**Evidence:** lines 707 and 713 introduce the workflow and comprehensive CI in Task 28, while Tasks 1–27 already rely on migrations, dependency compatibility and multiple suites.

**Recommendation A, accepted [Layer 1]:** put install/typecheck/lint/build/unit CI in Task 1, add PostgreSQL integration in Task 3 and grow it with each feature. Task 28 adds release evidence rather than first-time automation.

**Alternative B:** run everything manually until release preparation. It saves initial configuration but leaves reproducibility and empty-suite failures unchecked: 6/10 versus A at 10/10.

**Tradeoff:** earlier CI setup, fewer late integration surprises. Human 2–4h; agent 30–60min. **Verification:** clean-lockfile build, isolated database migration, intentional relevant failure and no leaked provider secrets in pull-request jobs.

### R10 P2 confidence 8/10: cover interruption and recovery across interfaces

**Evidence:** line 695 emphasizes viewports/accessibility, and line 596 covers quote expiry/rejection/repeated clicks. Cross-tab interruption, navigation away, identity switching and actual callback/clock boundaries are not enumerated.

**Recommendation A, accepted [Layer 1]:** add the ten named gap scenarios in the test-plan artifact to the feature suites and end-to-end harness, with user-visible recovery assertions. Do not delay these to a post-pilot test phase.

**Alternative B:** rely on happy-path journeys plus broad server validation. That misses the interaction that causes many stale-state errors: 7/10 versus A at 10/10.

**Tradeoff:** more purposeful integration/browser tests, with no tests for static text or implementation mirroring. Human 1–2 days; agent 2–4h plus test runtime. **Verification:** assertions on canonical persisted state and recovery UI, not only successful rendering.

No test framework exists in this document workspace. Vitest/PostgreSQL/Playwright are planned, not detected installed infrastructure. There are no existing production-code regressions to claim. The coverage artifact covers code-entry families and user flows and distinguishes planned checks from executed coverage.

## Performance review

### R11 P1 confidence 8/10: separate private caches from public refreshes

**Evidence:** line 407 says to cache data; the stack uses SWR and private research/order records, but no cross-user cache policy or polling budget is specified.

**Recommendation A, accepted [Layer 1]:** coalesce permitted public prices/history, keep account quotes/holdings/notes out of shared Next.js caches, use `private, no-store`, scope/clear client cache identity, pause hidden tabs and refresh quotes only by deliberate action/policy.

**Alternative B:** apply generic cache TTLs to the whole research response and let every client refresh quotes. That risks disclosure and multiplies provider requests: 5/10 versus A at 10/10.

**Tradeoff:** slightly more explicit data-transfer boundaries; ordinary reads become predictable and private. Human 3–6h; agent 45–90min. **Plan changes:** Tasks 11–12 and engineering budgets. **Verification:** two users/same URL, logout/account switch, stale public data and provider-call coalescing.

### R12 P2 confidence 8/10: bound concurrency and protect deadline work

**Evidence:** Task 4 lists quote capture, ballot closing, settlement and research resolution in one worker; line 710 adds lag alerts without a capacity or priority contract.

**Recommendation A, accepted [Layer 1]:** bound handler/database/provider concurrency and reserve worker capacity for due transitions. Use one worker deployment with supported logical task partitions. Vote services enforce deadlines independently of the queue.

**Alternative B:** let all work compete without bounds until pilot measurements. A single slow upstream can delay every due round: 6/10 versus A at 10/10.

**Tradeoff:** a small configuration/measurement surface in exchange for predictable load; targets remain provisional until measured. Human 3–5h; agent 45–90min plus load runtime. **Plan changes:** Tasks 4 and 27. **Verification:** backlog plus provider timeout plus ballot closure, connection caps and visible lag.

### R13 P2 confidence 8/10: paginate research and avoid replaying history on polls

**Evidence:** line 409 returns the research view, lines 423–426 build shared notes/chart data, and lines 642–662 calculate season outcomes, without query-count or page-size expectations.

**Recommendation A, accepted [Layer 1]:** add stable authorized cursors, bounded record counts, hot-path indexes and immutable result snapshots keyed by ledger/valuation/rules revision. Lazy-load chart/wallet code and preserve numeric alternatives.

**Alternative B:** load all notes and recalculate the season whenever a page refreshes. It is initially simple but grows with every message/mark and duplicates expensive work: 6/10 versus A at 10/10.

**Tradeoff:** explicit pagination and snapshot invalidation; no new data infrastructure. Human 3–6h; agent 45–90min plus query-plan inspection. **Plan changes:** Tasks 12, 24 and 27. **Verification:** cursor boundaries, tenant scope, snapshot revision, bounded query counts and the seeded pilot load.

## Current-practice checks

These external facts support implementation choices; they do not establish provider eligibility or production readiness:

- [Graphile SQL job API](https://worker.graphile.org/docs/sql-add-job) and [job-key caveats](https://worker.graphile.org/docs/job-key) support transactional enqueue. Running/replaced jobs can coexist, so application effect deduplication remains required. [Requirements](https://worker.graphile.org/docs/requirements) are compatible with choosing Node 24 and a supported PostgreSQL release, subject to the pinned version.
- [PostgreSQL time functions](https://www.postgresql.org/docs/current/functions-datetime.html) distinguish transaction-start time from actual `clock_timestamp()` time.
- [Next.js data-security guidance](https://nextjs.org/docs/app/guides/data-security) supports server-only, authorized, minimal data access. The review does not adopt experimental private-cache directives.
- [grammY webhook guidance](https://grammy.dev/guide/deployment-types) documents webhook timeout/retry concerns. [Telegram callback API](https://core.telegram.org/bots/api#inlinekeyboardbutton) constrains callback payload size and provides transport, not application voter eligibility.

## Suppressed findings

- **Confidence 4/10:** a wholesale authentication-library replacement might reduce maintenance, but no verified library integration was demonstrated for this bot-proof flow. Keep the explicit session design and lifecycle tests; do not introduce an unverified auth vendor.
- **Confidence 4/10:** a different scoring or cohort policy might be easier for a newcomer. That is a product-workflow change and is not necessary to repair the plan. Preserve the agreed rules and show provisional states clearly.
- **Not a finding:** provider/data access is not yet selected. The original plan already treats that as a launch gate; the review retains it rather than fabricating a solution or counting it as a newly fixed issue.

## Validation boundaries

Four sections completed: architecture 4 findings, code quality 5, tests 2, performance 3; 14 main-pass findings. A native fresh-context pass added three findings, recorded below: 17 total. All 17 remedies were accepted under the user's automatic-approval instruction, with no fundamental end-workflow change. The test artifact records 13 named adversarial groups; they overlap the remedies and are not another 13 independent findings.

Effort ranges are rough planning aids for each remedy, not delivery promises, and must not be summed into a calendar estimate. They exclude provider responses, infrastructure availability and actual expiration time.

The startup helper's prescribed `.Codex` path is absent. Review instructions and local helper binaries are available under `.agents`. The review uses project-local metadata and the current spec rather than enabling cross-project memory or telemetry. Outside-provider coverage and final review status are recorded in the implementation plan's terminal report after the independent pass.

## Native fresh-context challenge

The invoked skill requires an independent challenge. This session is already hosted by Codex, so the skill's own harness check disallows starting a nested Codex CLI. A native fresh-context subagent completed instead. This is not independent-provider or cross-model coverage. Full output is preserved in the [native review record](../../work/eng-review/2026-11-07-native-review.txt).

The three findings refer to the separate [pre-native-fix snapshot](../../work/eng-review/2026-11-07-plan-before-native-fixes.md). Each quote and line was checked against that snapshot. The native pass recommended applying all three; the main review agrees after checking the existing cohort/management rules. There is no reviewer disagreement on the remedies and no claim of cross-model agreement.

### R15 P1 confidence 8/10: reserve allocation across distinct intents

**Evidence:** native snapshot line 612 says “An intentional new trade requires a new reviewed intent”; line 573 registers an eligible allocation. Neither imposes cross-intent coverage reservations or exclusive attribution.

**Recommendation A, accepted [Layer 1]:** atomically reserve the account/mode/asset allocation across intents, retain Unknown commitments, and attribute a verified provider position only once. A fresh unencumbered provider snapshot and unreflected local commitments must not subtract the same encumbrance twice. Local reservations do not move or escrow funds; final provider coverage checks remain necessary for direct external trades.

**Alternative B:** rely only on per-intent idempotency and eventual provider rejection. It can permit two validly reviewed requests to compete for the same coverage or duplicate a performance sleeve: 6/10 versus A at 10/10.

**Tradeoff:** an internal reservation/reconciliation operation is added to an existing account/intent transaction; the member's authorization journey is unchanged. Human 4–8h; agent 1–2h. **Plan changes:** Tasks 19 and 21. **Verification:** two distinct concurrent intents, Unknown/partial commitments, one imported fill in two sleeves, and release after definitive cancellation/settlement.

### R16 P2 confidence 8/10: separate quote expiry from order lifetime

**Evidence:** native snapshot line 321 limits the execution window to 60 minutes; line 593 enforces quote TTL; line 625 recognizes partial fills without a cutoff policy for outstanding orders.

**Recommendation A, accepted [Layer 1]:** record time-in-force/expiration/cancellation capabilities at Gate 0. Enforce preparation cutoff, use supported provider expiry, reconcile outstanding orders, and request member-authorized cancellation where required. Late or uncertain fills remain real records with provisional matched scoring. Use actual fill time, not ingestion time.

**Alternative B:** assume quote expiry or the game clock cancels a provider order. This hides late execution and may free cover too early: 5/10 versus A at 10/10.

**Tradeoff:** another provider capability and cutoff job/check are required; no autonomous cancellation permission is assumed. Human 3–6h; agent 45–90min plus provider contract tests. **Plan changes:** Tasks 0, 21 and 22. **Verification:** partial fills straddling cutoff, cancel timeout, late-arriving in-window records and missing fill time. Native confidence was 9/10; the final report uses 8/10 because this is a verified plan gap, not a demonstrated production-code failure.

### R17 P2 confidence 8/10: carry real obligations beyond a weekly boundary

**Evidence:** native snapshot line 646 permits rolls, while line 680 builds independent weekly performance indices. The spec defers multiple core expirations but allows provider-supported rolling out as management.

**Recommendation A, accepted [Layer 1]:** retain supported member roll-outs and late-settling positions, keep their actual liabilities/reservations until authoritative resolution, and treat exposure beyond the original comparison horizon as a recorded deviation/provisional round. The next sleeve uses newly verified free assets. Never apply the simulator's reset to live balances.

**Alternative B:** assume the weekly boundary resets the real account or disable rolling out. The former breaks accounting; the latter changes an end workflow. Neither is recommended. A completes the accounting policy at 10/10; ignoring carry-forward is 5/10, and removing management is a different-kind product change outside automatic approval.

**Tradeoff:** the ledger tracks an already existing real obligation across game rounds; ranking eligibility follows the agreed deviation rule. Human 3–6h; agent 45–90min plus provider evidence. **Plan changes:** Tasks 22–23. **Verification:** a roll beyond the next opening and delayed settlement overlapping two rounds, with no double reuse of coverage.
