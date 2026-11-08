import type {NextRequest} from 'next/server';
import {z} from 'zod';
import {body,httpError,privateJson,mutationUser} from '@/src/server/auth/http';
import {getPool} from '@/src/server/db/client';
import {createSeason} from '@/src/server/services/rounds';
import {syntheticSchedules} from '@/src/domain/synthetic-schedule';
import {utcSchema} from '@/src/domain/types';
export async function POST(request:NextRequest,{params}:{params:Promise<{guildId:string}>}){try{const user=await mutationUser(request),input=await body(request,z.object({researchOpen:utcSchema}).strict()),schedules=syntheticSchedules(input.researchOpen);return privateJson(await createSeason(getPool(),user,(await params).guildId,{mode:'simulation',division:'synthetic-teaching',rulesVersion:'pilot-1-reserve',schedules},{kind:'synthetic',providerId:'synthetic',expirations:schedules.map(s=>s.expiresAt)}),201);}catch(e){return httpError(e);}}
