import {DomainError} from '../../domain/errors';
export async function readLimitedText(request:Pick<Request,'body'>,limit:number):Promise<string> {
 if(!request.body)return '';
 const reader=request.body.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});let bytes=0,text='';
 try {
  while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>limit){await reader.cancel();throw new DomainError('invalid_input','Request exceeds its permitted size');}text+=decoder.decode(part.value,{stream:true});}
  return text+decoder.decode();
 }catch(error){if(error instanceof DomainError)throw error;await reader.cancel().catch(()=>{});throw new DomainError('invalid_input','Request could not be read safely');}
 finally{reader.releaseLock();}
}
