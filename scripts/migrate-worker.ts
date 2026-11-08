import {observePool} from '../src/server/db/client';
import {Pool} from 'pg';
import {requireTestDatabaseUrl} from '../src/server/db/test-target';
import {configureWorkerDatabase} from '../src/server/db/worker-setup';
const db=observePool(new Pool({connectionString:requireTestDatabaseUrl(process.env.TEST_DATABASE_URL),max:1}),'worker-setup');
try{await configureWorkerDatabase(db);console.info('Graphile Worker setup and protected runtime permissions applied');}finally{await db.end();}
