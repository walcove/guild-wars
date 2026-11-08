import type {NextRequest} from 'next/server';
import {z} from 'zod';
import {body,mutationUser,privateJson,httpError} from '@/src/server/auth/http';
import {getPool} from '@/src/server/db/client';
import {requestMemberQuote} from '@/src/server/services/order-entry';
export async function POST(request:NextRequest,{params}:{params:Promise<{roundId:string}>}){try{const user=await mutationUser(request);await body(request,z.object({action:z.literal('request_quote'),requestId:z.uuid()}).strict());return privateJson(await requestMemberQuote(getPool(),user,(await params).roundId));}catch(e){return httpError(e);}}
