import {tokenHash} from '../auth/crypto';
import {classifyFillTime} from '../../domain/reconciliation';
import type {Tx} from '../db/client';
import {cohortQuality,type CohortQualityMember} from '../../domain/cohort-quality';
// Internal projection: no native/provider gate is enabled by evaluating these existing records.
export async function readCohortQualityInTx(tx:Tx,seasonId:string,roundId:string){
 const rows=(await tx.query(`SELECT c.id,c.consents,reg.id registration_id,s.id sleeve_id,a.revoked_at,a.read_authorization_ref,
 EXISTS(SELECT FROM cohort_verification_events e WHERE e.registration_id=reg.id AND e.kind='deviation') deviation,
 (SELECT count(*)::int FROM order_intents i WHERE i.sleeve_id=s.id AND i.state NOT IN ('declined','rejected','cancelled') AND coalesce((i.review->>'matchesGuildPlan')::boolean,false)=false) unmatched,
 (SELECT count(*)::int FROM reconciliation_issues x JOIN order_intents i ON i.id=x.intent_id WHERE i.sleeve_id=s.id AND NOT EXISTS(SELECT FROM reconciliation_resolutions rr WHERE rr.issue_id=x.id)) unresolved,
 coalesce((SELECT jsonb_agg(o.record->'event') FROM fills f JOIN order_intents i ON i.id=f.intent_id LEFT JOIN LATERAL(SELECT record FROM operations op WHERE op.kind='provider_effect' AND op.record->>'intentId'=i.id::text AND op.record#>>'{event,kind}'='fill' AND op.record#>>'{event,externalFillId}'=f.external_fill_id) o ON true WHERE i.sleeve_id=s.id),'[]') timings,
 (SELECT e.record FROM cohort_verification_events e WHERE e.registration_id=reg.id AND e.kind='round_start_verified' ORDER BY e.created_at DESC,e.id DESC LIMIT 1) start_proof,
 reg.record registration_record,r.schedule
 FROM cohort_members c JOIN rounds r ON r.id=$2 AND r.season_id=c.season_id
 LEFT JOIN live_sleeve_registrations reg ON reg.cohort_member_id=c.id AND reg.round_id=r.id
 LEFT JOIN sleeves s ON s.cohort_member_id=c.id AND s.round_id=r.id
 LEFT JOIN provider_accounts a ON a.id=reg.account_id WHERE c.season_id=$1 ORDER BY c.id LIMIT 101`,[seasonId,roundId])).rows;
 const facts:CohortQualityMember[]=rows.map(r=>{const proof=r.start_proof??r.registration_record?.readEvidence,at=proof?.source?.observedAt,open=r.schedule.voteClose,timely=typeof at==='string'&&typeof open==='string'&&Date.parse(at)<=Date.parse(open)&&Date.parse(open)-Date.parse(at)<=60000;return {id:r.id,registered:!!r.registration_id&&!!r.sleeve_id,startingHoldingsVerified:!!proof&&proof.status==='verified'&&proof.source?.synthetic===false&&proof.ownershipVerified===true&&proof.segregatedSleeve===true&&proof.readCredentialHash===tokenHash(r.read_authorization_ref??'')&&timely,currentReadConsent:r.consents.readAccess===true&&!r.revoked_at&&!!r.read_authorization_ref,aggregateConsent:r.consents.aggregateResults===true,sourcePermitted:r.consents.dataClass==='provider_read',deviation:r.deviation,unmatchedOrders:r.unmatched,unresolvedIssues:r.unresolved,fillTiming:r.timings.map((e:{filledAt:string|null;receivedAt:string}|null)=>{try{return e?classifyFillTime(e.filledAt,e.receivedAt,{opensAt:r.schedule.voteClose,closesAt:r.schedule.executionClose}):'unverifiable';}catch{return 'unverifiable';}})};});
 return cohortQuality(rows.map(r=>r.id),facts);
}
