import {AppShell} from '@/src/components/navigation/app-shell';
import {SolanaProvider} from '@/src/components/wallet/solana-provider';
import {ConnectWallet} from '@/src/components/wallet/connect-wallet';
import {pageUser} from '@/src/server/auth/page-session';
export default async function Page(){const user=await pageUser('/connect/wallet');return <AppShell expectedUserId={user} context="Optional Solana address · ownership only"><SolanaProvider><ConnectWallet userId={user}/></SolanaProvider></AppShell>;}
