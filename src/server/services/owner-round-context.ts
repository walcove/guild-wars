import type {Pool} from 'pg';
import {invariant} from '../../domain/errors';
import {nextRoundAction,type RoundRecord} from './rounds';
export async function ownerRoundContext(db:Pool,userId:string,reference:{intentId:string}|{positionId:string}){
 const r=(await db.query<RoundRecord>(`SELECT r.* FROM rounds r JOIN sleeves s ON s.round_id=r.id JOIN order_intents i ON i.sleeve_id=s.id WHERE i.user_id=$1 AND ${'intentId'in reference?'i.id=$2':'EXISTS(SELECT FROM positions p WHERE p.intent_id=i.id AND p.user_id=$1 AND p.id=$2)'}`,[userId,'intentId'in reference?reference.intentId:reference.positionId])).rows[0];invariant(r,'forbidden','Owned round unavailable');const action=nextRoundAction(r,new Date());return `${r.mode==='live'?'Real trading':'Simulation'} · Round ${r.number} · ${r.state.replaceAll('_',' ')} · ${action.deadline?'Next deadline '+new Date(action.deadline).toUTCString():'No further scheduled deadline; verify remaining obligations'}`;
}
