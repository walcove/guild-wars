'use client';
import {useEffect,useState,type ReactNode} from 'react';
import {flushSync} from 'react-dom';
import Link from 'next/link';
export function PrivateContentBoundary({expectedUserId,guildId,children}:{expectedUserId:string;guildId?:string;children:ReactNode}){
 const [status,setStatus]=useState<'checking'|'verified'|'hidden'|'unavailable'>('checking');
 useEffect(()=>{let active=true,generation=0;let controller:AbortController|undefined;const hide=()=>{generation++;controller?.abort();flushSync(()=>setStatus('hidden'));};
 const verify=async()=>{const attempt=++generation;controller?.abort();controller=new AbortController();try{const response=await fetch('/api/account/identity'+(guildId?'?guild='+encodeURIComponent(guildId):''),{cache:'no-store',signal:controller.signal}),identity=response.ok?await response.json():null;if(active&&generation===attempt)setStatus(identity?.userId===expectedUserId?'verified':'hidden');}catch{if(active&&generation===attempt)setStatus('unavailable');}};
 const storage=(e:StorageEvent)=>{if(e.key==='gw:identity-version')hide();},pageshow=(e:PageTransitionEvent)=>{if(e.persisted){hide();void verify();}};
 window.addEventListener('gw:identity-changed',hide);window.addEventListener('gw:access-lost',hide);window.addEventListener('storage',storage);window.addEventListener('pagehide',hide);window.addEventListener('pageshow',pageshow);void verify();
 return ()=>{active=false;generation++;controller?.abort();window.removeEventListener('gw:identity-changed',hide);window.removeEventListener('gw:access-lost',hide);window.removeEventListener('storage',storage);window.removeEventListener('pagehide',hide);window.removeEventListener('pageshow',pageshow);};},[expectedUserId,guildId]);
 if(status==='verified')return <>{children}</>;
 return <main id="main" tabIndex={-1}><h1>{status==='checking'?'Checking your connection':status==='hidden'?'Private content hidden':'Connection check unavailable'}</h1><p role="status">{status==='checking'?'Verifying this account and its access before opening private records.':status==='hidden'?'Your account or access changed. Reload this page to check the current identity; previous private records and drafts are hidden.':'Private records stay hidden until your connection can be verified. Reconnect and reload this same page.'}</p><button className="button" onClick={()=>window.location.reload()}>Reload this private view</button><p><Link href="/connect">Check your Telegram connection</Link></p></main>;
}
