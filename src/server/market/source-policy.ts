import {invariant} from '../../domain/errors';
import readiness from './readiness.json';
export interface MarketRights {approved:boolean;reference:string|null;tier:'pro'|'demo'|null;display:boolean;freshSeconds:number;staleSeconds:number;retentionSeconds:number;attribution:string;maxDays:number}
export const configuredMarketRights:MarketRights=readiness as MarketRights;
export function assertMarketRights(rights:MarketRights):void {
 invariant(rights.approved&&rights.display&&rights.reference&&rights.reference.length>=4&&['pro','demo'].includes(rights.tier??''),'market_rights_unavailable','SOL history is unavailable until display and cache rights are verified');
 invariant([rights.freshSeconds,rights.staleSeconds,rights.retentionSeconds,rights.maxDays].every(Number.isSafeInteger)&&rights.freshSeconds>=1&&rights.staleSeconds>=rights.freshSeconds&&rights.retentionSeconds>=rights.staleSeconds+60&&rights.retentionSeconds<=86400&&rights.maxDays>=1&&rights.maxDays<=365&&rights.attribution.length>0,'market_rights_unavailable','The reviewed data plan must specify bounded freshness, retention and attribution');
}
