-- Disposable loopback development database only. Never production credentials.
CREATE ROLE guild_wars_app LOGIN PASSWORD 'local_app_only' NOSUPERUSER NOCREATEDB NOCREATEROLE;
ALTER DEFAULT PRIVILEGES FOR ROLE guild_wars_migrator IN SCHEMA public GRANT SELECT, INSERT, UPDATE ON TABLES TO guild_wars_app;
GRANT USAGE ON SCHEMA public TO guild_wars_app;
