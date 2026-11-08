import {guildPageContext} from '@/src/server/services/guild-page-context';
import {AppShell} from '@/src/components/navigation/app-shell';
import {CohortRegistration} from '@/src/components/trading/cohort-registration';
import {pageUser} from '@/src/server/auth/page-session';
import {getPool} from '@/src/server/db/client';
import {cohortRegistrationView} from '@/src/server/services/live-enrollment';
export default async function Page({params}:{params:Promise<{guildId:string}>}){const {guildId}=await params,user=await pageUser(`/guilds/${guildId}/cohort`),initial=await cohortRegistrationView(getPool(),user,guildId);const shell=await guildPageContext(getPool(),user,guildId);return <AppShell guild={shell.guild} expectedUserId={user} guildId={guildId} context={shell.context+' · Real cohort registration'}><CohortRegistration initial={initial} userId={user}/></AppShell>;}
