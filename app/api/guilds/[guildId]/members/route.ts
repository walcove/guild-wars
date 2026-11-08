import type {NextRequest} from 'next/server';
import {z} from 'zod';
import {body,httpError,mutationUser,privateJson} from '@/src/server/auth/http';
import {getPool} from '@/src/server/db/client';
import {setMemberStatus} from '@/src/server/services/membership';
export async function POST(request:NextRequest,{params}:{params:Promise<{guildId:string}>}){try{const actor=await mutationUser(request),input=await body(request,z.object({userId:z.uuid(),status:z.enum(['active','suspended','departed'])}).strict());await setMemberStatus(getPool(),actor,(await params).guildId,input.userId,input.status);return privateJson({saved:true});}catch(error){return httpError(error);}}
