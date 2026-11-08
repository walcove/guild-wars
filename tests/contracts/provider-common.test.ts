import {expect,it} from 'vitest';
import {liveAdapter,simulationAdapter} from '../../src/server/providers/registry';
import type {SimulationAdapter} from '../../src/server/providers/contracts';
it('keeps live preparation unavailable regardless of a request mode',()=>{
 expect(()=>liveAdapter({mode:'live'},null,{gate0Passed:false,releaseApproved:false,providerId:null})).toThrow(/disabled/);
 expect(()=>liveAdapter({mode:'simulation'},null,{gate0Passed:false,releaseApproved:false,providerId:null})).toThrow(/mode|round/);
});
it('has no universal submit or member-authorization method on simulation',()=>{
 const simulator:SimulationAdapter={mode:'simulation',listInstruments:async()=>[],quote:async()=>{throw new Error('No quote')},reconcile:async()=>[],bookVirtual:async()=>[]};
 expect(simulationAdapter({mode:'simulation'},simulator)).toBe(simulator);
 expect('prepareMemberAuthorization' in simulator).toBe(false);expect('submit' in simulator).toBe(false);
 expect(()=>simulationAdapter({mode:'live'},simulator)).toThrow();
});
it('binds an approved provider to the exact adapter identity',()=>{
 const before=process.env.GW_LIVE_PREPARATION_ENABLED;process.env.GW_LIVE_PREPARATION_ENABLED='true';
 try {
  const adapter={mode:'live' as const,providerId:'provider-b',listInstruments:async()=>[],quote:async()=>{throw new Error('No quote')},reconcile:async()=>[],prepareMemberAuthorization:async()=>({kind:'hosted' as const,reference:'synthetic-not-a-live-session'})};
  expect(()=>liveAdapter({mode:'live'},adapter,{gate0Passed:true,releaseApproved:true,providerId:'provider-a'})).toThrow(/provider/i);
  expect(liveAdapter({mode:'live'},adapter,{gate0Passed:true,releaseApproved:true,providerId:'provider-b'})).toBe(adapter);
 } finally {if(before===undefined)delete process.env.GW_LIVE_PREPARATION_ENABLED;else process.env.GW_LIVE_PREPARATION_ENABLED=before;}
});
