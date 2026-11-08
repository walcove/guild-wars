import {invariant} from './errors';
import {parseUtc} from './types';
export interface RoundSchedule {researchOpen:string;candidateLock:string;voteOpen:string;voteClose:string;executionClose:string;midweekOpen:string;midweekClose:string;expiresAt:string}
export const roundStates=['research','candidate_lock','voting','execution_window','open','midweek','expired','settlement_pending','complete'] as const;
export type RoundState=typeof roundStates[number]|'cancelled'|'unranked';
const hour=3600000;
export function validateSeasonSchedule(rounds:readonly RoundSchedule[]):readonly RoundSchedule[] {
 invariant(rounds.length===4,'season_rounds','A pilot season has four rounds');
 for(const [index,s] of rounds.entries()) {
  const keys=['researchOpen','candidateLock','voteOpen','voteClose','executionClose','midweekOpen','midweekClose','expiresAt'] as const;
  for(const k of keys) parseUtc(s[k]);
  for(let i=1;i<keys.length;i++) invariant(s[keys[i]]>=s[keys[i-1]],'schedule_order','Round timetable must be ordered');
  invariant(Date.parse(s.candidateLock)-Date.parse(s.researchOpen)>=24*hour,'research_duration','At least 24 hours for research');
  invariant(Date.parse(s.voteClose)-Date.parse(s.voteOpen)===12*hour,'ballot_duration','Opening ballot lasts 12 hours');
  const execution=Date.parse(s.executionClose)-Date.parse(s.voteClose);
  invariant(execution>0&&execution<=hour,'execution_duration','Execution window must be positive and no longer than 60 minutes');
  invariant(Date.parse(s.midweekClose)-Date.parse(s.midweekOpen)===12*hour&&s.midweekOpen>s.executionClose&&s.expiresAt>s.midweekClose,'midweek_duration','Midweek ballot must fit within the actual contract term');
  if(index>0) invariant(s.researchOpen>rounds[index-1].researchOpen&&s.expiresAt>rounds[index-1].expiresAt,'weekly_order','Round schedules must advance');
 }
 return rounds;
}
export function transitionRound(from:RoundState,to:RoundState):RoundState {
 if(from===to)return to;
 invariant(!['complete','cancelled','unranked'].includes(from),'terminal_round','Terminal round cannot reopen');
 if(to==='cancelled'||to==='unranked')return to;
 const index=roundStates.indexOf(from as typeof roundStates[number]);
 invariant(index>=0&&roundStates[index+1]===to,'round_transition','Cannot skip a round stage or infer settlement');return to;
}
