'use client';
import {useEffect} from 'react';
import {useRouter} from 'next/navigation';
import {useSWRConfig} from 'swr';
export function PrivateIdentityGuard(){const router=useRouter(),{mutate,unload}=useSWRConfig();useEffect(()=>{
 const clear=()=>{try{for(const key of Object.keys(sessionStorage))if(key.startsWith('gw:'))sessionStorage.removeItem(key);}catch{}window.dispatchEvent(new Event('gw:draft'));unload({revalidate:false});if(navigator.onLine)router.refresh();};
 const storage=(e:StorageEvent)=>{if(e.key==='gw:identity-version'){clear();void mutate('/api/account/session');}};
 window.addEventListener('storage',storage);window.addEventListener('gw:identity-changed',clear);window.addEventListener('gw:access-lost',clear);return ()=>{window.removeEventListener('storage',storage);window.removeEventListener('gw:identity-changed',clear);window.removeEventListener('gw:access-lost',clear);};
 },[mutate,unload,router]);return null;}
