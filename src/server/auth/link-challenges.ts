import {invariant} from '../../domain/errors';
export function safeReturnPath(path:string):string {
 invariant(typeof path==='string'&&path.length<=1024&&/^\/(?:$|(?:guilds|proposals|ballots|positions|rounds|connect)(?:\/|\?|$))/.test(path)&&!path.includes('..')&&!/[\\%\s#]/.test(path),'invalid_return','Return to a valid internal guild or proposal link');
 const url=new URL(path,'https://guild-wars.invalid');
 invariant(url.origin==='https://guild-wars.invalid'&&!url.pathname.includes('..')&&/^\/[A-Za-z0-9/_-]*$/.test(url.pathname),'invalid_return','Invalid internal return path');
 for(const [key,value] of url.searchParams)invariant(['version','origin'].includes(key)&&/^[A-Za-z0-9_-]{1,128}$/.test(value),'invalid_return','Only opaque version/discussion references are allowed');return path;
}
