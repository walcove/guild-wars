import {Pool} from 'pg';
import {readHealth} from '../src/server/operations/health';
import {preparationFlags} from '../src/server/operations/feature-flags';
import {executionGate} from '../src/server/providers/live-readiness';
const raw=process.env.DATABASE_URL;if(!raw)throw Error('DATABASE_URL required');const u=new URL(raw);if(!['127.0.0.1','localhost'].includes(u.hostname)||u.port!=='54329'||!['/guild_wars_test','/guild_wars_dev'].includes(u.pathname))throw Error('Local health command requires the designated loopback database');
const db=new Pool({connectionString:raw,max:1,connectionTimeoutMillis:1000,statement_timeout:3000});try{const health=await readHealth(db);console.info(JSON.stringify({...health,preparation:preparationFlags(process.env,executionGate)},null,2));process.exitCode=health.ready?0:1;}finally{await db.end();}
