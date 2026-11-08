import type {NextRequest} from 'next/server';
import {z} from 'zod';
import {body,mutationSession,privateJson,httpError} from '@/src/server/auth/http';
import {getPool} from '@/src/server/db/client';
import {issueWalletChallenge} from '@/src/server/solana/wallet-proof';
export async function POST(request:NextRequest){try{const {token}=await mutationSession(request),input=await body(request,z.object({address:z.string().min(32).max(44),proofType:z.enum(['raw','offchain_v1'])}).strict());return privateJson(await issueWalletChallenge(getPool(),token,input.address,input.proofType,process.env.APP_ORIGIN??'http://127.0.0.1:3000'));}catch(e){return httpError(e);}}
