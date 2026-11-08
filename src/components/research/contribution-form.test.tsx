// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {SWRConfig} from 'swr';
import {ContributionForm} from './contribution-form';
afterEach(()=>{cleanup();sessionStorage.clear();vi.unstubAllGlobals();});
it('keeps the evidence draft and request ID when the service rejects a submission',async()=>{
 let sent:Record<string,unknown>|undefined;let calls=0;
 vi.stubGlobal('fetch',vi.fn(async(url:string,init?:RequestInit)=>{if(url==='/api/account/session')return {ok:true,json:async()=>({userId:'member',csrfToken:'synthetic-csrf'})};calls++;sent=JSON.parse(String(init?.body));return {ok:false,json:async()=>({message:'Unavailable; safely retry'})};}));
 render(<SWRConfig value={{provider:()=>new Map()}}><ContributionForm userId="member" guildId="guild" roundId="round" mode="simulation" onSaved={()=>{}}/></SWRConfig>);
 for(const [label,value] of [['Original source URL','https://status.solana.com/'],['What does the source support?','A synthetic claim for testing'],['What is uncertain?','Synthetic uncertainty'],['Your interests or positions','None; synthetic']])fireEvent.change(screen.getByLabelText(label),{target:{value}});
 const button=screen.getByRole('button',{name:'Save evidence'});await waitFor(()=>expect((button as HTMLButtonElement).disabled).toBe(false));fireEvent.click(button);
 await screen.findByText(/Unavailable; safely retry/);expect((screen.getByLabelText('What does the source support?') as HTMLTextAreaElement).value).toBe('A synthetic claim for testing');expect(sent?.requestId).toMatch(/^[a-f0-9-]{36}$/);
 const first=sent?.requestId;fireEvent.click(button);await waitFor(()=>expect(calls).toBe(2));expect(sent?.requestId).toBe(first);
});
