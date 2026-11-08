import {Pool} from 'pg';
import {observePool} from '../db/client';
export const budgets={webConnections:10,criticalConnections:2,backgroundConnections:3,criticalHandlers:1,backgroundHandlers:3,attempts:5,requestTimeoutMs:8000} as const;
export function workerPools(connectionString:string) {
 const options={connectionString,connectionTimeoutMillis:1000,idleTimeoutMillis:30000,statement_timeout:5000};
 const pools={critical:new Pool({...options,max:budgets.criticalConnections,application_name:'guild-wars-critical'}),background:new Pool({...options,max:budgets.backgroundConnections,application_name:'guild-wars-background'})};
 for(const [partition,pool] of Object.entries(pools))observePool(pool,`worker-${partition}`);
 return pools;
}
export function lane(task:string):'critical'|'background' {return ['close_ballot','recover_due'].includes(task)?'critical':'background';}
export function queueName(task:string,id:string):string {return lane(task)==='critical'?'guild-critical':`guild-background-${[...id].reduce((sum,c)=>sum+c.charCodeAt(0),0)%3}`;}
