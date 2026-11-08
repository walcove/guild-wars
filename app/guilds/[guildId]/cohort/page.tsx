import {AppShell} from '@/src/components/navigation/app-shell';
import {CohortRegistration} from '@/src/components/trading/cohort-registration';
import {pageUser} from '@/src/server/auth/page-session';
import {getPool} from '@/src/server/db/client';
import {cohortRegistrationView} from '@/src/server/services/live-enrollment';
export default async function Page({params}:{params:Promise<{guildId:string}>}){const {guildId}=await params,user=await pageUser(`/guilds/${guildId}/cohort`),initial=await cohortRegistrationView(getPool(),user,guildId);return <AppShell expectedUserId={user} guildId={guildId} context="Real cohort · read access is separate from trade authority"><CohortRegistration initial={initial} userId={user}/></AppShell>;}
