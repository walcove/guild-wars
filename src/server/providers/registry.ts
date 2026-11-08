import {preparationFlags} from '../operations/feature-flags';
import type {LiveAdapter,SimulationAdapter} from './contracts';
import type {TradingMode} from '../../domain/types';
import {invariant} from '../../domain/errors';
export interface ProviderGate {gate0Passed:boolean;releaseApproved:boolean;providerId:string|null}
export function simulationAdapter(round:{mode:TradingMode},adapter:SimulationAdapter):SimulationAdapter {
 invariant(round.mode==='simulation'&&adapter.mode==='simulation','mode','Only a simulation round can book virtual positions');return adapter;
}
export function liveAdapter(round:{mode:TradingMode},adapter:LiveAdapter|null,gate:ProviderGate):LiveAdapter {
 invariant(round.mode==='live','mode','Live adapter requires a live round');
 invariant(preparationFlags(process.env,gate).newLivePreparation&&adapter?.mode==='live','live_unavailable','Live preparation is disabled until provider and release gates pass');
 invariant(adapter.providerId===gate.providerId,'provider_mismatch','Approved provider does not match this adapter');return adapter;
}
