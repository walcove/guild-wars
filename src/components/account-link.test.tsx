// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {SWRConfig} from 'swr';
import {AccountLink} from './account-link';
afterEach(()=>{cleanup();sessionStorage.clear();vi.unstubAllGlobals();});
const json=(data:unknown,status=200)=>Promise.resolve(new Response(JSON.stringify(data),{status}));
it('retains exact proposal return context and explains original-browser recovery',async()=>{
 const fetcher=vi.fn().mockImplementationOnce(()=>json({userId:null,csrfToken:'csrf',telegramConfigured:true})).mockImplementationOnce(()=>json({token:'x'.repeat(43),expiresAt:'2100-01-01T00:00:00.000Z',botUrl:'https://t.me/SyntheticBot?start=opaque'})).mockImplementationOnce(()=>json({state:'proved',telegramId:'123'})).mockImplementationOnce(()=>json({error:'wrong_browser',message:'This connection began in another browser. Return there, or restart here.'},409));
 vi.stubGlobal('fetch',fetcher);render(<SWRConfig value={{provider:()=>new Map()}}><AccountLink returnPath="/proposals/plan-1?version=v1"/></SWRConfig>);
 await waitFor(()=>expect((screen.getByRole('button',{name:'Connect Telegram'}) as HTMLButtonElement).disabled).toBe(false));
 fireEvent.click(screen.getByRole('button',{name:'Connect Telegram'}));await screen.findByRole('link',{name:'Confirm in Telegram'});
 await waitFor(()=>expect((screen.getByRole('button',{name:'Finish in this browser'}) as HTMLButtonElement).disabled).toBe(false));fireEvent.click(screen.getByRole('button',{name:'Finish in this browser'}));
 expect(await screen.findByRole('alert')).toBeTruthy();expect(screen.getByText(/This connection began in another browser/)).toBeTruthy();
 expect(screen.getByText('/proposals/plan-1?version=v1')).toBeTruthy();
});
it('shows unavailable bot configuration without pretending a connection succeeded',async()=>{
 vi.stubGlobal('fetch',vi.fn(()=>json({userId:null,csrfToken:'csrf',telegramConfigured:false})));
 render(<SWRConfig value={{provider:()=>new Map()}}><AccountLink returnPath="/"/></SWRConfig>);await screen.findByText(/authorized test bot is not configured/);
 expect((screen.getByRole('button',{name:'Connect Telegram'}) as HTMLButtonElement).disabled).toBe(true);
});
