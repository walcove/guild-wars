import {GrammyError} from 'grammy';
import type {Pool} from 'pg';
import {transaction} from '../db/client';
import {publicBallotSnapshotInTx} from '../services/ballot-snapshot';
import {ballotCard,privateVoteCard} from '../telegram/ballot-messages';
import type {BotConfiguration,TelegramTransport} from '../telegram/webhook';
import {enqueue} from './queue';
export async function deliverBallotNotifications(db:Pool,operationId:string,config:BotConfiguration,transport:TelegramTransport):Promise<void>{
 const prepared=await transaction(db,async tx=>{
  const row=(await tx.query('SELECT d.*,o.record FROM ballot_deliveries d JOIN operations o ON o.id=d.operation_id WHERE operation_id=$1 FOR UPDATE OF d',[operationId])).rows[0];if(!row||['blocked','terminal'].includes(row.state)||(row.state==='pending'&&row.attempts>=5)||(!row.message_id&&['unknown','published'].includes(row.state)))return null;
  // A crash between send and acknowledgement is uncertain; never create another first message.
  if(row.state==='sending'&&!row.message_id){await tx.query("UPDATE ballot_deliveries SET state='unknown' WHERE operation_id=$1",[operationId]);return null;}
  const context=(await tx.query('SELECT b.rules,g.chat_id,g.bot_id,g.active FROM ballots b JOIN group_bindings g ON g.guild_id=b.guild_id WHERE b.id=$1 FOR SHARE OF g',[row.ballot_id])).rows[0];
  let permitted=context?.active&&context.bot_id===config.botId&&row.bot_id===config.botId&&context.rules.botId===config.botId;
  let card;
  if(row.kind==='private_receipt'){
   if(row.state==='published')return null;
   const receipt=(await tx.query(`SELECT e.revision,e.saved_at,c.label,c.proposal_version_id,u.telegram_id,g.name,r.number,r.mode FROM vote_events e JOIN ballot_choices c ON c.id=e.choice_id JOIN ballots b ON b.id=e.ballot_id JOIN guilds g ON g.id=b.guild_id JOIN rounds r ON r.id=b.round_id JOIN users u ON u.id=e.user_id JOIN memberships m ON m.guild_id=b.guild_id AND m.user_id=u.id AND m.status='active' JOIN bot_starts s ON s.bot_id=$4 AND s.telegram_id=u.telegram_id AND s.blocked_at IS NULL WHERE e.ballot_id=$1 AND e.user_id=$2 AND e.revision=$3`,[row.ballot_id,row.user_id,row.record.revision,config.botId])).rows[0];
   permitted=permitted&&receipt?.telegram_id===row.chat_id;if(receipt)card=privateVoteCard({ballotId:row.ballot_id,guildName:receipt.name,roundNumber:receipt.number,mode:receipt.mode,choiceLabel:receipt.label,revision:receipt.revision,savedAt:receipt.saved_at.toISOString(),proposalVersionId:receipt.proposal_version_id},config.origin);
  }else {permitted=permitted&&row.chat_id===context?.chat_id;if(row.kind==='result'&&row.state==='published')return null;card=ballotCard(await publicBallotSnapshotInTx(tx,row.ballot_id),config.origin);}
  if(card&&row.record.replaces)card={...card,text:'<b>Marked replacement · same canonical ballot</b>\n'+card.text};
  if(!permitted||!card){await tx.query("UPDATE ballot_deliveries SET state='blocked' WHERE operation_id=$1",[operationId]);return null;}
  // Only the known public ballot message is edited. Other deliveries are immutable receipts/results.
  const edit=row.kind==='ballot'&&!!row.message_id;if(edit&&!transport.edit)return null;
  await tx.query("UPDATE ballot_deliveries SET state='sending',attempts=attempts+1,last_attempt_at=clock_timestamp() WHERE operation_id=$1",[operationId]);return {row,card,edit};
 });if(!prepared)return;
 try{
  const {row,card,edit}=prepared;const sent=edit?await transport.edit!(row.chat_id,row.message_id,card.text,card.buttons):await transport.send(row.chat_id,card.text,card.buttons,row.topic_id);
  await transaction(db,async tx=>{await tx.query("UPDATE ballot_deliveries SET state='published',attempts=0,message_id=$2 WHERE operation_id=$1",[operationId,edit?row.message_id:sent!.messageId]);await tx.query("UPDATE operations SET state='complete' WHERE id=$1",[operationId]);});
 }catch(error){
  const unchanged=prepared.edit&&error instanceof GrammyError&&error.error_code===400&&error.description.includes('message is not modified');
  const retry=error instanceof GrammyError&&error.error_code===429,definitive=error instanceof GrammyError&&[400,403].includes(error.error_code);
  await transaction(db,async tx=>{await tx.query('UPDATE ballot_deliveries SET state=$2 WHERE operation_id=$1',[operationId,unchanged?'published':retry?'pending':definitive?'terminal':'unknown']);if(retry&&prepared.row.attempts<4)await enqueue(tx,{task:'deliver_ballot',operationId,payload:{ballotId:prepared.row.ballot_id},runAt:new Date(Date.now()+Math.max(1,Math.min(3600,(error as GrammyError).parameters.retry_after??30))*1000).toISOString()});});
 }
}
