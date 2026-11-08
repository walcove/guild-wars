import type {Tx} from '../db/client';
import {DomainError} from '../../domain/errors';
import type {CallbackActor,CallbackReceipt} from './callbacks';
import {castVoteInTx} from '../services/ballots';
// Expected pre-write rejections are explicit feedback. SQL/transport errors remain unconfirmed.
export async function ballotCallback(tx:Tx,token:string,actor:CallbackActor,botId:string):Promise<CallbackReceipt>{
 await tx.query('SAVEPOINT ballot_callback');
 try{const saved=await castVoteInTx(tx,token,actor,botId);await tx.query('RELEASE SAVEPOINT ballot_callback');return saved;}
 catch(error){await tx.query('ROLLBACK TO SAVEPOINT ballot_callback');await tx.query('RELEASE SAVEPOINT ballot_callback');if(!(error instanceof DomainError))throw error;
  const status=error.code==='ballot_closed'?(error.message.includes('superseded')?'superseded':'closed'):error.code==='ineligible'?'ineligible':['invalid_button','callback_context','ballot_not_open','group_unavailable','invalid_ballot','house_unavailable'].includes(error.code)?'unsaved':null;
  if(!status)throw error;return {status,message:error.message};
 }
}
