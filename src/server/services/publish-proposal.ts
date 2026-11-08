import type {Pool} from 'pg';
import {invariant} from '../../domain/errors';
import type {Tx} from '../db/client';
import {inGuild} from '../db/repositories';
import {enqueue} from '../jobs/queue';
import {snapshotProposalInTx,proposalGuild} from './proposals';
import {audit} from './audit';
import {discussionLink} from '../telegram/proposal-messages';
export interface PublicationDelivery {id:string;versionId:string;state:string}
export async function publishProposalInTx(tx:Tx,userId:string,proposalId:string,revision:number,reviewHash:string):Promise<PublicationDelivery> {
 const p=(await tx.query('SELECT id,guild_id,author_id FROM proposals WHERE id=$1',[proposalId])).rows[0];invariant(p?.author_id===userId,'forbidden','Only the author can publish their reviewed proposal');
 const operationId=`publish:${proposalId}:${reviewHash}`;
 const prior=(await tx.query<PublicationDelivery>('SELECT d.id,d.proposal_version_id AS "versionId",d.state FROM telegram_deliveries d JOIN operations o ON o.id=d.operation_id WHERE o.id=$1',[operationId])).rows[0];if(prior)return prior;
 const version=await snapshotProposalInTx(tx,userId,proposalId,revision,reviewHash),binding=(await tx.query('SELECT chat_id,topic_id,bot_id,active FROM group_bindings WHERE guild_id=$1 FOR SHARE',[p.guild_id])).rows[0];
 invariant(binding?.active&&binding.bot_id,'group_unavailable','A current verified bot/group binding is required to publish');
 await tx.query("INSERT INTO operations(id,kind,state,record) VALUES($1,'publish_proposal','queued',$2::jsonb)",[operationId,JSON.stringify({proposalId,versionId:version.id,guildId:p.guild_id,actorId:userId,botId:binding.bot_id})]);
 const delivery=(await tx.query<PublicationDelivery>("INSERT INTO telegram_deliveries(operation_id,proposal_version_id,chat_id,topic_id,state) VALUES($1,$2,$3,$4,'pending') RETURNING id,proposal_version_id AS \"versionId\",state",[operationId,version.id,binding.chat_id,binding.topic_id])).rows[0];
 await enqueue(tx,{task:'deliver_telegram',operationId,payload:{deliveryId:delivery.id}});await audit(tx,{actorId:userId,guildId:p.guild_id,kind:'proposal_publication_queued',recordId:version.id,reason:'Exact reviewed version and transactional outbox committed together'});return delivery;
}
export async function publishProposal(db:Pool,userId:string,id:string,revision:number,hash:string):Promise<PublicationDelivery>{return inGuild(db,userId,await proposalGuild(db,userId,id),tx=>publishProposalInTx(tx,userId,id,revision,hash));}
export async function publicationView(db:Pool,userId:string,proposalId:string,versionId:string){return inGuild(db,userId,await proposalGuild(db,userId,proposalId),async tx=>{
 invariant((await tx.query('SELECT id FROM proposal_versions WHERE proposal_id=$1 AND id=$2',[proposalId,versionId])).rowCount===1,'version_unavailable','Version unavailable for this proposal');
 const deliveries=(await tx.query<{id:string;state:string;chat_id:string;topic_id:string|null;message_id:string|null;replaces_id:string|null;created_at:Date}>('SELECT id,state,chat_id,topic_id,message_id,replaces_id,created_at FROM telegram_deliveries WHERE proposal_version_id=$1 ORDER BY created_at DESC,id DESC LIMIT 100',[versionId])).rows;
 const binding=(await tx.query<{chat_id:string;group_url:string|null;active:boolean}>('SELECT chat_id,group_url,active FROM group_bindings WHERE guild_id=(SELECT guild_id FROM proposals WHERE id=$1)',[proposalId])).rows[0];
 return {deliveries:deliveries.map(d=>({...d,discussionUrl:discussionLink(d,binding?.chat_id===d.chat_id?binding.group_url:null)})),groupUrl:binding?.active?binding.group_url:null};
 });}
export async function replacePublication(db:Pool,userId:string,proposalId:string,oldId:string):Promise<PublicationDelivery>{return inGuild(db,userId,await proposalGuild(db,userId,proposalId),async tx=>{
 const old=(await tx.query('SELECT d.*,p.author_id,p.guild_id FROM telegram_deliveries d JOIN proposal_versions v ON v.id=d.proposal_version_id JOIN proposals p ON p.id=v.proposal_id WHERE d.id=$1 AND p.id=$2 FOR UPDATE OF d',[oldId,proposalId])).rows[0];invariant(old?.author_id===userId,'forbidden','Only the author can request this replacement');
 const prior=(await tx.query<PublicationDelivery>('SELECT id,proposal_version_id AS "versionId",state FROM telegram_deliveries WHERE replaces_id=$1',[oldId])).rows[0];if(prior)return prior;
 invariant(['unknown','failed','blocked','reported_unavailable'].includes(old.state),'replacement_unavailable','Only an unavailable or uncertain publication can be explicitly replaced');
 const binding=(await tx.query('SELECT chat_id,topic_id,bot_id,active FROM group_bindings WHERE guild_id=$1 FOR SHARE',[old.guild_id])).rows[0];invariant(binding?.active&&binding.bot_id,'group_unavailable','Verify the current group before requesting a replacement');
 const operationId=`replace:${oldId}`;await tx.query("INSERT INTO operations(id,kind,state,record) VALUES($1,'publish_proposal','queued',$2::jsonb)",[operationId,JSON.stringify({proposalId,versionId:old.proposal_version_id,guildId:old.guild_id,actorId:userId,botId:binding.bot_id,replacesId:oldId})]);
 const replacement=(await tx.query<PublicationDelivery>("INSERT INTO telegram_deliveries(operation_id,proposal_version_id,chat_id,topic_id,state,replaces_id) VALUES($1,$2,$3,$4,'pending',$5) RETURNING id,proposal_version_id AS \"versionId\",state",[operationId,old.proposal_version_id,binding.chat_id,binding.topic_id,oldId])).rows[0];await enqueue(tx,{task:'deliver_telegram',operationId,payload:{deliveryId:replacement.id}});await audit(tx,{actorId:userId,guildId:old.guild_id,kind:'proposal_replacement_requested',recordId:old.proposal_version_id,reason:'Explicit marked replacement preserves the same canonical proposal version',record:{oldDeliveryId:oldId,newDeliveryId:replacement.id}});return replacement;
 });}
export async function reportDiscussionUnavailable(db:Pool,userId:string,proposalId:string,deliveryId:string):Promise<void>{await inGuild(db,userId,await proposalGuild(db,userId,proposalId),async tx=>{const row=(await tx.query("UPDATE telegram_deliveries d SET state='reported_unavailable' FROM proposal_versions v,proposals p WHERE d.id=$1 AND d.proposal_version_id=v.id AND v.proposal_id=p.id AND p.id=$2 AND p.author_id=$3 AND d.state='published' RETURNING d.id",[deliveryId,proposalId,userId])).rows[0];invariant(row,'publication_unavailable','Only the author may report their published message unavailable');await audit(tx,{actorId:userId,kind:'discussion_unavailable_reported',recordId:deliveryId,reason:'Author report only; no nonexistent Telegram getMessage API or automatic resend assumed'});});}
