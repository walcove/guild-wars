import Link from 'next/link';
import {AppShell} from '@/src/components/navigation/app-shell';
import {pageUser} from '@/src/server/auth/page-session';
import {getPool} from '@/src/server/db/client';
import {readScoreRevision} from '@/src/server/services/rankings';
export default async function Page({params}:{params:Promise<{seasonId:string;revisionId:string}>}){const {seasonId,revisionId}=await params,user=await pageUser(`/seasons/${seasonId}/leaderboard/${revisionId}`),r=await readScoreRevision(getPool(),user,seasonId,revisionId);return <AppShell context="Season comparison · Immutable source revision"><h1>Scoring audit revision</h1><p>{r.created_at.toISOString()} · {r.id}. Corrections create new revisions; prior source records remain available.</p><pre className="ownership-message">{JSON.stringify(r.record,null,2)}</pre><Link href={`/seasons/${seasonId}/leaderboard`}>Read the current comparison</Link></AppShell>;}
