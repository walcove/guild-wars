import {expect,it} from 'vitest';
import {validateSeasonSchedule,transitionRound} from './round-policy';
const week={researchOpen:'2026-11-01T00:00:00.000Z',candidateLock:'2026-11-02T00:00:00.000Z',voteOpen:'2026-11-02T00:00:00.000Z',voteClose:'2026-11-02T12:00:00.000Z',executionClose:'2026-11-02T13:00:00.000Z',midweekOpen:'2026-11-04T00:00:00.000Z',midweekClose:'2026-11-04T12:00:00.000Z',expiresAt:'2026-11-06T08:00:00.000Z'};
const weeks=Array.from({length:4},(_,i)=>Object.fromEntries(Object.entries(week).map(([k,v])=>[k,new Date(Date.parse(v)+i*7*86400000).toISOString()])) as typeof week);
it('locks four actual expirations without assuming exactly seven days to expiry',()=>{expect(validateSeasonSchedule(weeks)).toEqual(weeks);expect(()=>validateSeasonSchedule(weeks.slice(0,3))).toThrow();});
it.each([{candidateLock:'2026-11-01T23:59:59.000Z'},{voteClose:'2026-11-02T11:59:59.000Z'},{executionClose:'2026-11-02T13:00:01.000Z'},{expiresAt:'2026-11-03T00:00:00.000Z'}])('rejects shortened research/ballot, oversized execution and impossible expiry %j',change=>expect(()=>validateSeasonSchedule([{...week,...change},...weeks.slice(1)])).toThrow());
it('never unlocks settlement or skips stages just because time passed',()=>{
 const states=['research','candidate_lock','voting','execution_window','open','midweek','expired','settlement_pending','complete'] as const;
 for(let i=0;i<states.length-1;i++) expect(transitionRound(states[i],states[i+1])).toBe(states[i+1]);
 expect(()=>transitionRound('expired','complete')).toThrow();expect(()=>transitionRound('complete','research')).toThrow();expect(transitionRound('voting','cancelled')).toBe('cancelled');
});
