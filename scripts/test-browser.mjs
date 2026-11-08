import {spawn,spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {requireTestDatabaseUrl} from '../src/server/db/test-target.ts';
try{process.loadEnvFile('.env.local');}catch(error){if(error.code!=='ENOENT')throw error;}
const target=requireTestDatabaseUrl(process.env.TEST_DATABASE_URL),runtime=new URL(target);runtime.username='guild_wars_app';runtime.password='local_app_only';
const image='mcr.microsoft.com/playwright:v1.65.0-noble@sha256:6e3fb709361521eb27161606e6da6d2674e5e89fa16516cb37d6fdd91372273d',name='guild-wars-browser-'+randomUUID().slice(0,8);
function docker(args){const r=spawnSync('docker',args,{encoding:'utf8',timeout:180000});if(r.status!==0)throw Error(r.stderr||'Local Docker browser command failed');return r.stdout.trim();}
let created=false;
try{
 docker(['run','--rm','-d','--name',name,'--init','--user','pwuser','--workdir','/home/pwuser','--shm-size=512m','-p','127.0.0.1::3001',image,'/bin/sh','-c','npx --yes playwright@1.65.0 run-server --port 3001 --host 0.0.0.0']);created=true;
 const address=docker(['port',name,'3001/tcp']);if(!/^127\.0\.0\.1:\d+$/.test(address))throw Error('Test browser must be reachable only through loopback');
 let ready=false;for(let i=0;i<180&&!ready;i++){try{const response=await fetch(`http://${address}/`,{signal:AbortSignal.timeout(400)});await response.body?.cancel();ready=true;}catch{}if(!ready)await new Promise(r=>setTimeout(r,250));}
 if(!ready)throw Error('The isolated Playwright server did not become ready');
 console.info('Running isolated Linux Chromium against the local app; external data, Telegram sends and live preparation are disabled.');
 const child=spawn('npm',['run','test:e2e','--',...process.argv.slice(2)],{stdio:'inherit',env:{...process.env,DATABASE_URL:runtime.toString(),APP_ORIGIN:'http://127.0.0.1:3000',TELEGRAM_BOT_TOKEN:'',TELEGRAM_WEBHOOK_SECRET:'',TELEGRAM_BOT_USERNAME:'',COINGECKO_API_KEY:'',PW_TEST_CONNECT_WS_ENDPOINT:`ws://${address}/`,PW_TEST_CONNECT_EXPOSE_NETWORK:'<loopback>',GW_DATA_ENABLED:'false',GW_TELEGRAM_SENDING_ENABLED:'false',GW_LIVE_PREPARATION_ENABLED:'false',NEXT_TELEMETRY_DISABLED:'1'}});
 process.exitCode=await new Promise((resolve,reject)=>{child.once('exit',code=>resolve(code??1));child.once('error',reject);});
}finally{if(created)spawnSync('docker',['stop','--time','3',name],{stdio:'ignore',timeout:15000});}
