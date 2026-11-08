# Implementation ruling index

Historical decisions and their costs, extracted from the [canonical implementation checklist](../implementation-checklist.md). This is a reference snapshot, not a second progress ledger. Resolved historical infrastructure limits are not current blockers. The final review also records its [regrade and declined-scope rulings](final-branch-review.md).

- Ruling: application root is `/Users/cawal/repos/guild-wars-mvp`; the new dedicated repository on an implementation branch supplies an isolated checkout at the requested path. No nested worktree is needed. Cost if wrong: relocate the checkout.

- Ruling: Task 0 staging uses `/private/tmp/guild-wars-readiness`, preserving the original document workspace and empty scaffold target. Copies moved into this repository after scaffolding; active records here are canonical. Cost if wrong: path-only relocation.

- Ruling: current official Solana guidance supersedes the skill’s obsolete Framework Kit default; use pinned Kit/plugins/`@solana/react` from the approved spec. No machine-level MCP configuration changes are necessary. Cost if wrong: revisit dependency boundary.

- Ruling: retain Task 1 as partially verified and continue independent implementation against the buildable foundation; do not treat unavailable browser evidence as a product pass. Cost if wrong: later visual/reflow fixes.

- Ruling: user-requested canonical checklist replaces the skill’s separate private progress ledger; task briefs and verification are still followed. Cost if wrong: adapt helper scripts without changing product behavior.

- Ruling: retain incomplete runtime checks and continue only independently verifiable source/rules while infrastructure is unavailable; no alternative fake engine substitutes for PostgreSQL races. Cost if wrong: integration fixes remain before activation.

- Task 7 native verification retry: four Playwright cases fail before assertions (same macOS MachPort permission denial); CUA inventory still reports browser host unavailable. Added the required Chromium CI job, but no remote run/push was authorized or performed. Native test-bot invitation remains gated. Ruling: an existing topic ID is recorded as unverified until actual delivery, because Bot API has no general getForumTopic; cost if wrong: binding topic may need correction before publication.

- Ruling: when a voting opening snapshot was missed through the entire ballot window, mark the round unranked instead of reconstructing eligibility from current membership — avoids hindsight and invented history; cost if wrong: a round needs explicit operator correction rather than automatic ranking. Research initially uses the published schedule with a synthetic teaching-only season; live creation requires server-owned catalog evidence and never accepts readiness flags from HTTP.

- Ruling: routine supersession retains locked versions, the frozen roster and original twelve-hour window; fresh votes must use the new identifier — preserves published deadlines and avoids silent vote transfer. Material corrections need a separately reviewed version/ballot, and never a closed-record rewrite. Cost if wrong: a broader correction workflow needs an explicit new rule version.

- Ruling: exclusive common UTC competition-week claims supplement guild-specific season uniqueness — prevents multiple guild seasons or provider-account aliases counting the same member/assets. Cost if wrong: conservative same-week exclusion may require a new division/period policy for a future product. Legacy records without complete claims are never verified automatically.

- Task 23 local verification: full verify 103 units/builds, full PG 98/98, rendered position target 2/2 at 390/1360px. [Detailed evidence](evidence/positions-midweek.md). Ruling: a Hold-only midweek confirmation is permitted only in its explicit kernel context when management capability is unavailable; opening choice requirements stay unchanged. Cost if wrong: extend that menu after actual provider validation.

- Task 26 RED→GREEN: missing kernel/services and reproduced assignment/history/label failures → 3 unit, 7 PG and 3 browser cases pass. Full verify 115 units/builds; PG 110/110. [Evidence and rulings](evidence/research-recognition.md). Ruling: member/week forecast cap spans guilds, while ordinary debate remains uncapped; cost if wrong: explicit policy-scope revision. Ruling: coordinators publish the one bounty, two rotating ordinary members decide awards; cost if wrong: revise publication authority, never participation or trade authority.

- Task 28 local operations checkpoint: missing health/flag/logging modules RED → 3 unit and 2 PG checks pass; exact snapshot restore across15 tables plus ACLs/triggers passes;36 application migrations/replay pass on a fresh generated database. Source/host/native/release gates remain disabled. Ruling: retain a host-neutral service contract until actual provider/region/cost/permission evidence selects a host — avoids inventing an unauthorized paid contract; cost if wrong: host-specific preparation remains after selection.

- Task 29 evidence ruling: record NotStarted rather than synthetic calendar pilot results — actual dual-mode lifecycle and human observations require missing access, authorization and elapsed weeks; cost if wrong: completion remains blocked, never falsely claimed.
