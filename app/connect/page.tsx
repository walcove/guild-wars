import Link from 'next/link';
import {AppShell} from '@/src/components/navigation/app-shell';
import {AccountLink} from '@/src/components/account-link';
import {safeReturnPath} from '@/src/server/auth/link-challenges';
export default async function Connect({searchParams}:{searchParams:Promise<{return?:string}>}) {
 const params=await searchParams;let path='/';try{path=safeReturnPath(params.return??'/');}catch{/* Invalid return references never redirect away from this application. */}
 return <AppShell><h1>Connect your Telegram account</h1><AccountLink returnPath={path}/><p><Link href="/connect/wallet">Link an optional Solana address after connecting Telegram</Link></p></AppShell>;
}
