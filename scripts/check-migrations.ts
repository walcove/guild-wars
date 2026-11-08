import {Pool} from 'pg';
import {randomUUID} from 'node:crypto';
import {drizzle} from 'drizzle-orm/node-postgres';
import {migrate} from 'drizzle-orm/node-postgres/migrator';
import {readFile,writeFile} from 'node:fs/promises';
import {requireTestDatabaseUrl} from '../src/server/db/test-target';
const source=requireTestDatabaseUrl(process.env.TEST_DATABASE_URL),admin=new Pool({connectionString:source,max:1}),name='guild_wars_migrations_'+randomUUID().replaceAll('-','').slice(0,16);let target:Pool|undefined;
try{
 await admin.query(`CREATE DATABASE "${name}" OWNER guild_wars_migrator`);const u=new URL(source);u.pathname='/'+name;target=new Pool({connectionString:u.toString(),max:1});
 await target.query('GRANT USAGE ON SCHEMA public TO guild_wars_app; ALTER DEFAULT PRIVILEGES FOR ROLE guild_wars_migrator IN SCHEMA public GRANT SELECT,INSERT,UPDATE ON TABLES TO guild_wars_app;');
 await migrate(drizzle(target),{migrationsFolder:'drizzle'});await migrate(drizzle(target),{migrationsFolder:'drizzle'});
 const expected=JSON.parse(await readFile('drizzle/meta/_journal.json','utf8')).entries.length,actual=(await target.query('SELECT count(*)::int n FROM drizzle.__drizzle_migrations')).rows[0].n;if(expected!==actual)throw Error('Migration journal differs');
 const checks=(await target.query("SELECT has_table_privilege('guild_wars_app','membership_history','INSERT') history_write,has_table_privilege('guild_wars_app','worker_health','UPDATE') health_write,has_table_privilege('guild_wars_app','memberships','UPDATE') membership_write")).rows[0];if(checks.history_write||checks.health_write||!checks.membership_write)throw Error('Fresh schema role boundaries differ');
 const report={evidence:'Fresh generated local database; all application migrations and idempotent replay; existing disposable cluster roles only',database:name,migrations:actual,checks,limitations:'Worker setup/ownership is separately tested by integration and restore. Managed cluster/production role installation remains unverified.'};await writeFile('.local/fresh-migrations-report.json',JSON.stringify(report,null,2)+'\n');console.info(JSON.stringify(report));
}finally{await target?.end();await admin.end();}
