import type {NextRequest} from 'next/server';
import {z} from 'zod';
import {body,httpError,mutationUser,privateJson} from '@/src/server/auth/http';
import {getPool} from '@/src/server/db/client';
import {createGuild} from '@/src/server/services/guilds';
export async function POST(request:NextRequest){try{const user=await mutationUser(request),input=await body(request,z.object({name:z.string().min(2).max(100)}).strict());return privateJson(await createGuild(getPool(),user,input.name),201);}catch(error){return httpError(error);}}
