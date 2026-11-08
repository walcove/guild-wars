import type {NextRequest} from 'next/server';
import {z} from 'zod';
import {body,mutationUser,privateJson,httpError,sessionCookie} from '@/src/server/auth/http';
import {readSession} from '@/src/server/auth/sessions';
import {getPool} from '@/src/server/db/client';
import {readOwnIntent} from '@/src/server/services/order-intents';
import {invariant} from '@/src/domain/errors';
import {executionGate} from '@/src/server/providers/live-readiness';
import {issueReviewPreparationToken,declineUnsubmittedIntent} from '@/src/server/services/order-preparation';
type Context={params:Promise<{orderId:string}>};
export async function GET(request:NextRequest,{params}:Context){try{const user=(await readSession(getPool(),request.cookies.get(sessionCookie)?.value??'')).userId;invariant(user,'unauthorized','Connect Telegram first');const intent=await readOwnIntent(getPool(),user,(await params).orderId);return privateJson({intent,providerUrl:null,preparationAvailable:false,reason:'No approved provider authorization or reconciliation route is installed.'});}catch(e){return httpError(e);}}
export async function POST(request:NextRequest,{params}:Context){try{const user=await mutationUser(request),{orderId}=await params,input=await body(request,z.discriminatedUnion('action',[z.object({action:z.literal('decline')}).strict(),z.object({action:z.enum(['review','renew_review']),expectedHash:z.string().regex(/^[a-f0-9]{64}$/),expectedRevision:z.number().int().positive()}).strict()])),intent=await readOwnIntent(getPool(),user,orderId);invariant(intent.mode==='live','mode','Simulation never opens provider authorization');if(input.action==='decline'){await declineUnsubmittedIntent(getPool(),user,orderId);return privateJson({state:'cancelled',kind:'declined_before_application_provider_handoff'});}invariant(executionGate.gate0Passed&&executionGate.releaseApproved&&process.env.GW_LIVE_PREPARATION_ENABLED==='true','live_unavailable','Live preparation is disabled; no trade or provider session was created');return privateJson(await issueReviewPreparationToken(getPool(),user,orderId,input.expectedHash,input.expectedRevision,input.action==='renew_review'));}catch(e){return httpError(e);}}
