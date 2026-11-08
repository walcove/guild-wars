// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen,waitFor,act} from '@testing-library/react';
import useSWR,{SWRConfig} from 'swr';
import {PrivateIdentityGuard} from './private-identity-guard';
const {refresh}=vi.hoisted(()=>({refresh:vi.fn()}));vi.mock('next/navigation',()=>({useRouter:()=>({refresh})}));
afterEach(()=>{cleanup();sessionStorage.clear();refresh.mockClear();});
it('clears private cached evidence and drafts when another tab changes identity',async()=>{
 const key=['gw-private','old-member','guild','simulation','round',1],cache=new Map();
 function Data(){const {data}=useSWR(key,async()=>'Private synthetic evidence',{revalidateOnFocus:false});return <p>{data??'Nothing cached'}</p>;}
 sessionStorage.setItem('gw:draft:old-member:guild','Sensitive synthetic draft');
 render(<SWRConfig value={{provider:()=>cache}}><PrivateIdentityGuard/><Data/></SWRConfig>);await screen.findByText('Private synthetic evidence');
 await act(async()=>{window.dispatchEvent(new StorageEvent('storage',{key:'gw:identity-version',newValue:'new-session'}));});
 expect(refresh).toHaveBeenCalled();expect(cache.size).toBe(0);await screen.findByText('Nothing cached');expect(sessionStorage.getItem('gw:draft:old-member:guild')).toBeNull();await waitFor(()=>expect(refresh).toHaveBeenCalled());
});
it('discards an old identity response that finishes after the cache has been cleared',async()=>{
 let finish!:(value:string)=>void;const pending=new Promise<string>(resolve=>{finish=resolve;}),fetcher=vi.fn(()=>pending),cache=new Map();
 function Data(){const {data}=useSWR(['gw-private','old-member','guild','simulation','late',1],fetcher);return <p>{data??'Nothing cached'}</p>;}
 render(<SWRConfig value={{provider:()=>cache}}><PrivateIdentityGuard/><Data/></SWRConfig>);await waitFor(()=>expect(fetcher).toHaveBeenCalledOnce());
 await act(async()=>{window.dispatchEvent(new StorageEvent('storage',{key:'gw:identity-version'}));finish('Old private response');await pending;});
 expect(screen.queryByText('Old private response')).toBeNull();expect(screen.getByText('Nothing cached')).toBeTruthy();expect(cache.size).toBe(0);
});
