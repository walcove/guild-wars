import {AppShell} from '@/src/components/navigation/app-shell';
import {Comparison,type ResultsView} from '@/src/components/results/comparison';
import {pageUser} from '@/src/server/auth/page-session';
import {getPool} from '@/src/server/db/client';
import {roundResults} from '@/src/server/services/results';
export default async function Page({params}:{params:Promise<{roundId:string}>}){const {roundId}=await params,user=await pageUser(`/rounds/${roundId}/results`),view=await roundResults(getPool(),user,roundId);return <AppShell expectedUserId={user} guild={view.guildName} guildId={view.guildId} context={`Round ${view.roundNumber} · ${view.mode==='simulation'?'Simulation':'Real trading'} · Results`}><Comparison initial={view as ResultsView} userId={user}/></AppShell>;}
