import type {NextRequest} from 'next/server';
import {z} from 'zod';
import {body,mutationSession,privateJson,httpError,sessionCookie} from '@/src/server/auth/http';
import {readSession} from '@/src/server/auth/sessions';
import {getPool} from '@/src/server/db/client';
import {invariant} from '@/src/domain/errors';
import {confirmWalletLink} from '@/src/server/solana/wallet-proof';
export async function GET(request:NextRequest){try{const s=await readSession(getPool(),request.cookies.get(sessionCookie)?.value??'');invariant(s.userId,'unauthorized','Link Telegram first');return privateJson({links:(await getPool().query('SELECT address,created_at,proof_type FROM wallet_links WHERE user_id=$1 ORDER BY created_at DESC',[s.userId])).rows,tradeAuthority:false});}catch(e){return httpError(e);}}
export async function POST(request:NextRequest){try{const {token}=await mutationSession(request),input=await body(request,z.object({nonce:z.string().max(43),signature:z.string().max(128),signedMessage:z.string().max(8192)}).strict(),12288);return privateJson(await confirmWalletLink(getPool(),token,input,process.env.APP_ORIGIN??'http://127.0.0.1:3000'));}catch(e){return httpError(e);}}
