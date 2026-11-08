export function requireTestDatabaseUrl(raw: string | undefined): string {
 if(!raw) throw new Error('TEST_DATABASE_URL is required for real PostgreSQL integration checks');
 const u=new URL(raw);
 if(!['postgres:','postgresql:'].includes(u.protocol) || !['127.0.0.1','localhost','[::1]'].includes(u.hostname) || u.pathname!=='/guild_wars_test' || u.port!=='54329' || u.username!=='guild_wars_migrator' || u.search || u.hash) throw new Error('Refusing migration: only the designated loopback guild_wars_test database and migrator role are allowed');
 return raw;
}
