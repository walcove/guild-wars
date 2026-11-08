import {deliverProposal} from './publish-telegram';
import {refreshMarket} from './refresh-market';
import {deliverCommand} from '../telegram/commands';
import {telegramConfiguration,telegramTransport} from '../telegram/bot';
import {run,type TaskList} from 'graphile-worker';
import type {Pool} from 'pg';
import {transaction} from '../db/client';
import {recoverDue,recoverPublishedRounds} from './scheduler';
import {tasks} from './queue';
import {lane,budgets,workerPools} from './budgets';
export function handlers(db:Pool,partition:'critical'|'background',installed:TaskList={}):TaskList {
 return Object.fromEntries(tasks.filter(task=>lane(task)===partition).map(task=>[task,installed[task]??(task==='deliver_telegram'?async(payload:unknown)=>{await deliverProposal(db,(payload as {deliveryId:string}).deliveryId,telegramConfiguration(),telegramTransport());}:task==='refresh_market'?async()=>{await refreshMarket(db);}:task==='telegram_command'?async(payload:unknown)=>{await deliverCommand(db,(payload as {operationId:string}).operationId,telegramConfiguration(),telegramTransport());}:task==='recover_due'?async()=>{await recoverPublishedRounds(db);await transaction(db,recoverDue);}:async()=>{throw new Error(`Handler ${task} is not installed; operation retained for retry`);})]));
}
export async function startJobRunners(connectionString:string,installed:TaskList={}) {
 const pools=workerPools(connectionString);
 const critical=await run({pgPool:pools.critical,taskList:handlers(pools.critical,'critical',installed),concurrency:budgets.criticalHandlers,noHandleSignals:true,pollInterval:250,crontab:'* * * * * recover_due'});
 let background;
 try {background=await run({pgPool:pools.background,taskList:handlers(pools.background,'background',installed),concurrency:budgets.backgroundHandlers,noHandleSignals:true,pollInterval:1000,parsedCronItems:[]});}
 catch(error){await critical.stop();await Promise.all([pools.critical.end(),pools.background.end()]);throw error;}
 const promise=Promise.all([critical.promise,background.promise]);
 let stopped:Promise<void>|undefined;
 return {promise,stop:()=>stopped??=(async()=>{await Promise.all([critical.stop(),background.stop()]);await Promise.all([pools.critical.end(),pools.background.end()]);})()};
}
