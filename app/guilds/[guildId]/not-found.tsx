import Link from 'next/link';
import {AppShell} from '@/src/components/navigation/app-shell';
export default function NotFound(){return <AppShell context="Private guild unavailable"><h1>Guild unavailable</h1><p>Check that you are connected with the invited Telegram account and have active membership. A forwarded private link does not grant access.</p><Link href="/guilds" className="button primary">Check your guilds</Link><p><Link href="/connect">Check your Telegram connection</Link></p></AppShell>;}
