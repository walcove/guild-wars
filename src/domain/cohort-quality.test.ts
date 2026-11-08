import {it,expect} from 'vitest';
import {cohortQuality,type CohortQualityMember} from './cohort-quality';
const member=(id:string):CohortQualityMember=>({id,registered:true,startingHoldingsVerified:true,currentReadConsent:true,aggregateConsent:true,sourcePermitted:true,deviation:false,unmatchedOrders:0,unresolvedIssues:0,fillTiming:['in_window']});
it('retains all original members but makes a matched cohort provisional for deviations, discrepancies, unmatched plans or late/unknown fills',()=>{
 const original=['a','b','c'],base=original.map(member);expect(cohortQuality(original,base).eligible).toBe(true);
 for(const patch of [{deviation:true},{unresolvedIssues:1},{unmatchedOrders:1},{fillTiming:['late']},{fillTiming:['unverifiable']},{startingHoldingsVerified:false},{currentReadConsent:false},{aggregateConsent:false}]){const r=cohortQuality(original,[base[0],{...base[1],...patch},base[2]]);expect(r.eligible).toBe(false);expect(r.memberIds).toEqual(original);expect(r.reasons.length).toBeGreaterThan(0);}
 expect(cohortQuality(original,base.slice(0,2)).eligible).toBe(false);
});
