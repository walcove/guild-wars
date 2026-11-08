import {AppShell} from '@/src/components/navigation/app-shell';
import {ResearchWorkspace} from '@/src/components/research/research-workspace';
import {LocalTime} from '@/src/components/ui/local-time';
import {pageUser} from '@/src/server/auth/page-session';
import {getPool} from '@/src/server/db/client';
import {readRound} from '@/src/server/services/rounds';
export default async function Page({params}:{params:Promise<{guildId:string;roundId:string}>}){const {guildId,roundId}=await params,user=await pageUser(`/guilds/${guildId}/rounds/${roundId}/research`),view=await readRound(getPool(),user,guildId,roundId),name=(await getPool().query<{name:string}>('SELECT name FROM guilds WHERE id=$1',[guildId])).rows[0].name;return <AppShell guild={name} guildId={guildId} context={`${view.round.mode==='simulation'?'Simulation':'Real trading'} · Round ${view.round.number} · ${view.round.state.replaceAll('_',' ')}`}><p className="section-label">SOL covered calls · Round {view.round.number}</p><h1>Sell a covered call, or keep holding SOL?</h1>{view.nextAction.deadline&&<p>Next deadline: {new Date(view.nextAction.deadline).toUTCString()} · Your time: <LocalTime iso={view.nextAction.deadline}/></p>}<ResearchWorkspace userId={user} guildId={guildId} roundId={roundId} mode={view.round.mode} revision={view.round.revision} expiresAt={view.round.expires_at.toISOString()}/></AppShell>;}
