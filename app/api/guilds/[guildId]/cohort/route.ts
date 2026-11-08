import type {NextRequest} from 'next/server';
import {z} from 'zod';
import {body,mutationUser,privateJson,httpError} from '@/src/server/auth/http';
import {getPool} from '@/src/server/db/client';
import {registerLiveCohort} from '@/src/server/services/live-enrollment';
export async function POST(request:NextRequest,{params}:{params:Promise<{guildId:string}>}){try{const user=await mutationUser(request),input=await body(request,z.object({seasonId:z.uuid(),accountId:z.uuid(),allocationLamports:z.string().max(80),reserveLamports:z.string().max(80),investmentCashUsdcMicros:z.literal('0'),consentVersion:z.literal('live-cohort-read-v1'),readAccess:z.literal(true),aggregateResults:z.literal(true),fourRounds:z.literal(true)}).strict()),{seasonId,...registration}=input;return privateJson(await registerLiveCohort(getPool(),user,(await params).guildId,seasonId,registration));}catch(e){return httpError(e);}}
