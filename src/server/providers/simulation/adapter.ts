import {invariant} from '../../../domain/errors';
import type {SimulationAdapter,VerifiedExecutionEvent} from '../contracts';
import {virtualFill,type SimulationOpening} from './fill-policy';
export class DeterministicSimulationAdapter implements SimulationAdapter {
 readonly mode='simulation' as const;private readonly opening:SimulationOpening;
 constructor(opening:SimulationOpening){virtualFill(opening);this.opening=structuredClone(opening);}
 async listInstruments(){return [structuredClone(this.opening.quote.terms)];}
 async quote(){return structuredClone(this.opening.quote);}
 async bookVirtual(intentId:string):Promise<VerifiedExecutionEvent[]>{invariant(/^[A-Za-z0-9_-]{1,128}$/.test(intentId),'intent','Invalid virtual intent');const fill=virtualFill(this.opening),base={mode:this.mode,providerId:'simulator',accountId:'virtual-'+intentId,observedAt:this.opening.bookingAt,receivedAt:this.opening.bookingAt,revision:'1',source:fill.quote.source},externalOrderId='virtual-'+intentId;return [{...base,kind:'fill',externalEventId:'virtual-fill-'+intentId,externalOrderId,externalFillId:'virtual-fill-'+intentId,instrumentId:fill.quote.terms.instrumentId,quantityLamports:fill.coveredLamports,premiumUsdcMicros:fill.quote.grossPremiumUsdcMicros,filledAt:this.opening.bookingAt,fingerprint:JSON.stringify(fill.quote)},{...base,kind:'position',externalEventId:'virtual-position-'+intentId,externalPositionId:'virtual-position-'+intentId,instrumentId:fill.quote.terms.instrumentId,coveredLamports:fill.coveredLamports,state:'open'},...fill.quote.fees.map((fee,i)=>({...base,kind:'fee' as const,externalEventId:`virtual-fee-${intentId}-${i}`,currency:fee.currency,units:fee.units,externalFillId:'virtual-fill-'+intentId}))];}
 async reconcile():Promise<VerifiedExecutionEvent[]>{return [];}
}
