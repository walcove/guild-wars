import type {Tx} from '../db/client';
import {invariant} from '../../domain/errors';
import {proveTelegramLinkHashInTx} from '../services/link-telegram';
import {systemClock} from '../../domain/clock';
export interface CallbackActor {telegramId:string;chatId:string;chatType:string;messageId:string}
export interface CallbackReceipt {status:string;message:string;operationId?:string;[key:string]:unknown}
export async function linkCallback(tx:Tx,data:string,actor:CallbackActor):Promise<CallbackReceipt> {
 invariant(actor.chatType==='private'&&actor.chatId===actor.telegramId,'callback_context','Return to the bot’s private chat to confirm your own account');
 const digest=data.slice(2);invariant(/^[A-Za-z0-9_-]{43}$/.test(digest)&&Buffer.from(digest,'base64url').toString('base64url')===digest,'invalid_update','This connection button is invalid');
 await proveTelegramLinkHashInTx(tx,Buffer.from(digest,'base64url').toString('hex'),actor.telegramId,systemClock);
 return {status:'proved',message:'Telegram confirmed. Return to the original browser to finish; no trade was authorized.'};
}
