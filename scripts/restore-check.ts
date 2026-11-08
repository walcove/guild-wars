import {Pool} from 'pg';
import {randomUUID,createHash} from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import {mkdir,open,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {requireTestDatabaseUrl} from '../src/server/db/test-target';
const source=requireTestDatabaseUrl(process.env.TEST_DATABASE_URL),container='guild-wars-mvp-postgres-1',name='guild_wars_restore_'+randomUUID().replaceAll('-','').slice(0,16),directory=resolve('.local/restore',name);
const inspect=spawnSync('docker',['inspect',container,'--format','{{json .Config.Labels}}'],{encoding:'utf8'});if(inspect.status!==0)throw Error('Owned local PostgreSQL container unavailable');const labels=JSON.parse(inspect.stdout);if(labels['com.docker.compose.project']!=='guild-wars-mvp'||labels['com.docker.compose.service']!=='postgres')throw Error('Restore check requires the repository-owned local PostgreSQL container');
await mkdir(directory,{recursive:true,mode:0o700});
const db=new Pool({connectionString:source,max:1}),client=await db.connect();let restored:Pool|undefined;
const tables=['ledger_events','fills','provider_observations','order_intents','reservations','positions','ballots','votes','round_roster','ballot_roster','membership_history','result_snapshots','score_revisions','audit_events','operations'];
async function fingerprints(pool:Pick<Pool,'query'>|typeof client){const result:Record<string,unknown>={};for(const t of tables)result[t]=(await pool.query(`SELECT count(*)::int count,md5(coalesce(string_agg(row_to_json(t)::text,E'\n' ORDER BY row_to_json(t)::text),'')) hash FROM ${t} t`)).rows[0];return result;}
async function processFile(args:string[],path:string,direction:'dump'|'restore'){
 const file=await open(path,direction==='dump'?'wx':'r',0o600);try{await new Promise<void>((done,reject)=>{const child=spawn('docker',args,{stdio:direction==='dump'?['ignore',file.fd,'pipe']:[file.fd,'ignore','pipe']});let error='';child.stderr!.on('data',chunk=>{error+=String(chunk);});child.once('error',reject);child.once('exit',code=>code===0?done():reject(Error('Local '+direction+' failed: '+error.slice(0,1000))));});}finally{await file.close();}
}
try{
 await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');const snapshot=(await client.query('SELECT pg_export_snapshot() snapshot')).rows[0].snapshot,expected=await fingerprints(client),dump=resolve(directory,'synthetic.dump');
 await processFile(['exec',container,'pg_dump','-U','guild_wars_migrator','-d','guild_wars_test','--format=custom','--snapshot='+snapshot],dump,'dump');await client.query('COMMIT');
 // A generated, previously absent name only. Never drop/replace the source or an existing database.
 await client.query(`CREATE DATABASE "${name}" OWNER guild_wars_migrator`);
 await processFile(['exec','-i',container,'pg_restore','-U','guild_wars_migrator','--exit-on-error','--dbname='+name],dump,'restore');
 const u=new URL(source);u.pathname='/'+name;restored=new Pool({connectionString:u.toString(),max:1});const actual=await fingerprints(restored);if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error('Restored record fingerprints differ');
 const permissions=(await restored.query(`SELECT has_table_privilege('guild_wars_app','membership_history','INSERT') history_write,has_table_privilege('guild_wars_app','worker_health','UPDATE') health_write,has_schema_privilege('guild_wars_app','graphile_worker','USAGE') queue_access,(SELECT pg_get_userbyid(nspowner)='guild_wars_worker' FROM pg_namespace WHERE nspname='graphile_worker') queue_owner`)).rows[0];if(permissions.history_write||permissions.health_write||permissions.queue_access||!permissions.queue_owner)throw Error('Restored role boundaries differ');
 const appendOnly=(await restored.query("SELECT count(*)::int n FROM pg_trigger WHERE NOT tgisinternal AND tgname='append_only'")).rows[0].n;if(appendOnly<10)throw Error('Restored append-only constraints unavailable');
 const report={evidence:'Original synthetic local database only; no external provider, production bot or funded state',database:name,dumpSha256:createHash('sha256').update(await readFile(dump)).digest('hex'),tables:actual,permissions,appendOnlyTriggers:appendOnly,limitations:'Same-cluster local PostgreSQL restore with pre-existing disposable roles. Not managed-host failover, PITR, external-side-effect rollback or production RPO/RTO evidence. Restored database and protected local dump retained for inspection.'};await writeFile(resolve(directory,'report.json'),JSON.stringify(report,null,2)+'\n',{mode:0o600});console.info(JSON.stringify({restored:true,database:name,tables:tables.length,report:resolve(directory,'report.json')}));
}catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}finally{client.release();await restored?.end();await db.end();}
