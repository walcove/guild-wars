import type {NextRequest} from 'next/server';
import {httpError,mutationUser,privateJson} from '@/src/server/auth/http';
import {getPool} from '@/src/server/db/client';
import {createInvitation} from '@/src/server/services/membership';
export async function POST(request:NextRequest,{params}:{params:Promise<{guildId:string}>}){try{return privateJson(await createInvitation(getPool(),await mutationUser(request),(await params).guildId),201);}catch(error){return httpError(error);}}
