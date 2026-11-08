import {createHash} from 'node:crypto';
import {z} from 'zod';
import {parseSource,parseUtc,modeSchema,unitsSchema} from '../../../domain/types';
import {canonicalJson} from '../../../domain/proposals';
import type {VerifiedExecutionEvent} from '../contracts';
const ref=z.string().min(1).max(256).refine(s=>!/[\0\r\n]/.test(s));
const signed=z.string().max(80).regex(/^-?(0|[1-9]\d*)$/);
const base={mode:modeSchema,providerId:ref,accountId:ref,externalEventId:ref,observedAt:z.string(),receivedAt:z.string(),revision:z.string().min(1).max(128),source:z.unknown()};
const eventSchema=z.discriminatedUnion('kind',[
 z.object({...base,kind:z.literal('order'),externalOrderId:ref,state:z.enum(['submitted','pending_confirmation','rejected','cancelled','unknown'])}).strict(),
 z.object({...base,kind:z.literal('fill'),externalOrderId:ref,externalFillId:ref,instrumentId:ref,quantityLamports:unitsSchema,premiumUsdcMicros:unitsSchema,filledAt:z.string().nullable(),fingerprint:ref}).strict(),
 z.object({...base,kind:z.literal('fee'),currency:z.enum(['SOL','USDC']),units:unitsSchema,externalFillId:ref}).strict(),
 z.object({...base,kind:z.literal('position'),externalPositionId:ref,instrumentId:ref,coveredLamports:unitsSchema,state:z.enum(['open','expired','settlement_pending','settled'])}).strict(),
 z.object({...base,kind:z.literal('settlement'),externalPositionId:ref,assetDeltaLamports:signed,cashDeltaUsdcMicros:signed,state:z.enum(['pending','claimable','settled','withdrawn'])}).strict(),
]);
export type RecordFinality='fixture'|'provider_final'|'solana_confirmed'|'solana_finalized';
export interface ProviderObservation {event:VerifiedExecutionEvent;correctsRevision:string|null;finality:RecordFinality}
export function parseProviderObservation(raw:unknown):ProviderObservation{const p=z.object({event:eventSchema,correctsRevision:z.string().min(1).max(128).nullable(),finality:z.enum(['fixture','provider_final','solana_confirmed','solana_finalized'])}).strict().parse(raw);parseUtc(p.event.observedAt);parseUtc(p.event.receivedAt);if(p.event.kind==='fill'&&p.event.filledAt)parseUtc(p.event.filledAt);return {...p,event:{...p.event,source:parseSource(p.event.source)}};}
export function eventFingerprint(event:VerifiedExecutionEvent):string{
 const data={...event} as Record<string,unknown>;delete data.source;delete data.observedAt;delete data.receivedAt;delete data.fingerprint;delete data.externalEventId;delete data.revision;return createHash('sha256').update(canonicalJson(data)).digest('hex');
}
// These are internal normalized contracts only. No selected-provider API/SDK is implemented here.
