import Link from 'next/link';
import {AppShell} from '@/src/components/navigation/app-shell';
import {GuildSettings} from '@/src/components/guild-settings';
import {pageUser} from '@/src/server/auth/page-session';
import {getPool} from '@/src/server/db/client';
export default async function Page(){const user=await pageUser('/guilds'),guilds=(await getPool().query<{id:string;name:string}>("SELECT g.id,g.name FROM guilds g JOIN memberships m ON m.guild_id=g.id WHERE m.user_id=$1 AND m.status='active' ORDER BY g.name,g.id",[user])).rows;return <AppShell><h1>Your guilds</h1>{guilds.length?<ul>{guilds.map(g=><li key={g.id}><Link href={`/guilds/${g.id}`}>{g.name}</Link></li>)}</ul>:<p>No active guild membership yet. Open an invitation from your Telegram group or create a guild.</p>}<section><h2>Start a guild</h2><GuildSettings/></section></AppShell>;}
