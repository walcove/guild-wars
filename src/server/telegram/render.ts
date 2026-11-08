import {invariant} from '../../domain/errors';
export type BotButton={text:string;url:string}|{text:string;callback_data:string};
export interface BotCard {text:string;buttons:BotButton[][]}
export function escapeHtml(value:string):string {return value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));}
export function splitEscaped(value:string):string[] {
 const result:string[]=[];let part='';
 for(const character of value){const escaped=escapeHtml(character);if(part.length+escaped.length>3500){result.push(part);part='';}part+=escaped;}
 if(part)result.push(part);return result;
}
export function linkPrompt(hash:string,telegramId:string,origin:string):BotCard {
 invariant(/^[a-f0-9]{64}$/.test(hash)&&/^[1-9]\d{0,19}$/.test(telegramId),'link_expired','Connection unavailable');
 return {text:`Connect Telegram account <b>${escapeHtml(telegramId)}</b> to Guild Wars? Confirm here, then return to the original browser to finish. This grants no trading authority.`,buttons:[[{text:'Confirm this Telegram account',callback_data:'l:'+Buffer.from(hash,'hex').toString('base64url')}],[{text:'Open Guild Wars',url:new URL('/connect?resume=1',origin).toString()}]]};
}
