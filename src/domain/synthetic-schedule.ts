import type {RoundSchedule} from './round-policy';
import {parseUtc} from './types';
export function syntheticSchedules(researchOpen:string):RoundSchedule[] {
 parseUtc(researchOpen);const start=Date.parse(researchOpen),hour=3600000;
 return Array.from({length:4},(_,i)=>{const iso=(h:number)=>new Date(start+(i*168+h)*hour).toISOString();return {researchOpen:iso(0),candidateLock:iso(24),voteOpen:iso(24),voteClose:iso(36),executionClose:iso(37),midweekOpen:iso(72),midweekClose:iso(84),expiresAt:iso(128)};});
}
