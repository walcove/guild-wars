import { AppShell } from "@/src/components/navigation/app-shell";
import { StatusNotice } from "@/src/components/ui/status-notice";
export default function Connect() { return <AppShell><h1>Connect your Telegram account</h1><p>1. Confirm in the bot. 2. Return to this browser to finish.</p><StatusNotice title="Connection setup is not yet available">A separate authorized test bot and session services are required. Research and voting will not require a wallet.</StatusNotice></AppShell>; }
