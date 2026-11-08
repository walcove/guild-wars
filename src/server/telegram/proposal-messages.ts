import type {ProposalContent} from '../../domain/proposals';
import {formatUnits} from '../../domain/money';
import {escapeHtml,type BotCard} from './render';
const short=(v:string,n=120)=>escapeHtml([...v].slice(0,n).join(''))+([...v].length>n?'…':'');
export function proposalCard(input:{guild:string;round:number;proposalId:string;versionId:string;version:number;content:ProposalContent;replacement:boolean;deliveryId?:string;stage?:string;deadline?:string},origin:string):BotCard {
 const c=input.content,t=c.terms,brief=new URL(`/proposals/${input.proposalId}?version=${input.versionId}${input.deliveryId?'&origin=p_'+input.deliveryId:''}`,origin).toString(),research=new URL(`/guilds/${c.guildId}/rounds/${c.roundId}/research?version=${input.versionId}${input.deliveryId?'&origin=p_'+input.deliveryId:''}`,origin).toString();
 const text=`<b>${input.replacement?'Replacement · ':''}Guild Wars · SOL covered call</b>\n${short(input.guild,80)} · Round ${input.round} · Proposal v${input.version} · ${escapeHtml(input.stage??'snapshot')}\n${input.deadline?'Next deadline: '+new Date(input.deadline).toUTCString():'Published timetable: see the canonical web record'}\n${c.mode==='simulation'?'Simulation':'Real trading'} · ${c.dataClass==='teaching_only'?'Hypothetical example; not executable':'Source-backed terms; fresh individual quote required'}\nAgreed sale price: ${escapeHtml(t.strike.amount)} ${t.strike.denomination}/SOL\nExpiration: ${new Date(t.expiresAt).toUTCString()}\nComparison: 1 SOL; full reference ${formatUnits(BigInt(c.referenceLamports),9)} SOL\nSettlement: ${t.settlement==='physical'?'physical delivery':'cash under exact provider terms'}\nWhy: ${short(c.research.why)}\nMain concern: ${short(c.research.mainRisk)}\nUpside is capped; SOL can still lose substantial value. Holding remains a full choice. A vote never authorizes someone else’s funds.\nCanonical version: ${input.versionId}`;
 return {text,buttons:[[{text:'Read this exact brief',url:brief}],[{text:'Research and outcomes',url:research}]]};
}
export function discussionLink(delivery:{chat_id:string;topic_id:string|null;message_id:string|null;state:string},publicGroupUrl:string|null):string|null {
 if(delivery.state!=='published'||!delivery.message_id||!/^\d+$/.test(delivery.message_id))return null;
 let base:string|null=null;
 if(publicGroupUrl){try{const u=new URL(publicGroupUrl);if(u.origin==='https://t.me'&&/^\/[A-Za-z][A-Za-z0-9_]{4,31}$/.test(u.pathname))base=u.origin+u.pathname;}catch{}}
 if(!base&&/^-\d+$/.test(delivery.chat_id)){const peer=-BigInt(delivery.chat_id)-1000000000000n;if(peer>=1n&&peer<=997852516352n)base='https://t.me/c/'+peer.toString();}
 return base?base+'/'+(delivery.topic_id?delivery.topic_id+'/':'')+delivery.message_id:null;
}
