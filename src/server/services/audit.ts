import type {Tx} from '../db/client';
export async function audit(tx:Tx,event:{actorId?:string;guildId?:string;kind:string;recordId:string;reason:string;record?:Record<string,unknown>;correctsEventId?:string}):Promise<void> {
 await tx.query('INSERT INTO audit_events(actor_id,guild_id,kind,record_id,reason,record,corrects_event_id) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7)',[event.actorId??null,event.guildId??null,event.kind,event.recordId,event.reason,JSON.stringify(event.record??{}),event.correctsEventId??null]);
}
