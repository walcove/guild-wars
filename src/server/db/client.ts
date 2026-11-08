import { Pool, type PoolClient } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
export type Tx = Pick<PoolClient,'query'>;
export function observePool(pool:Pool,component:string):Pool {
 const report=()=>console.error(JSON.stringify({component,event:'pool_error'}));
 pool.on('error',report);pool.on('connect',client=>client.on('error',report));return pool;
}
let pool:Pool|undefined;
export function getPool():Pool {
 if(!process.env.DATABASE_URL) throw new Error('Database is not configured');
 return pool??=observePool(new Pool({connectionString:process.env.DATABASE_URL,max:10,connectionTimeoutMillis:1000,idleTimeoutMillis:30000,statement_timeout:5000,application_name:'guild-wars-web'}),'web-database');
}
export async function transaction<T>(db:Pool,work:(tx:Tx)=>Promise<T>):Promise<T> {
 const client=await db.connect();
 try {await client.query('BEGIN');const result=await work(client);await client.query('COMMIT');return result;}
 catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}
export function drizzleFor(tx:PoolClient) { return drizzle(tx); }
