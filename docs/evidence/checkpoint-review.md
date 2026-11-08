# Partial implementation checkpoint review

2026-11-07. Fresh-context, read-only native reviewer inspected source through `30eb6c8`; no external provider or cross-model consensus is claimed. The reviewed checkpoint is explicitly incomplete and disabled, with no exposed funded-action path. The review is not release clearance.

| Finding | Response | Evidence / remaining gate |
| --- | --- | --- |
| Important: intent/sleeve/account/cohort owners may disagree | Added composite FKs for owner, account and cohort season; sleeve explicitly records season matched to round | Drizzle migration 0002 generated; relevant schema/provider/test TypeScript compilation passes. Negative real-PG cases authored; PostgreSQL execution unavailable, so not verified fixed at runtime. |
| Important: reservation account/mode may contradict intent | Added composite reservation → intent/account/mode FK | Same unverified migration/runtime gate. |
| Important: provider approval not bound to adapter/quote | Added LiveAdapter providerId and expected round provider in quote policy, enforced equality | Two new regressions observed failing before fix, then passing. Whole unit suite 45/45; contract suite 3/3. |
| Minor: research note proposal version lacks tenant FK | Deferred; attachment services are not implemented/enabled | Required before research attachment work. |
| Minor: authored browser suite absent from CI | Deferred; rendered browser/runtime gates remain pending | Add browser job when browser/runtime checks are restored. |

The generated migration added foreign keys before their new referenced unique keys; reordered 0002 to establish the unique constraints first. Snapshot/journal remain generated. Migrations have never been applied locally; no verified database result is asserted.

After repeated disk exhaustion, a temporary isolated 137-package verification toolset was installed under ignored `.local/check-tools`, without changing the application manifest/lockfile. Its disposable npm cache was removed after ENOSPC recurred. Used the same pinned Vitest, Zod, Drizzle and React versions to run all unit/contracts and the schema/provider/test compilation. Full application dependencies still need a clean npm ci after stable disk capacity is restored. No new full Next build, browser run, database pass, deployment, remote or financial action is claimed.
