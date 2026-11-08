import {invariant} from '../../domain/errors';
import {parseSource,type SourceStamp} from '../../domain/types';
interface SourceGrant {sourceIds:readonly string[];uses:readonly ('simulation'|'live'|'research')[];display:boolean;retain:boolean;derive:boolean;aggregateDisplay:boolean}
// Reviewed source contracts only. Neither env/client booleans nor a claimed reference creates permission.
// No data contract has passed Task 0; real derived-source ingestion therefore remains disabled.
const approvedGrants:Readonly<Record<string,SourceGrant>>=Object.freeze({});
export function assertPermittedDerivedSources(reference:string|null,sources:readonly SourceStamp[],use:'simulation'|'live'|'research'):void {const grant=reference?approvedGrants[reference]:undefined;for(const source of sources)parseSource(source);invariant(grant&&grant.display&&grant.retain&&grant.derive&&grant.uses.includes(use)&&sources.length>0&&sources.every(s=>!s.synthetic&&grant.sourceIds.includes(s.sourceId)),'source_rights','No reviewed permission covers these non-synthetic source records, display, retention and derived use');}

export function assertAggregatePublicationRights(reference:string|null,sources:readonly SourceStamp[],use:'simulation'|'live'):void{
 assertPermittedDerivedSources(reference,sources,use);invariant(reference&&approvedGrants[reference]?.aggregateDisplay===true,'source_rights','Reviewed permission for cross-guild aggregate publication is required');
}
