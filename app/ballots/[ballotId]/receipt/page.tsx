import {AppShell} from '@/src/components/navigation/app-shell';
import {ReceiptRefresh} from '@/src/components/telegram/receipt-refresh';
import {pageUser} from '@/src/server/auth/page-session';
import {getPool} from '@/src/server/db/client';
import {ballotView} from '@/src/server/services/ballots';
export default async function Page({params}:{params:Promise<{ballotId:string}>}){const {ballotId}=await params,user=await pageUser(`/ballots/${ballotId}/receipt`),view=await ballotView(getPool(),user,ballotId);return <AppShell guild={view.guildName} guildId={view.guildId} context={`${view.mode==='simulation'?'Simulation':'Real trading'} · Round ${view.roundNumber}`}><ReceiptRefresh userId={user} initial={view}/></AppShell>;}
