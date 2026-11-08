import {AppShell} from '@/src/components/navigation/app-shell';
import {OutcomeExplorer} from '@/src/components/research/outcome-explorer';
import {StatusNotice} from '@/src/components/ui/status-notice';
export default function Learn(){return <AppShell context="Public learning example · No guild round"><h1>See the whole outcome</h1><p>Own SOL → choose strike and expiry → receive premium → compare the outcome with holding.</p><StatusNotice title="Teaching data, never a quote">This calculator uses synthetic prices and assumes delivery at expiration. Provider contract terms, size increments and costs have not been verified. No order can be placed here.</StatusNotice><OutcomeExplorer/></AppShell>;}
