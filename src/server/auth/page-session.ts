import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {getPool} from '../db/client';
import {sessionCookie} from './http';
import {readSession} from './sessions';
import {safeReturnPath} from './link-challenges';
export async function pageUser(returnPath:string):Promise<string> {
 let userId:string|null=null;
 try {userId=(await readSession(getPool(),(await cookies()).get(sessionCookie)?.value??'')).userId;}catch{}
 if(!userId)redirect(`/connect?return=${encodeURIComponent(safeReturnPath(returnPath))}`);return userId;
}
