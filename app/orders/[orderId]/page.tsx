import {ownerRoundContext} from '@/src/server/services/owner-round-context';
import {AppShell} from '@/src/components/navigation/app-shell';
import {IntentStatus} from '@/src/components/trading/intent-status';
import {pageUser} from '@/src/server/auth/page-session';
import {getPool} from '@/src/server/db/client';
import {readOwnIntent} from '@/src/server/services/order-intents';
export default async function Page({params}:{params:Promise<{orderId:string}>}){const {orderId}=await params,user=await pageUser(`/orders/${orderId}`),intent=await readOwnIntent(getPool(),user,orderId);const roundContext=await ownerRoundContext(getPool(),user,{intentId:orderId});return <AppShell expectedUserId={user} ownerAccess guild={intent.guild_name} guildId={intent.guild_id} context={roundContext}><IntentStatus initial={intent} userId={user} guildId={intent.guild_id}/></AppShell>;}
