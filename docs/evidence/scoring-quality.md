# Scoring and data quality evidence

Local calculations and original synthetic inputs only. No official season ranking or native four-week pilot is claimed.

Implemented exact rational 60/25/15 percentiles with tie midranks and correct return/drawdown/stress orientation. Official composites require at least five matching eligible guilds, four complete rounds, all original cohort records and at least three verified live members. Synthetic inputs remain ineligible. Missing measures remain null.

The shared hourly grid includes entry and terminal, requires at least 95% of scheduled marks and no gap above two hours. Unknown option liability produces an unavailable equity mark. Duplicate timestamps are selected by explicit source revisions; older valuation records remain append-only. Maximum drawdown comes from normalized hourly equity, including intra-round losses. A regression confirms an hourly dip is included even when an input's separate hourly array is empty.

The four independent weekly sleeve factors compound an index from 100 and carry its close flat between rounds. This is a standardized comparison, not continuous reinvested wealth. Stress uses exactly −40/−20/0/+20/+40 terminal scenarios with contract payoff/cost inputs and the worst round loss. No Sharpe annualization or probability claim is added.

`recordHourlyMark` is an internal source port with owner-scoped readers, explicit SOL/USD and USDC/USD, append-only corrections and source/data-class gates. `calculateSeasonEvidence` checks the complete original roster, source references and identical hourly/result boundary marks. There is no HTTP equity/score import. The configured complete comparison reader is unavailable until permitted normalized/cohort results and hourly option sources exist. Current season pages publish provisional reasons and unavailable raw measures. A future approved reader can supply raw comparison evidence; official cross-guild publication still requires verified division and consent evidence. Gate 0 is not bypassed.

Score revisions are append-only, hash-bound to source references, metrics, division, period and rules; prior revisions have authenticated audit links. A changed source reference creates a new revision rather than silently changing history.

Verified commands:

- Kernel RED (module absent) → 5/5 unit tests.
- Service RED → final PostgreSQL target 3/3, including correction/audit immutability and an hourly-dip regression.
- `npm run verify`: 112 unit cases, TypeScript, lint and web/worker builds pass.
- Full PostgreSQL integration: 103/103; contracts: 18/18.

Logs are `.local/task25-*`. Rendered leaderboard recovery is included in the final journey exercise. Actual permitted option marks, verified matching five-guild publication and an elapsed four-week native pilot are not supplied by these synthetic tests.
