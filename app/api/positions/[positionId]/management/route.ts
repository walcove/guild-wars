import type {NextRequest} from 'next/server';
import {z} from 'zod';
import {body,mutationUser,privateJson,httpError} from '@/src/server/auth/http';
import {getPool} from '@/src/server/db/client';
import {requestPositionManagement} from '@/src/server/services/midweek';
export async function POST(request:NextRequest,{params}:{params:Promise<{positionId:string}>}){try{const user=await mutationUser(request),input=await body(request,z.object({action:z.enum(['hold','roll','buy_to_close','long_call','protective_put']),requestId:z.uuid()}).strict());await requestPositionManagement(getPool(),user,(await params).positionId,input.action,input.requestId);return privateJson({state:'saved',noTradeChange:true});}catch(e){return httpError(e);}}
