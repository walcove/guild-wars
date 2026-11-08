import { spawnSync } from 'node:child_process';
const result=spawnSync(process.execPath,['--import','tsx','scripts/migrate.ts','--test'],{stdio:'inherit',env:process.env});
process.exit(result.status??1);
