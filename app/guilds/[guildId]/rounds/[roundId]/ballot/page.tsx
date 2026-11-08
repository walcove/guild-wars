import {AppShell} from '@/src/components/navigation/app-shell';
import {BallotCoordinator} from '@/src/components/telegram/ballot-coordinator';
import {pageUser} from '@/src/server/auth/page-session';
import {getPool} from '@/src/server/db/client';
import {ballotCandidates} from '@/src/server/services/ballots';
export default async function Page({params}:{params:Promise<{guildId:string;roundId:string}>}){const {guildId,roundId}=await params,user=await pageUser(`/guilds/${guildId}/rounds/${roundId}/ballot`),initial=await ballotCandidates(getPool(),user,guildId,roundId);return <AppShell guildId={guildId} context="Guild ballot · exact locked versions"><BallotCoordinator initial={initial} roundId={roundId}/></AppShell>;}
