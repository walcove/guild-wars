import type {ProviderGate} from '../providers/registry';
export function preparationFlags(env:Record<string,string|undefined>,gate:ProviderGate){
 const paused=env.GW_PAUSE_NEW_PREPARATION==='true';
 return Object.freeze({paused,newLivePreparation:!paused&&env.GW_LIVE_PREPARATION_ENABLED==='true'&&gate.gate0Passed&&gate.releaseApproved&&!!gate.providerId,reconcileExisting:true,directProviderManagement:true});
}
