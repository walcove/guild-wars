import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { requireTestDatabaseUrl } from '../src/server/db/test-target';
const test=process.argv.includes('--test');
const connectionString=test?requireTestDatabaseUrl(process.env.TEST_DATABASE_URL):process.env.MIGRATION_DATABASE_URL;
if(!test) {
 if(!connectionString) throw new Error('MIGRATION_DATABASE_URL is required');
 const u=new URL(connectionString);
 if(!['127.0.0.1','localhost'].includes(u.hostname)||u.pathname!=='/guild_wars_dev'||u.username!=='guild_wars_migrator'||u.search||u.hash) throw new Error('Local development migrations require a loopback guild_wars_dev database and migrator role');
}
const pool=new Pool({connectionString,max:1});
try { await migrate(drizzle(pool),{migrationsFolder:'drizzle'});console.info('Application migrations applied'); }
finally {await pool.end();}
