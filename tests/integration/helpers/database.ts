import {Pool,type PoolClient} from 'pg';
import {observePool} from '../../../src/server/db/client';
import { requireTestDatabaseUrl } from '../../../src/server/db/test-target';
export function testPool():Pool {const pool=new Pool({connectionString:requireTestDatabaseUrl(process.env.TEST_DATABASE_URL),max:4,connectionTimeoutMillis:1000,statement_timeout:5000});return observePool(pool,'test-database');}
export async function expectConstraint(client:PoolClient,sql:string,values:unknown[]=[]) {
 await client.query('SAVEPOINT expected_constraint');let caught=false;
 try{await client.query(sql,values);}catch(error){caught=true;if(!/23|P0001/.test(String((error as {code?:string}).code))) throw error;}
 finally{await client.query('ROLLBACK TO SAVEPOINT expected_constraint');}
 if(!caught) throw new Error('Expected PostgreSQL constraint to reject this write');
}
