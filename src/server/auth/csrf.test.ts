import {expect,it} from 'vitest';
import {assertCsrf} from './csrf';
import {opaqueToken,tokenHash} from './crypto';
import {safeReturnPath} from './link-challenges';
it('rejects login CSRF even when another origin knows a valid token',()=>{
 const token=opaqueToken(),hash=tokenHash(token);
 expect(()=>assertCsrf('https://guild.example','https://guild.example',token,hash)).not.toThrow();
 for(const [origin,value] of [['https://evil.example',token],[null,token],['https://guild.example',opaqueToken()],['https://guild.example',null]])expect(()=>assertCsrf(origin,'https://guild.example',value,hash)).toThrow();
});
it('preserves opaque exact-version context while refusing redirects and path traversal',()=>{
 expect(safeReturnPath('/proposals/plan-1?version=v1&origin=opaque')).toBe('/proposals/plan-1?version=v1&origin=opaque');
 for(const path of ['https://evil.example','//evil.example','/proposals/../guilds','/%2f%2fevil','/proposals/x?secret=private-text'])expect(()=>safeReturnPath(path)).toThrow();
});

it('preserves only a known hypothetical plan selection on the outcomes return path',()=>{expect(safeReturnPath('/guilds/g/rounds/r/outcomes?plan=hold')).toBe('/guilds/g/rounds/r/outcomes?plan=hold');expect(()=>safeReturnPath('/guilds/g?plan=hold')).toThrow();expect(()=>safeReturnPath('/guilds/g/rounds/r/outcomes?plan=live')).toThrow();});
