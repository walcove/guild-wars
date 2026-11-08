import {PrivateIdentityGuard} from './private-identity-guard';
import Link from "next/link";
import { GuildNav } from "./guild-nav";
export function AppShell({ children, guild, guildId, context }: { children: React.ReactNode; guild?: string; guildId?: string; context?: string }) {
 return <><PrivateIdentityGuard/><a href="#main" className="skip-link">Skip to content</a><header className="app-header"><Link className="wordmark" href="/">Guild Wars</Link><span className="product-label">SOL covered calls</span><Link href="/connect">Connect Telegram</Link></header><div className="context-bar"><span>{guild ?? "Your guild starts with a conversation"}</span><span>{context ?? "Local development · Live trading unavailable"}</span></div><GuildNav guildId={guildId}/><main id="main" tabIndex={-1}>{children}</main><footer>Research together. Each member controls their own funds.</footer></>;
}
