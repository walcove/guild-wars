# Guild Wars MVP · Design plan review

**Date:** November 7, 2026. **Target:** [Implementation plan revision 1.2](../plans/2026-11-07-guild-wars-solana-mvp-implementation.md). **Verdict:** Design plan clear for implementation, with runtime and provider gates retained. No application code was implemented.

The requested `/design-review` routes pre-implementation work to `/plan-design-review`. The review covered all seven passes against the product spec v0.3, supplied Deco DESIGN.md, the 13-screen prototype source, and its desktop research/mobile Telegram ballot screenshots. The workspace has no application repository, branch diff, production UI or application tests. Screenshots support visual-reference observations, not runtime accessibility claims. Existing engineering findings and financial boundaries are retained.

## Review scope and reuse

Reuse the navy/amber/cyan palette, Bodoni/Hanken/JetBrains roles, simple call choices, scenarios, immutable proposal brief and Telegram handoffs. All members retain research access. Telegram remains the vote surface; the website remains research/planning and individual review. Both real and simulated trading remain required. No provider, custody model or paid resource is selected here.

**Not in scope:** Mini App, web voting, additional chains, pooled/fractional custody, custom options protocol, live buyer/seller marketplace, Wheel/staggered portfolios, launch token, autonomous trading, standing research-reviewer role, or a production release. Each would expand an accepted workflow or financial boundary. No new TODO deferral is proposed; accepted design work is part of the existing implementation tasks.

## Seven-pass completion summary

Scores judge how much the plan specifies, not how good an unbuilt application performs. Overall is the minimum of six scored passes. A score of 10 requires rendered behavior and newcomer evidence that this planning review cannot supply.

| Pass | Before → after | Evidence and accepted improvement |
| --- | --- | --- |
| Step 0 initial impression | 7/10 | Strong journey and financial rules; insufficient presentation contracts |
| 1. Information architecture | 7 → 9 | D01 defines three first-viewport priorities, every surface's actions, navigation and old obligations |
| 2. Interaction states | 6 → 9 | D03–D05 define visible module states, receipts, recovery and financial lifecycle language |
| 3. Journey and emotional arc | 7 → 9 | D02/D06 and storyboard support initial understanding, safe authorization, delays and losses |
| 4. Specificity / slop risk | 6 → 9 | D07 replaces decorative card/vault inheritance with a utility workspace and explicit language |
| 5. Design system | 5 → 9 | D07 maps supplied tokens and typography; no reliance on an external reference alone |
| 6. Responsive / accessibility | 6 → 9 | D08 specifies 320px mobile, tablet, desktop, text/zoom, controls, keyboard and chart alternatives |
| 7. Decision register | Unscored | Nine accepted remedies, zero deferred and zero open design decisions |
| Overall | **5 → 9** | Plan completeness; visual QA, actual contrast and newcomer validation still required |

## Individual remedies and decisions

Each remedy below was assessed separately. The recommended option was accepted under the user's standing instruction to auto-approve recommendations unless they fundamentally change end workflows. Scope/focus auto-selection does not stand in for remedy approval: that explicit standing instruction is the authority for each entry. All nine preserve the workflows. The alternative is documented to make the tradeoff reviewable; no unapproved scope change is embedded.

### D01 · Specify guild/round/mode orientation and next actions across web and Telegram

**Severity:** P1. **Evidence:** D01: baseline plan lines 308, 439–442 in [saved baseline](../../work/design-review/2026-11-07-plan-before-design-review.md). **Confidence:** 9/10 that the specification gap exists; runtime effects remain hypotheses.

**A · Recommended and accepted:** Implement the section 8 contract and its Task 7, 12, 27 annotations. This makes the existing journey explicit; cost is additional component/state implementation and verification (human ~3–5h; coding agent ~35–60min, estimates can overlap).

**B · Alternative:** Keep module lists without hierarchy. Implementers choose competing dashboards; extra screen ambiguity persists.

**Decision:** A, auto-approved under the standing instruction; no fundamental end-workflow change. **Verify:** Inspect first viewport at all four widths; returning members can find the exact discussion and older pending positions.

### D02 · Explain covered-call obligations and separate fixed comparison terms from personal size

**Severity:** P1. **Evidence:** D02: baseline plan lines 439–440, 458–459, 615 in [saved baseline](../../work/design-review/2026-11-07-plan-before-design-review.md). **Confidence:** 9/10 that the specification gap exists; runtime effects remain hypotheses.

**A · Recommended and accepted:** Implement the section 8 contract and its Task 12, 13, 21 annotations. This makes the existing journey explicit; cost is additional component/state implementation and verification (human ~2–4h; coding agent ~30–50min, estimates can overlap).

**B · Alternative:** Rely on expandable education and editable-looking reference fields. Less visible explanation, but newcomers may mistake comparison for personal authorization.

**Decision:** A, auto-approved under the standing instruction; no fundamental end-workflow change. **Verify:** Read down/flat/rally cases, inspect fixed expiry/1 SOL labels, and check provider size errors without upward rounding.

### D03 · Implement visible loading, empty, error, success and partial states with retained drafts

**Severity:** P1. **Evidence:** D03: baseline plan lines 440–442, 474–477 in [saved baseline](../../work/design-review/2026-11-07-plan-before-design-review.md). **Confidence:** 9/10 that the specification gap exists; runtime effects remain hypotheses.

**A · Recommended and accepted:** Implement the section 8 contract and its Task 12, 13, 14, 27 annotations. This makes the existing journey explicit; cost is additional component/state implementation and verification (human ~3–5h; coding agent ~40–70min, estimates can overlap).

**B · Alternative:** Use a generic spinner, toast and retry pattern. Less specification work, but stale data and ambiguous publication become misleading.

**Decision:** A, auto-approved under the standing instruction; no fundamental end-workflow change. **Verify:** Interrupt saves/publication; drafts survive and unknown delivery never reports Published.

### D04 · Recover exact-version links and distinguish saved, unsaved, closed and superseded votes

**Severity:** P1. **Evidence:** D04: baseline plan lines 270–274, 475–477, 523–524 in [saved baseline](../../work/design-review/2026-11-07-plan-before-design-review.md). **Confidence:** 9/10 that the specification gap exists; runtime effects remain hypotheses.

**A · Recommended and accepted:** Implement the section 8 contract and its Task 5, 7, 14, 16, 27 annotations. This makes the existing journey explicit; cost is additional component/state implementation and verification (human ~3–6h; coding agent ~45–80min, estimates can overlap).

**B · Alternative:** Rely on raw browser deep links and callback acknowledgements. Fewer recovery states, but a lost browser session or closed ballot becomes a dead end.

**Decision:** A, auto-approved under the standing instruction; no fundamental end-workflow change. **Verify:** Test expired/different-browser link, auth return, deleted discussion, changed vote and deadline feedback in native Telegram.

### D05 · Show honest personal order and settlement states with safe recovery actions

**Severity:** P1. **Evidence:** D05: baseline plan lines 611, 614–617, 629–634, 649–652 in [saved baseline](../../work/design-review/2026-11-07-plan-before-design-review.md). **Confidence:** 9/10 that the specification gap exists; runtime effects remain hypotheses.

**A · Recommended and accepted:** Implement the section 8 contract and its Task 21, 22, 23, 27 annotations. This makes the existing journey explicit; cost is additional component/state implementation and verification (human ~4–6h; coding agent ~50–90min, estimates can overlap).

**B · Alternative:** Expose backend order enum names directly. Fewer copy/state mappings, but Unknown and Expired invite mistaken resubmission or asset-release assumptions.

**Decision:** A, auto-approved under the standing instruction; no fundamental end-workflow change. **Verify:** Reopen Unknown/partial intent, expire a quote, delay settlement and carry a roll without a duplicate-order CTA or fake released funds.

### D06 · Separate net result, matched holding, paper plan and consented account aggregates

**Severity:** P1. **Evidence:** D06: baseline plan lines 577–578, 665–671, 687–688 in [saved baseline](../../work/design-review/2026-11-07-plan-before-design-review.md). **Confidence:** 9/10 that the specification gap exists; runtime effects remain hypotheses.

**A · Recommended and accepted:** Implement the section 8 contract and its Task 19, 24, 25, 27 annotations. This makes the existing journey explicit; cost is additional component/state implementation and verification (human ~2–4h; coding agent ~30–50min, estimates can overlap).

**B · Alternative:** Lead results with premium or season score. Simpler celebratory recap, but total losses and comparison quality become obscured.

**Decision:** A, auto-approved under the standing instruction; no fundamental end-workflow change. **Verify:** Inspect a negative round with positive excess return, a provisional rank, and private versus public summaries.

### D07 · Apply selected Deco tokens and readable type without a card mosaic or misleading vault language

**Severity:** P2. **Evidence:** D07: baseline plan lines 157, 439–442; supplied DESIGN.md lines 92–115 in [saved baseline](../../work/design-review/2026-11-07-plan-before-design-review.md). **Confidence:** 9/10 that the specification gap exists; runtime effects remain hypotheses.

**A · Recommended and accepted:** Implement the section 8 contract and its Task 1, 12, 24 annotations. This makes the existing journey explicit; cost is additional component/state implementation and verification (human ~2–3h; coding agent ~25–40min, estimates can overlap).

**B · Alternative:** Copy the decorative settlement reference literally. Fast aesthetic reuse, but small text, card density and vault/payout language misrepresent this MVP.

**Decision:** A, auto-approved under the standing instruction; no fundamental end-workflow change. **Verify:** Inspect token mapping, semantic palette pairs, focus and visited links; verify 16px main reading and explicit loss labels.

### D08 · Specify narrow mobile, tablet, desktop, keyboard and chart alternatives before implementation

**Severity:** P1. **Evidence:** D08: baseline plan lines 442, 722–723 in [saved baseline](../../work/design-review/2026-11-07-plan-before-design-review.md). **Confidence:** 9/10 that the specification gap exists; runtime effects remain hypotheses.

**A · Recommended and accepted:** Implement the section 8 contract and its Task 1, 12, 13, 21, 27 annotations. This makes the existing journey explicit; cost is additional component/state implementation and verification (human ~3–5h; coding agent ~40–70min, estimates can overlap).

**B · Alternative:** Retain only two viewport checks and generic accessibility wording. Lower documentation effort, but tablet, narrow reflow and keyboard behavior remain implementer guesses.

**Decision:** A, auto-approved under the standing instruction; no fundamental end-workflow change. **Verify:** Check four widths, 200% zoom/text, 320px reflow, visible focus, 44px controls, dialog focus and numeric chart alternatives.

### D09 · Make submission caps, misses, award reasons and appeal states understandable without activity incentives

**Severity:** P2. **Evidence:** D09: baseline plan lines 702–705 in [saved baseline](../../work/design-review/2026-11-07-plan-before-design-review.md). **Confidence:** 9/10 that the specification gap exists; runtime effects remain hypotheses.

**A · Recommended and accepted:** Implement the section 8 contract and its Task 26, 27 annotations. This makes the existing journey explicit; cost is additional component/state implementation and verification (human ~2–3h; coding agent ~25–40min, estimates can overlap).

**B · Alternative:** Use a generic community activity/rewards feed. Less form/status design, but posting caps and valuable awards can be confused with engagement incentives.

**Decision:** A, auto-approved under the standing instruction; no fundamental end-workflow change. **Verify:** Inspect first contribution, exhausted forecast allowance, pending/resolved/missed call and 48-hour appeal with no token-value promise.

## Visual-pattern checks

Classifier: **OPERATE** for the product website; native Telegram for chat/ballots. The design reference's expressive theme is intentional and user supplied, not grounds for an automatic theme reset. The plan should use its brand details while prioritizing financial comprehension.

| Hard-rejection check | Baseline evidence | Disposition |
| --- | --- | --- |
| Generic first-impression card grid | Research screenshot is a working two-column view, not a marketing grid | No finding on the grid rule |
| Beautiful image with weak brand | No hero imagery; Guild Wars wordmark present | No issue found |
| Headline without clear action | Compare outcomes action is present | No issue found; D01 strengthens priority |
| Busy image behind text | No busy imagery in the inspected views | No issue found |
| Repeated mood statements | Research and ballot use task copy | No issue found |
| Purposeless carousel | No carousel specified | No issue found |
| App made of stacked cards | Prototype research nests choice cards inside panels and stacks panels down the page; source settlement reference is especially card-heavy | Risk accepted for correction in D07; production layout must earn each card |

| Litmus question | Primary review baseline → amended plan | Evidence |
| --- | --- | --- |
| Brand/product unmistakable first? | YES → YES | Brand present; D01 strengthens SOL covered-call specificity |
| One strong anchor? | YES → YES | Two-call/Hold decision and outcome action |
| Understandable by scanning headings? | NO → YES in specification | D01 screen hierarchy and D05 plain statuses |
| Each section has one job? | NO → YES in specification | D01/D07 remove dashboard mosaic ambiguity |
| Cards necessary? | NO for every panel → YES for specified uses | D07 limits cards to meaningful choices/objects |
| Motion improves hierarchy? | NOT SPECIFIED → nonessential | D07 explicitly makes motion optional, visible-default and reduced-motion aware |
| Works without decorative shadows? | YES → YES in specification | Tonal surfaces, type and lines carry structure |

These are the primary review's judgments. There is no cross-model litmus consensus because no independent external provider completed a pass; the native completeness pass did not supply seven visual litmus answers. Record its visual cells as not assessed rather than infer agreement.

## Fresh-context challenge

One native design subagent read the baseline plan and product context, with no edits. It returned six findings: hierarchy/navigation (high); order/recovery language (high); Telegram/browser recovery (high); fixed comparison terms versus personal size (medium); responsive/accessibility detail (medium); actionable deadlines and receipts (medium). All were reconciled into D01, D02, D04, D05 and D08. No additional distinct remedy or fundamental workflow change remained. This is in-host fresh-context coverage, not independent cross-model review.

Outside review was unavailable under the Codex-host guard; no nested CLI or replacement external provider was started. The prescribed startup helper path is absent. The generator binary exists at an alternate skill path, but no configured generator auth file or OPENAI_API_KEY was present; no setup, secret read or paid image generation was attempted. A static HTML sketch is the permitted fallback, with explicit illustrative labels. No new image/mockup was approved by the user in this review.

## Implementation and verification

The nine flat D01–D09 build actions are in the implementation plan alongside the 17 retained engineering actions. Sixteen existing task descriptions now point directly at their design requirements. All checkboxes remain unchecked. Planned application checks include native Telegram desktop/mobile, four responsive sizes, keyboard/zoom/reflow, source failures, authentication return, Unknown/partial orders, cross-round obligations, private/public results, a losing round, research caps and award appeals. None of those application checks ran during this planning review.

The local sketch was inspected in the visual companion at 1360×1080 and 390×900. Its DOM reported document widths matching each viewport (no horizontal overflow); desktop and mobile screenshots were saved under outputs/Guild_Wars_Design_Review_Sketch.png and outputs/Guild_Wars_Design_Review_Mobile.png. This checks the illustration only. It uses hypothetical data, static controls and a native-Telegram representation; it neither calls a provider nor posts to Telegram. Source-document checks verify headings, unique review IDs, all 30 task sections, terminal report structure, preserved engineering work and local link targets. Those checks are distinct from product tests.

## Readiness dashboard

| Review | Runs | Latest scope | Status |
| --- | --- | --- | --- |
| Engineering | 1 | Plan revision 1.1 | CLEAR on prior plan; amendments require implementation validation |
| Design | 1 | Plan revision 1.2 | CLEAR · PLAN, 5/10 → 9/10, zero open decisions |
| Native challenges | 2 | Engineering and design | Completed in host; 3 and 6 findings folded respectively |
| External outside voices | 0 completed | Independent provider | UNAVAILABLE, not a pass or consensus |
| CEO / DX / code adversarial | 0 | Not invoked | Not run |

No new CEO review is warranted by these presentation fixes. After implementation, run design-review on rendered desktop/mobile and Telegram flows, and engineering/code review on the actual application. The earlier engineering record retains its original plan hash; it is not silently rebound to this revision. Provider/data/eligibility, dual-mode execution evidence and release authorization remain launch gates.

**VERDICT:** DESIGN PLAN CLEAR FOR IMPLEMENTATION. DONE_WITH_CONCERNS about unavailable independent-provider coverage and unvalidated live readiness. No production launch or financial action is authorized.

NO UNRESOLVED DECISIONS

<!-- Supporting sketch: /Users/cawal/Documents/Codex/2026-11-01/referenced-chatgpt-conversation-this-is-an/work/eng-review/gstack-state/projects/guild-wars-mvp/designs/20261107-plan-review/design-sketch.html -->
