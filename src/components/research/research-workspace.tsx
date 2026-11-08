'use client';
import Link from 'next/link';
import useSWR from 'swr';
import {browserJson,BrowserRequestError} from '../guild-invitation';
import {MarketOverview} from './market-overview';
import {CallComparison} from './call-comparison';
import {EventCalendar,type CuratedEvent} from './event-calendar';
import {EvidenceList} from './evidence-list';
import type {EvidenceNote} from './contribution-form';
import type {MarketStatus} from '../../server/market/cache';
interface ResearchPayload {checkedAt:string;history:MarketStatus;quoteMenu:{status:string;message:string};events:CuratedEvent[];evidence:{notes:EvidenceNote[];nextCursor:string|null}}
export function ResearchWorkspace({userId,guildId,roundId,mode,revision,expiresAt}:{userId:string;guildId:string;roundId:string;mode:string;revision:number;expiresAt:string}) {
 const {data:cached,error,mutate,isLoading}=useSWR<ResearchPayload>(['gw-private',userId,guildId,mode,roundId,revision],()=>browserJson(`/api/rounds/${roundId}/research`),{refreshInterval:10000,refreshWhenHidden:false,refreshWhenOffline:false,revalidateOnReconnect:true,shouldRetryOnError:false});
 const data=error instanceof BrowserRequestError&&[401,403].includes(error.status)?undefined:cached;
 const base=`/guilds/${guildId}/rounds/${roundId}`;
 return <><div className="workspace"><div><CallComparison outcomesHref={base+'/outcomes'} message={data?.quoteMenu.message??'Provider quotes have not been verified.'}/><nav className="step-nav" aria-label="Round research steps"><a href="#understand">Understand the market</a><Link href={base+'/outcomes'}>Compare outcomes</Link><a href="#evidence">Add evidence</a><Link href={base+'/plans/new'}>Build plan</Link></nav>{isLoading&&<p role="status">Loading this round’s research. The comparison and explanation remain available.</p>}{error&&<div className="status-notice error" role="alert"><p>Research could not be refreshed. Any retained data may be out of date. Your contribution draft stays in this browser.</p><button className="button" onClick={()=>void mutate()}>Retry research</button><Link href={`/connect?return=${encodeURIComponent(base+'/research')}`}>Reconnect to this round</Link></div>}{data&&<p className="muted">Last checked: {new Date(data.checkedAt).toUTCString()}.</p>}<div id="understand"><MarketOverview status={data?.history.status??'unavailable'} history={data?.history.data} message={data?.history.message} expiresAt={expiresAt}/></div>{data&&<div id="evidence"><EvidenceList page={data.evidence} userId={userId} guildId={guildId} roundId={roundId} mode={mode} onSaved={()=>void mutate()}/></div>}</div><aside className="evidence-rail"><EventCalendar events={data?.events??[]} guildId={guildId} onSaved={()=>void mutate()}/><p>Research is open to every active member. A role, wallet or reputation score never unlocks the evidence used in guild decisions.</p><Link href={`/guilds/${guildId}`}>Return to the guild and Telegram discussion</Link></aside></div></>;
}
