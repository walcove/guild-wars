import {AppShell} from '@/src/components/navigation/app-shell';
import {GuildInvitation} from '@/src/components/guild-invitation';
import {getPool} from '@/src/server/db/client';
import {invitationView} from '@/src/server/services/membership';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{token:string}>}){const {token}=await params;let invite;try{invite=await invitationView(getPool(),token);}catch{return <AppShell><h1>Invitation unavailable</h1><p>This invitation expired, was revoked or reached its allowance. Ask a guild administrator for a new invitation; private research stays protected.</p></AppShell>;}return <AppShell guild={invite.name} context={invite.mode==='live'?'Real trading season':invite.mode?'Simulation season':'No season started'}><h1>Join {invite.name}</h1><p>First join the Telegram group shared by its administrator. Connect the same Telegram account here, then accept.</p><GuildInvitation token={token}/></AppShell>;}
