import type {NextRequest} from 'next/server';
import {z} from 'zod';
import {body,httpError,mutationUser,privateJson} from '@/src/server/auth/http';
import {getPool} from '@/src/server/db/client';
import {editNote,noteContentSchema} from '@/src/server/services/research-notes';
export async function POST(request:NextRequest,{params}:{params:Promise<{guildId:string;noteId:string}>}){try{const user=await mutationUser(request),{guildId,noteId}=await params,{expectedRevision,...content}=await body(request,noteContentSchema.extend({expectedRevision:z.number().int().positive()}),32768);await editNote(getPool(),user,guildId,noteId,content,expectedRevision);return privateJson({saved:true});}catch(e){return httpError(e);}}
