import type {NextRequest} from 'next/server';
import {getPool} from '@/src/server/db/client';
import {revokeSession} from '@/src/server/auth/sessions';
import {mutationSession,privateJson,clearSessionCookies,httpError} from '@/src/server/auth/http';
export async function POST(request:NextRequest){
 try {const {token}=await mutationSession(request);await revokeSession(getPool(),token);const response=privateJson({signedOut:true});clearSessionCookies(response);return response;}catch(error){return httpError(error);}
}
