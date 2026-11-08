GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO guild_wars_app;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES FOR ROLE guild_wars_migrator IN SCHEMA public GRANT USAGE ON SEQUENCES TO guild_wars_app;
--> statement-breakpoint
DO $$ BEGIN IF EXISTS(SELECT FROM pg_roles WHERE rolname='guild_wars_worker') THEN
 GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO guild_wars_worker;
 ALTER DEFAULT PRIVILEGES FOR ROLE guild_wars_migrator IN SCHEMA public GRANT USAGE ON SEQUENCES TO guild_wars_worker;
END IF; END $$;
