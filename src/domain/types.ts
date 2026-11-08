import { z } from 'zod';
import { invariant } from './errors';
export type TradingMode = 'simulation' | 'live';
export type GuildRole = 'member' | 'captain' | 'administrator';
export type QuoteKind = 'executable' | 'indicative' | 'historical' | 'model';
export type ManagementAction = 'hold' | 'buy_to_close' | 'roll' | 'buy_call' | 'protective_put';
export type Custody = 'user_wallet' | 'provider_custody' | 'protocol_escrow';
export type SettlementLocation = 'solana' | 'off_chain';
export interface SourceStamp { sourceId: string; observedAt: string; receivedAt: string; synthetic: boolean }
export interface ContractTerms {
 underlying: 'SOL'; settlementCurrency: 'USDC';
 strike: { amount: string; denomination: 'USD' | 'USDC'; per: 'SOL' };
 expiresAt: string; settlement: 'physical' | 'cash'; custody: Custody; location: SettlementLocation; instrumentId: string; providerId: string;
}
export const idSchema=z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
export const utcSchema=z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/).refine(v => Number.isFinite(Date.parse(v)) && new Date(v).toISOString()===v,'Invalid UTC instant');
export const decimalSchema=z.string().max(80).regex(/^(0|[1-9]\d*)(\.\d{1,18})?$/);
export const modeSchema=z.enum(['simulation','live']);
export const quoteKindSchema=z.enum(['executable','indicative','historical','model']);
export const unitsSchema=z.string().max(80).regex(/^(0|[1-9]\d*)$/);
const contractSchema=z.object({underlying:z.literal('SOL'),settlementCurrency:z.literal('USDC'),strike:z.object({amount:decimalSchema.refine(v=>BigInt(v.replace('.',''))>0n),denomination:z.enum(['USD','USDC']),per:z.literal('SOL')}).strict(),expiresAt:utcSchema,settlement:z.enum(['physical','cash']),custody:z.enum(['user_wallet','provider_custody','protocol_escrow']),location:z.enum(['solana','off_chain']),instrumentId:idSchema,providerId:idSchema}).strict();
const sourceSchema=z.object({sourceId:idSchema,observedAt:utcSchema,receivedAt:utcSchema,synthetic:z.boolean()}).strict().refine(v=>v.observedAt<=v.receivedAt,'Observation cannot follow ingestion');
export function parseId(value: unknown): string { return idSchema.parse(value); }
export function parseUtc(value: unknown): string { return utcSchema.parse(value); }
export function parseContractTerms(value: unknown): ContractTerms { return contractSchema.parse(value); }
export function parseSource(value: unknown): SourceStamp { return sourceSchema.parse(value); }
export function assertSameMode(existing: TradingMode, incoming: TradingMode): void { invariant(existing===incoming,'mode_immutable','An existing record cannot change mode'); }
