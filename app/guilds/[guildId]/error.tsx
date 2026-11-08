'use client';
import Link from 'next/link';
import {AppShell} from '@/src/components/navigation/app-shell';
export default function GuildError({retry}:{retry:()=>void}){return <AppShell context="Guild record unavailable"><h1>This guild could not be opened.</h1><p>Your session, membership or the service may have changed. Saved records remain canonical; no new action is confirmed by this screen.</p><button className="button primary" onClick={()=>retry()}>Retry this page</button><p><Link href="/guilds">Check your active guilds</Link> · <Link href="/connect">Reconnect Telegram</Link></p><p>Draft contributions are retained in this browser unless you sign out or change account.</p></AppShell>;}
