'use client';
import {useState} from 'react';
import Link from 'next/link';
import useSWR from 'swr';
export class BrowserRequestError extends Error {constructor(message:string,readonly status:number){super(message);}}
export async function browserJson(url:string){const r=await fetch(url,{cache:'no-store'}),data=await r.json();if(!r.ok){if(r.status===401||r.status===403)window.dispatchEvent(new Event('gw:access-lost'));throw new BrowserRequestError(data.message,r.status);}return data;}
export async function guildMutation(url:string,input:unknown,csrf:string){const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','X-GW-CSRF':csrf},body:JSON.stringify(input)}),data=await r.json();if(!r.ok)throw Error(data.message??'Action was not confirmed. Retry safely.');return data;}
export function GuildInvitation({token}:{token:string}) {
 const {data:account,error}=useSWR('/api/account/session',browserJson,{shouldRetryOnError:false});
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[guildId,setGuildId]=useState('');
 async function accept(){setBusy(true);setMessage('');try{const r=await guildMutation(`/api/invitations/${token}`,{},account.csrfToken);setGuildId(r.guildId);}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
 return <><p>No wallet is required. Every active member may research, challenge a plan and vote.</p>{error&&<p role="alert">Connection unavailable. Reload this page to retry; this invitation is retained.</p>}{account?.userId?<button className="button primary" disabled={busy||!!guildId} onClick={()=>void accept()}>{busy?'Verifying group membership…':'Accept invitation'}</button>:<Link className="button primary" href={`/connect?return=${encodeURIComponent(`/invite/${token}`)}`}>Connect Telegram to join</Link>}{message&&<p className="status-notice error" role="alert">{message}</p>}{guildId&&<p role="status">Membership saved. <Link href={`/guilds/${guildId}`}>Open your guild</Link></p>}</>;
}
