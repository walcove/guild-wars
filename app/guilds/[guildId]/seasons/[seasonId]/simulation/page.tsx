import {AppShell} from '@/src/components/navigation/app-shell';
import {SimulationEnrollment} from '@/src/components/simulation-enrollment';
import {pageUser} from '@/src/server/auth/page-session';
import {getPool} from '@/src/server/db/client';
import {simulationOverview} from '@/src/server/services/simulation-enrollment';
export default async function Page({params}:{params:Promise<{guildId:string;seasonId:string}>}){const {guildId,seasonId}=await params,user=await pageUser(`/guilds/${guildId}/seasons/${seasonId}/simulation`),initial=await simulationOverview(getPool(),user,guildId,seasonId);return <AppShell guildId={guildId} context="Simulation · independent virtual weekly sleeves"><SimulationEnrollment userId={user} guildId={guildId} initial={initial}/></AppShell>;}
