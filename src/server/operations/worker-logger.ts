import {Logger} from 'graphile-worker';
import {logEvent} from './logging';
// Library messages/meta can embed provider errors and raw task payloads.
export const workerLogger=new Logger(()=>level=>{if(level!=='debug')logEvent('worker','library_'+level);});
