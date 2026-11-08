'use client';
import {useSyncExternalStore} from 'react';
const subscribe=()=>()=>{};
export function LocalTime({iso}:{iso:string}){const local=useSyncExternalStore(subscribe,()=>new Date(iso).toLocaleString(),()=>null);return <time dateTime={iso}>{local??'Local time available after loading'}</time>;}
