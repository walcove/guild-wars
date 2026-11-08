import Link from 'next/link';
import {AppShell} from '@/src/components/navigation/app-shell';
import {PlanBuilder} from '@/src/components/plans/plan-builder';
import {pageUser} from '@/src/server/auth/page-session';
import {getPool} from '@/src/server/db/client';
import {readRound} from '@/src/server/services/rounds';
export default async function Page({params}:{params:Promise<{guildId:string;roundId:string}>}){const {guildId,roundId}=await params,user=await pageUser(`/guilds/${guildId}/rounds/${roundId}/plans/new`),view=await readRound(getPool(),user,guildId,roundId),name=(await getPool().query<{name:string}>('SELECT name FROM guilds WHERE id=$1',[guildId])).rows[0].name;return <AppShell guild={name} guildId={guildId} context={`${view.round.mode==='simulation'?'Simulation':'Real trading'} · Round ${view.round.number} · ${view.round.state.replaceAll('_',' ')}`}><Link href={`/guilds/${guildId}/rounds/${roundId}/research`}>Back to research</Link><h1>Build a covered-call plan.</h1><PlanBuilder userId={user} guildId={guildId} roundId={roundId} mode={view.round.mode} expiresAt={view.round.expires_at.toISOString()} referenceLamports={view.season.rules.referenceLamports??null} choices={[]}/></AppShell>;}
