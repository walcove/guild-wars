'use client';
import {useState} from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import {syntheticSchedules} from '../domain/synthetic-schedule';
import {browserJson,guildMutation} from './guild-invitation';
export function SeasonSetup({guildId}:{guildId:string}) {
 const [start,setStart]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[roundId,setRoundId]=useState('');
 const {data:account}=useSWR('/api/account/session',browserJson,{shouldRetryOnError:false});
 const schedules=(()=>{try{return syntheticSchedules(new Date(start+'Z').toISOString());}catch{return [];}})();
 async function publish(){setBusy(true);setError('');try{const r=await guildMutation(`/api/guilds/${guildId}/seasons`,{researchOpen:schedules[0].researchOpen},account?.csrfToken??'');setRoundId(r.rounds[0].id);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <section><h2>Publish a teaching season</h2><p>Four weekly simulation rounds using synthetic contract dates. This is teaching-only and cannot produce an official execution score. No real provider contract or quote is represented.</p><label htmlFor="season-open">Research starts (UTC)</label><input id="season-open" type="datetime-local" value={start} onChange={e=>setStart(e.target.value)}/>{schedules.length>0&&<div><p>Review all four dates before publishing. Research lasts 24 hours, each ballot 12 hours and the individual execution window one hour.</p><ul>{schedules.map((s,i)=><li key={s.researchOpen}>Round {i+1}: research {new Date(s.researchOpen).toUTCString()}; voting {new Date(s.voteOpen).toUTCString()}–{new Date(s.voteClose).toUTCString()}; execution closes {new Date(s.executionClose).toUTCString()}; midweek {new Date(s.midweekOpen).toUTCString()}–{new Date(s.midweekClose).toUTCString()}; expiration {new Date(s.expiresAt).toUTCString()}.</li>)}</ul></div>}<button className="button" disabled={busy||!schedules.length||!account?.userId||!!roundId} onClick={()=>void publish()}>{busy?'Saving timetable…':'Publish fixed teaching timetable'}</button>{error&&<p role="alert" className="status-notice error">{error} Your selected time is retained.</p>}{roundId&&<p role="status">Timetable saved. <Link href={`/guilds/${guildId}/rounds/${roundId}`}>Review the first round</Link></p>}</section>;
}
