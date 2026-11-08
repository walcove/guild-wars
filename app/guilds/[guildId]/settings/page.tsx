import {notFound} from 'next/navigation';
import {AppShell} from '@/src/components/navigation/app-shell';
import {SeasonSetup} from '@/src/components/season-setup';
import {GuildSettings} from '@/src/components/guild-settings';
import {pageUser} from '@/src/server/auth/page-session';
import {getPool} from '@/src/server/db/client';
import {guildOverview} from '@/src/server/services/guilds';
export default async function Page({params}:{params:Promise<{guildId:string}>}){const {guildId}=await params,user=await pageUser(`/guilds/${guildId}/settings`),view=await guildOverview(getPool(),user,guildId);if(view.membership.role!=='administrator')notFound();return <AppShell expectedUserId={user} guild={view.guild.name} guildId={guildId} context="Guild administration"><h1>Connect your group</h1><GuildSettings guildId={guildId}/><SeasonSetup guildId={guildId}/></AppShell>;}
