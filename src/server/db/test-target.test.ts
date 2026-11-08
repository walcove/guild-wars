import {expect,it} from 'vitest';
import {requireTestDatabaseUrl} from './test-target';
it.each([undefined,'postgresql://guild_wars_migrator:x@production.example:54329/guild_wars_test','postgresql://guild_wars_migrator:x@127.0.0.1:54329/production','postgresql://guild_wars_app:x@127.0.0.1:54329/guild_wars_test','postgresql://guild_wars_migrator:x@127.0.0.1:54329/guild_wars_test?host=production.example'])('rejects unsafe test target %s',value=>expect(()=>requireTestDatabaseUrl(value)).toThrow());
it('accepts the explicit dedicated test database',()=>{const value='postgresql://guild_wars_migrator:x@127.0.0.1:54329/guild_wars_test';expect(requireTestDatabaseUrl(value)).toBe(value);});
