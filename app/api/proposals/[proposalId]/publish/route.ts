import type {NextRequest} from 'next/server';
import {z} from 'zod';
import {body,httpError,mutationUser,privateJson} from '@/src/server/auth/http';
import {getPool} from '@/src/server/db/client';
import {publishProposal,replacePublication,reportDiscussionUnavailable} from '@/src/server/services/publish-proposal';
const schema=z.discriminatedUnion('action',[z.object({action:z.literal('publish'),expectedRevision:z.number().int().positive(),reviewHash:z.string().regex(/^[a-f0-9]{64}$/)}).strict(),z.object({action:z.literal('replace'),deliveryId:z.uuid()}).strict(),z.object({action:z.literal('report_unavailable'),deliveryId:z.uuid()}).strict()]);
export async function POST(request:NextRequest,{params}:{params:Promise<{proposalId:string}>}){try{const user=await mutationUser(request),{proposalId}=await params,input=await body(request,schema);if(input.action==='publish')return privateJson(await publishProposal(getPool(),user,proposalId,input.expectedRevision,input.reviewHash),202);if(input.action==='replace')return privateJson(await replacePublication(getPool(),user,proposalId,input.deliveryId),202);await reportDiscussionUnavailable(getPool(),user,proposalId,input.deliveryId);return privateJson({saved:true});}catch(e){return httpError(e);}}
