import type {NextRequest} from 'next/server';
import {httpError,mutationUser,privateJson} from '@/src/server/auth/http';
import {getPool} from '@/src/server/db/client';
import {acceptInvitation} from '@/src/server/services/membership';
import {telegramGroupVerifier} from '@/src/server/telegram/group-verifier';
export async function POST(request:NextRequest,{params}:{params:Promise<{token:string}>}){try{const user=await mutationUser(request),{token}=await params;return privateJson(await acceptInvitation(getPool(),user,token,telegramGroupVerifier()));}catch(error){return httpError(error);}}
