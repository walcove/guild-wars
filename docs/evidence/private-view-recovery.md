# Private view and source-boundary recovery

Task 27 regressions, local synthetic data only.

A private server-rendered view now waits for a fresh owner/access check. The same boundary surrounds contextual guild data and initial/fallback props, not only SWR results. Account changes, cross-tab changes, access loss and page lifecycle interruptions hide the content and abort/discard late identity responses. A read-only identity endpoint checks current session and optional active guild scope without rotating CSRF or bootstrapping a guest. Owner financial records intentionally use owner scope, preserving access after guild departure. Offline invalidation keeps an explicit hidden/reload state instead of trying a failing router refresh.

Tests: two missing-component REDs → 2 unit passes; cache/draft invalidation tests also pass. The actual offline browser regression initially had no usable recovery state. It now removes the position immediately and renders “Private content hidden” with a reload action (1/1 target passes). The two normal position/departure browser cases also passed with the new boundary before that final offline adjustment. Full rendered regression is part of the final Task 27 gate.

Two reproduced PostgreSQL cases showed that a simulation writer could label synthetic result/hourly inputs as permitted reference. Writers now require an approved, source-specific derived-use grant for non-synthetic display, retention and calculation; a claimed reference string cannot grant permission. The approved grant registry is empty because Task 0 permissions are unavailable. Research outcome sources use the same permission boundary. Synthetic source data remains teaching-only. The three affected service suites pass 14/14 after the fix.

`npm run verify` after these changes passes 117 unit cases, TypeScript, lint, web build and worker check. No new external access, approval, live adapter or funding capability was added. Logs: `.local/task27-private-*` and `.local/task27-source-class-*`.

## Late session-status response regression

Two actual HTTP browser cases reproduced authentication-cookie writes on status reads, including a revoked old session replacing a newer authenticated browser with a guest. A valid status read now never echoes the authentication cookie. An invalid-session GET returns 401 without creating a guest or writing that cookie. Only an explicit same-origin restart creates a guest, and a valid newer session is retained. The connection screen can restart an expired browser while keeping the exact destination and clearing old private state.

Both browser regressions pass. The additional connection component recovery case passes (3/3 target); `npm run verify` now passes 118 units plus TS/lint/web/worker builds. Test assertions report booleans rather than cookie values. Logs: `.local/task27-session-*`.
