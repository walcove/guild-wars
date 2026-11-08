import Link from 'next/link';
import {AppShell} from '@/src/components/navigation/app-shell';
import {pageUser} from '@/src/server/auth/page-session';
import {getPool} from '@/src/server/db/client';
import {readResultSnapshot} from '@/src/server/services/results';
export default async function Page({params}:{params:Promise<{roundId:string;snapshotId:string}>}){const {roundId,snapshotId}=await params,user=await pageUser(`/rounds/${roundId}/results/${snapshotId}`),p=await readResultSnapshot(getPool(),user,roundId,snapshotId);return <AppShell expectedUserId={user} ownerAccess context={`${p.mode==='simulation'?'Simulation':'Real trading'} · Immutable personal result revision`}><h1>Result audit snapshot</h1><p>Snapshot {p.id} · Recorded {p.created_at.toISOString()}. An amendment creates a new snapshot; this record remains unchanged.</p><pre className="ownership-message">{JSON.stringify(p.record,null,2)}</pre><Link href={`/rounds/${roundId}/results`}>Read the current result revision</Link></AppShell>;}
