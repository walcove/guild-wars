import { invariant } from './errors';
import type { GuildRole } from './types';
export interface Membership {userId:string;guildId:string;role:GuildRole;status:'active'|'suspended'|'departed'}
export function canContributeResearch(member:Membership|null):boolean { return member?.status==='active'; }
export function requireGuildAccess(member:Membership|null,guildId:string,authenticatedUserId:string):Membership {
 invariant(member && member.guildId===guildId && member.userId===authenticatedUserId && member.status==='active','forbidden','Active membership in this guild is required');return member;
}
