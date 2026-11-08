import {AppShell} from '@/src/components/navigation/app-shell';
import {IntentStatus} from '@/src/components/trading/intent-status';
import {pageUser} from '@/src/server/auth/page-session';
import {getPool} from '@/src/server/db/client';
import {readOwnIntent} from '@/src/server/services/order-intents';
export default async function Page({params}:{params:Promise<{orderId:string}>}){const {orderId}=await params,user=await pageUser(`/orders/${orderId}`),intent=await readOwnIntent(getPool(),user,orderId);return <AppShell expectedUserId={user} ownerAccess guildId={intent.guild_id} context={`${intent.mode==='live'?'Real trading':'Simulation test record'} · Your saved order`}><IntentStatus initial={intent} userId={user} guildId={intent.guild_id}/></AppShell>;}
