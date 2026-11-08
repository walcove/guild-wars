import type {Pool} from 'pg';
import {guildOverview} from './guilds';
export async function guildPageContext(db:Pool,userId:string,guildId:string){
 const v=await guildOverview(db,userId,guildId),r=v.round;
 return {guild:v.guild.name,context:r?`${r.mode==='live'?'Real trading':'Simulation'} · Round ${r.number} · ${r.state.replaceAll('_',' ')}${v.nextAction?.deadline?' · Next deadline '+new Date(v.nextAction.deadline).toUTCString():''}`:'No published season · research remains open'};
}
