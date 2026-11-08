import {AppShell} from '@/src/components/navigation/app-shell';
import {PositionSummary} from '@/src/components/trading/position-summary';
import {pageUser} from '@/src/server/auth/page-session';
import {getPool} from '@/src/server/db/client';
import {positionView} from '@/src/server/services/positions';
export default async function Page({params}:{params:Promise<{positionId:string}>}){const {positionId}=await params,user=await pageUser(`/positions/${positionId}`),position=await positionView(getPool(),user,positionId);return <AppShell guildId={position.guildId} context={`Round ${position.roundNumber} · ${position.mode==='simulation'?'Simulation':'Real trading'} · Position obligation`}><PositionSummary initial={position} userId={user}/></AppShell>;}
