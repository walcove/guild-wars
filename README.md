# Guild Wars · SOL covered calls

Local implementation of the reviewed dual-mode MVP. Website research/planning and a regular Telegram community bot share PostgreSQL services. No Mini App, pooled funds or custom options protocol.

**Not a completed or released MVP.** [Canonical implementation checklist](docs/implementation-checklist.md) records verified progress and blockers. [Provider readiness](docs/decisions/0001-live-provider.md) is Unavailable; real preparation stays disabled. No funded trading or production Telegram messages belong in local tests.

The local dependency directory was removed after repeated ENOSPC failures to preserve source and Git records. Free adequate disk before reinstalling.

Use Node 24 (`.nvmrc`), then `npm ci`, `cp .env.example .env.local`, `npm run dev`. The web app binds loopback. Run `npm run worker:dev` separately once database jobs are configured. `npm run verify` checks types, lint, unit tests, production web build and worker bundle. Integration/contracts/browser/load scripts are separate; see package.json. Do not put secrets in Git.

[Governing plan](docs/plans/2026-11-07-guild-wars-solana-mvp-implementation.md), [spec](docs/superpowers/specs/2026-11-07-guild-wars-solana-mvp-design.md), [engineering review](docs/reviews/2026-11-07-guild-wars-eng-review.md), [test plan](docs/reviews/2026-11-07-guild-wars-eng-review-test-plan.md), [design review](docs/reviews/2026-11-07-guild-wars-design-review.md), [prototype](outputs/Guild_Wars_Desktop_Mobile_Flow.html). User authorization overrides the copied plan's old root and planning-only status: application root is this repository; implementation/local development authorized, deployment and funded actions are not.
