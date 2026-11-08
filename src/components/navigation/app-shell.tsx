import {PrivateIdentityGuard} from './private-identity-guard';
import {PrivateContentBoundary} from './private-content-boundary';
import Link from 'next/link';
import {GuildNav} from './guild-nav';
export function AppShell({children,guild,guildId,context,expectedUserId,ownerAccess=false}:{children:React.ReactNode;guild?:string;guildId?:string;context?:string;expectedUserId?:string;ownerAccess?:boolean}){
 const content=<><div className="context-bar"><span>{guild??'Your guild starts with a conversation'}</span><span>{context??'Local development · Live trading unavailable'}</span></div><GuildNav guildId={guildId}/><main id="main" tabIndex={-1}>{children}</main><footer>Research together. Each member controls their own funds.</footer></>;
 return <><PrivateIdentityGuard/><a href="#main" className="skip-link">Skip to content</a><header className="app-header"><Link className="wordmark" href="/">Guild Wars</Link><span className="product-label">SOL covered calls</span><Link href="/connect" aria-label="Telegram account"><span className="account-wide">Telegram account</span><span className="account-short" aria-hidden="true">Account</span></Link></header>{expectedUserId?<PrivateContentBoundary key={crypto.randomUUID()} expectedUserId={expectedUserId} guildId={ownerAccess?undefined:guildId}>{content}</PrivateContentBoundary>:content}</>;
}
