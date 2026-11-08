import {expect,it} from 'vitest';
import {canContributeResearch,requireGuildAccess} from './permissions';
it('every active member can research without reputation, captain title or wallet',()=>{
 for(const role of ['member','captain','administrator'] as const) expect(canContributeResearch({userId:'u',guildId:'g',role,status:'active'})).toBe(true);
 for(const status of ['suspended','departed'] as const) expect(canContributeResearch({userId:'u',guildId:'g',role:'member',status})).toBe(false);
 expect(canContributeResearch(null)).toBe(false);
});
it('denies forwarded cross-guild links and request-supplied identities',()=>{
 const member={userId:'u',guildId:'g',role:'member' as const,status:'active' as const};
 expect(()=>requireGuildAccess(member,'other','u')).toThrow();
 expect(()=>requireGuildAccess(member,'g','attacker')).toThrow();
 expect(requireGuildAccess(member,'g','u')).toEqual(member);
});
