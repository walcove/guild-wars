import type {NextRequest} from 'next/server';
import {z} from 'zod';
import {body,httpError,mutationUser,privateJson} from '@/src/server/auth/http';
import {getPool} from '@/src/server/db/client';
import {bindGroup} from '@/src/server/services/bind-group';
import {telegramGroupVerifier} from '@/src/server/telegram/group-verifier';
export async function POST(request:NextRequest,{params}:{params:Promise<{guildId:string}>}){try{const user=await mutationUser(request),{guildId}=await params,input=await body(request,z.object({chatId:z.string(),topicId:z.string().nullable()}).strict());await bindGroup(getPool(),user,guildId,input.chatId,input.topicId,telegramGroupVerifier());return privateJson({saved:true});}catch(error){return httpError(error);}}
