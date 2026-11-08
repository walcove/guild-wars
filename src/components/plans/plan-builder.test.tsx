// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {SWRConfig} from 'swr';
import {PlanBuilder} from './plan-builder';
afterEach(()=>{cleanup();sessionStorage.clear();vi.unstubAllGlobals();});
it('retains research text when switching strikes and offers no editable expiration or personal amount',()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>({userId:'member',csrfToken:'csrf'})})));
 render(<SWRConfig value={{provider:()=>new Map()}}><PlanBuilder userId="member" guildId="guild" roundId="round" mode="simulation" expiresAt="2030-01-01T00:00:00.000Z" referenceLamports="10000000000" choices={[{id:'example-a',label:'Hypothetical $110'},{id:'example-b',label:'Hypothetical $115'}]}/></SWRConfig>);
 fireEvent.change(screen.getByLabelText('Why does this plan make sense?'),{target:{value:'My synthetic rationale'}});fireEvent.change(screen.getByLabelText('Agreed sale price'),{target:{value:'example-b'}});
 expect((screen.getByLabelText('Why does this plan make sense?') as HTMLTextAreaElement).value).toBe('My synthetic rationale');expect(screen.queryByLabelText('Expiration')).toBeNull();expect(screen.queryByLabelText('Your amount')).toBeNull();expect(screen.getByText(/Comparison: 1 SOL/)).toBeTruthy();
});
