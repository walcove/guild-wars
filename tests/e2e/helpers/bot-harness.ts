import {createServer,type Server} from 'node:http';
export const syntheticBotToken='9001:original_synthetic_loopback_token';
export interface BotHttpCall {method:string;payload:Record<string,unknown>}
export class BotHttpHarness {
 readonly calls:BotHttpCall[]=[];readonly members=new Map<string,string>();private server:Server;private nextMessage=40;private errorNext:Record<string,{code:number;description:string}>={};root='';
 constructor(){this.server=createServer(async(req,res)=>{const chunks:Buffer[]=[];let bytes=0;for await(const chunk of req){bytes+=chunk.length;if(bytes>65536){res.writeHead(413).end();return;}chunks.push(chunk);}let payload:Record<string,unknown>={};try{payload=JSON.parse(Buffer.concat(chunks).toString());}catch{payload=Object.fromEntries(new URLSearchParams(Buffer.concat(chunks).toString()));}const method=(req.url??'').split('/').at(-1)!;if(!(req.url??'').startsWith('/bot'+syntheticBotToken+'/')){res.writeHead(404).end();return;}this.calls.push({method,payload});res.setHeader('content-type','application/json');const failure=this.errorNext[method];if(failure){delete this.errorNext[method];res.writeHead(failure.code).end(JSON.stringify({ok:false,error_code:failure.code,description:failure.description,parameters:failure.code===429?{retry_after:1}:undefined}));return;}let result:unknown;
 if(method==='sendMessage'||method==='editMessageText')result={message_id:method==='sendMessage'?++this.nextMessage:Number(payload.message_id),date:Math.floor(Date.now()/1000),chat:{id:Number(payload.chat_id),type:Number(payload.chat_id)<0?'supergroup':'private'},text:payload.text};
 else if(method==='answerCallbackQuery')result=true;
 else if(method==='getChat')result={id:Number(payload.chat_id),type:'supergroup',title:'Original synthetic loopback community',username:'synthetic_guild',is_forum:false};
 else if(method==='getChatMember'){const id=String(payload.user_id),status=id==='9001'?'administrator':this.members.get(id)??'member';result={status,user:{id:Number(id),is_bot:id==='9001',first_name:'Synthetic'},can_be_edited:false};}
 else {res.writeHead(404).end(JSON.stringify({ok:false,error_code:404,description:'Unsupported method in synthetic loopback harness'}));return;}res.end(JSON.stringify({ok:true,result}));});}
 async start(){await new Promise<void>(resolve=>this.server.listen(0,'127.0.0.1',resolve));const a=this.server.address();if(!a||typeof a==='string')throw Error('Loopback server did not bind');this.root=`http://127.0.0.1:${a.port}`;return this;}
 failOnce(method:string,code:number,description:string){this.errorNext[method]={code,description};}
 async stop(){this.server.closeAllConnections();await new Promise<void>((resolve,reject)=>this.server.close(error=>error?reject(error):resolve()));}
}
