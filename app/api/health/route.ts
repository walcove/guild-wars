import {getPool} from '@/src/server/db/client';
import {readHealth} from '@/src/server/operations/health';
export async function GET(request:Request){
 const ready=new URL(request.url).searchParams.get('ready')==='1';
 let healthy=true;if(ready){try{healthy=(await readHealth(getPool())).ready;}catch{healthy=false;}}
 return Response.json({status:ready?(healthy?'ready':'degraded'):'running'},{status:healthy?200:503,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
