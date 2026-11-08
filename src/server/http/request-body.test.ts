import {expect,it} from 'vitest';
import {readLimitedText} from './request-body';
it('cancels an oversized stream without buffering the whole request',async()=>{
 let pulls=0,cancelled=false;
 const stream=new ReadableStream<Uint8Array<ArrayBuffer>>({pull(controller){pulls++;if(pulls<=10)controller.enqueue(new Uint8Array(1024));else controller.close();},cancel(){cancelled=true;}});
 await expect(readLimitedText({body:stream},1024)).rejects.toMatchObject({code:'invalid_input'});
 expect(cancelled).toBe(true);expect(pulls).toBeLessThan(10);
});
it('preserves UTF-8 split between network chunks',async()=>{
 const bytes=new TextEncoder().encode('😀');
 const body=new ReadableStream<Uint8Array<ArrayBuffer>>({start(c){c.enqueue(bytes.slice(0,2));c.enqueue(bytes.slice(2));c.close();}});
 expect(await readLimitedText({body},10)).toBe('😀');
});
