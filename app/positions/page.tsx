import Link from 'next/link';
import {AppShell} from '@/src/components/navigation/app-shell';
import {pageUser} from '@/src/server/auth/page-session';
import {getPool} from '@/src/server/db/client';
import {listOwnedPositions} from '@/src/server/services/positions';
export default async function Page(){const user=await pageUser('/positions'),{positions,nextCursor}=await listOwnedPositions(getPool(),user);return <AppShell context="Your positions · All rounds"><h1>Your covered-call positions</h1><p>Original obligations remain visible across rounds, including after you leave a guild.</p>{positions.length===0?<section className="panel"><h2>No position booked</h2><p>A vote never creates a personal real trade. Review your round or a saved order to see the next step.</p><Link href="/">Return to your guild</Link></section>:<ul className="evidence-list">{positions.map(p=><li key={p.id}><Link href={`/positions/${p.id}`}>{p.mode==='simulation'?'Simulation':'Real trading'} · {p.state.replaceAll('_',' ')} · {p.provider_id}</Link></li>)}</ul>}{nextCursor&&<p>Your latest 50 positions are shown. Older records remain available by their saved position link.</p>}</AppShell>;}
