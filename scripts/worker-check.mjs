import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
mkdirSync(".local", { recursive: true });
await build({ entryPoints: ["worker/main.ts"], outfile: ".local/worker.mjs", platform: "node", format: "esm", packages: "external", bundle: true });
const result = spawnSync(process.execPath, [".local/worker.mjs", "--check"], { stdio: "inherit", env: { ...process.env, GW_LIVE_PREPARATION_ENABLED: "false" } });
process.exit(result.status ?? 1);
