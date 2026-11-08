import {Pool} from 'pg';
import {runMigrations} from 'graphile-worker';
import {requireTestDatabaseUrl} from '../src/server/db/test-target';
import {observePool} from '../src/server/db/client';
const db=observePool(new Pool({connectionString:requireTestDatabaseUrl(process.env.TEST_DATABASE_URL),max:1}),'worker-migration');
try {
 await runMigrations({pgPool:db});
 await db.query(`
 DO $$ BEGIN IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='guild_wars_worker') THEN CREATE ROLE guild_wars_worker LOGIN PASSWORD 'local_worker_only' NOSUPERUSER NOCREATEDB NOCREATEROLE; END IF; END $$;
 GRANT USAGE ON SCHEMA public TO guild_wars_worker;
 GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA public TO guild_wars_worker;
 ALTER DEFAULT PRIVILEGES FOR ROLE guild_wars_migrator IN SCHEMA public GRANT SELECT,INSERT,UPDATE ON TABLES TO guild_wars_worker;
 -- Documented ownership adjustment for Graphile's runtime role, never application data rewrites.
 ALTER SCHEMA graphile_worker OWNER TO guild_wars_worker;
 DO $$ DECLARE r record; BEGIN FOR r IN SELECT c.oid::regclass AS name,c.relkind FROM pg_class c WHERE c.relnamespace='graphile_worker'::regnamespace AND c.relkind IN ('r','S','v') LOOP
  EXECUTE format('ALTER %s %s OWNER TO guild_wars_worker',CASE WHEN r.relkind='S' THEN 'SEQUENCE' WHEN r.relkind='v' THEN 'VIEW' ELSE 'TABLE' END,r.name);
 END LOOP; END $$;
 REVOKE ALL ON ALL TABLES IN SCHEMA graphile_worker FROM guild_wars_app;
 REVOKE ALL ON ALL SEQUENCES IN SCHEMA graphile_worker FROM guild_wars_app;
 REVOKE USAGE ON SCHEMA graphile_worker FROM guild_wars_app;
 CREATE OR REPLACE FUNCTION public.gw_enqueue_job(p_task text,p_payload json,p_queue text,p_run_at timestamptz,p_attempts smallint,p_key text,p_priority smallint) RETURNS bigint
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,graphile_worker AS $$ BEGIN
  IF p_task NOT IN ('close_ballot','recover_due','capture_quote','midweek_notice','reconcile_settlement','resolve_research','deliver_telegram','telegram_command') OR p_queue NOT IN ('guild-critical','guild-background-0','guild-background-1','guild-background-2') OR p_attempts NOT BETWEEN 1 AND 5 OR octet_length(p_payload::text)>65536 OR length(p_key)>256 THEN RAISE EXCEPTION 'Invalid application job'; END IF;
  RETURN (graphile_worker.add_job(identifier=>p_task,payload=>p_payload,queue_name=>p_queue,run_at=>p_run_at,max_attempts=>p_attempts,job_key=>p_key,priority=>p_priority,job_key_mode=>'replace')).id;
 END $$;
 ALTER FUNCTION public.gw_enqueue_job(text,json,text,timestamptz,smallint,text,smallint) OWNER TO guild_wars_worker;
 REVOKE ALL ON FUNCTION public.gw_enqueue_job(text,json,text,timestamptz,smallint,text,smallint) FROM PUBLIC;
 GRANT EXECUTE ON FUNCTION public.gw_enqueue_job(text,json,text,timestamptz,smallint,text,smallint) TO guild_wars_app,guild_wars_worker;
 `);
 console.info('Graphile Worker migrations, scoped worker ownership and web enqueue wrapper applied');
} finally{await db.end();}
