import type {NextRequest} from 'next/server';
import {z} from 'zod';
import {body,mutationUser,privateJson,httpError,sessionCookie} from '@/src/server/auth/http';
import {readSession} from '@/src/server/auth/sessions';
import {getPool} from '@/src/server/db/client';
import {invariant} from '@/src/domain/errors';
import {enrollSimulation,simulationOverview} from '@/src/server/services/simulation-enrollment';
type Context={params:Promise<{guildId:string;seasonId:string}>};
export async function GET(request:NextRequest,{params}:Context){try{const user=(await readSession(getPool(),request.cookies.get(sessionCookie)?.value??'')).userId;invariant(user,'unauthorized','Connect Telegram first');const {guildId,seasonId}=await params;return privateJson(await simulationOverview(getPool(),user,guildId,seasonId));}catch(e){return httpError(e);}}
export async function POST(request:NextRequest,{params}:Context){try{const user=await mutationUser(request),{guildId,seasonId}=await params,input=await body(request,z.object({policyVersion:z.literal('automatic-weekly-virtual-v1'),consent:z.literal(true)}).strict());await enrollSimulation(getPool(),user,guildId,seasonId,input.policyVersion);return privateJson(await simulationOverview(getPool(),user,guildId,seasonId));}catch(e){return httpError(e);}}
