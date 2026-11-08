'use client';
import {useEffect,useState,type ReactNode} from 'react';
import {flushSync} from 'react-dom';
import Link from 'next/link';
export function PrivateContentBoundary({expectedUserId,guildId,children}:{expectedUserId:string;guildId?:string;children:ReactNode}){
 const [status,setStatus]=useState<'checking'|'verified'|'hidden'|'unavailable'>('checking'),[retained,setRetained]=useState(false);
 useEffect(()=>{
  let active=true,generation=0;let controller:AbortController|undefined;
  const hide=()=>{generation++;controller?.abort();flushSync(()=>{setRetained(false);setStatus('hidden');});};
  const verify=async()=>{
   const attempt=++generation;controller?.abort();controller=new AbortController();setStatus('checking');
   try{const response=await fetch('/api/account/identity'+(guildId?'?guild='+encodeURIComponent(guildId):''),{cache:'no-store',signal:controller.signal}),identity=response.ok?await response.json():null;
    if(active&&generation===attempt){const valid=identity?.userId===expectedUserId;setRetained(valid);setStatus(valid?'verified':'hidden');}
   }catch{if(active&&generation===attempt)setStatus('unavailable');}
  };
  const refresh=()=>{if(document.visibilityState==='visible')void verify();};
  const storage=(e:StorageEvent)=>{if(e.key==='gw:identity-version')hide();},pageshow=(e:PageTransitionEvent)=>{if(e.persisted){hide();void verify();}};
  const visibility=()=>{if(document.visibilityState==='visible')void verify();else{generation++;controller?.abort();setStatus('checking');}};
  window.addEventListener('gw:identity-changed',hide);window.addEventListener('gw:access-lost',hide);window.addEventListener('storage',storage);window.addEventListener('pagehide',hide);window.addEventListener('pageshow',pageshow);window.addEventListener('focus',refresh);window.addEventListener('online',refresh);document.addEventListener('visibilitychange',visibility);
  const timer=setInterval(refresh,60000);void verify();
  return ()=>{active=false;generation++;controller?.abort();clearInterval(timer);window.removeEventListener('gw:identity-changed',hide);window.removeEventListener('gw:access-lost',hide);window.removeEventListener('storage',storage);window.removeEventListener('pagehide',hide);window.removeEventListener('pageshow',pageshow);window.removeEventListener('focus',refresh);window.removeEventListener('online',refresh);document.removeEventListener('visibilitychange',visibility);};
 },[expectedUserId,guildId]);
 // Keep entered work mounted but inaccessible during a routine network check. An
 // actual identity/access failure discards the old subtree and its local state.
 return <>{status!=='verified'&&<main id="main" tabIndex={-1}><h1>{status==='checking'?'Checking your connection':status==='hidden'?'Private content hidden':'Connection check unavailable'}</h1><p role="status">{status==='checking'?'Verifying this account and its access before opening private records.':status==='hidden'?'Your account or access changed. Reload this page to check the current identity; previous private records and drafts are hidden.':'Private records stay hidden until your connection can be verified. Reconnect and reload this same page.'}</p><button className="button" onClick={()=>window.location.reload()}>Reload this private view</button><p><Link href="/connect">Check your Telegram connection</Link></p></main>}{retained&&<div hidden={status!=='verified'} inert={status!=='verified'}>{children}</div>}</>;
}
