# 0003 · Dependency compatibility

Verified registry manifests and official starter instructions on 2026-11-07. [Official frontend guidance](https://solana.com/docs/frontend), [starter](https://github.com/solana-foundation/templates/tree/4ff31d8aa6a464acc4b7f4b88ba512b819500f6c/kit/nextjs), [scaffolder](https://github.com/solana-developers/create-solana-dapp). create-solana-dapp 4.8.5; template revision `4ff31d8aa6a464acc4b7f4b88ba512b819500f6c`.

Node 24.11.1 / npm 11.6.2. Scaffold used `--skip-install --skip-git --skip-init`; dependencies were reviewed, demo transfer/mint/network controls and their tests removed. Required optional wallet boundary will use supported Kit plugins and Wallet Standard, not the obsolete Framework Kit defaults in the general Solana skill.

| Package | Exact version |
| --- | --- |
| `@solana/kit` | 8.5.0 |
| `@solana/kit-plugin-rpc` | 0.19.0 |
| `@solana/kit-plugin-wallet` | 0.20.0 |
| `@solana/react` | 8.5.0 |
| `next` | 16.4.3 |
| `react` | 19.2.8 |
| `react-dom` | 19.2.8 |
| `swr` | 2.5.1 |
| `grammy` | 1.46.0 |
| `drizzle-orm` | 0.45.4 |
| `pg` | 8.23.1 |
| `graphile-worker` | 0.18.0 |
| `zod` | 4.6.7 |
| `lightweight-charts` | 5.2.1 |
| `@fontsource/bodoni-moda` | 5.3.0 |
| `@fontsource/hanken-grotesk` | 5.3.0 |
| `@fontsource/jetbrains-mono` | 5.3.0 |
| `@tailwindcss/postcss` | 4.3.5 |
| `@testing-library/dom` | 10.4.2 |
| `@testing-library/react` | 16.3.3 |
| `@types/node` | 24.10.1 |
| `@types/react` | 19.3.0 |
| `@types/react-dom` | 19.3.0 |
| `@wallet-standard/wallet` | 1.1.1 |
| `eslint` | 9.39.5 |
| `eslint-config-next` | 16.4.3 |
| `jsdom` | 26.1.0 |
| `prettier` | 3.9.10 |
| `tailwindcss` | 4.3.5 |
| `typescript` | 5.9.3 |
| `vitest` | 4.1.12 |
| `@playwright/test` | 1.65.0 |
| `@testing-library/jest-dom` | 7.0.1 |
| `@types/pg` | 8.23.1 |
| `drizzle-kit` | 0.31.11 |
| `tsx` | 4.23.15 |
| `esbuild` | 0.28.2 |

Peer checks: wallet 0.20.0 requires React ^19.2.8, Kit/React ^8.2.0; RPC 0.19.0 requires Kit ^8.2.0; @solana/react 8.5.0 requires Kit ^8.5.0, React >=18, SWR ^2.5.1 and TanStack Query ^5.103.1 (resolved in lockfile). Do not independently upgrade wallet plugins. Next ESLint config is aligned to Next 16.4.3.

Local install initially exhausted disk in npm metadata cache. Recovery: resolve lockfile without extracting packages, discard only the task-owned disposable cache, then run frozen `npm ci`. No unrelated files or machine ownership were changed. Verification results are in the canonical checklist.

npm 11.6.2 repeatedly generated a lockfile missing the root WASI optional peer. Regenerating with official npm 11.21.2 (`npx --yes npm@11.21.2 install --package-lock-only --ignore-scripts`) fixed the frozen-install check; subsequent `npm ci` installed 621 packages. No global npm installation was changed.

Local Next Turbopack development failed to start its FSEvent stream under this sandbox. Development uses supported Webpack polling. Production Turbopack build passes. Playwright Chromium process launch is denied by macOS MachPort sandbox permission; the CUA inventory separately reports browser access host unavailable. Rendered four-width checks remain pending, not passing.
