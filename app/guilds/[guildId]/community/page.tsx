import { AppShell } from "@/src/components/navigation/app-shell";
import {
  ResearchCommunity,
  type CommunityView,
} from "@/src/components/community/research-community";
import { pageUser } from "@/src/server/auth/page-session";
import { getPool } from "@/src/server/db/client";
import { readCommunity } from "@/src/server/services/forecasts";
export default async function Page({
  params,
}: {
  params: Promise<{ guildId: string }>;
}) {
  const { guildId } = await params,
    user = await pageUser(`/guilds/${guildId}/community`),
    v = await readCommunity(getPool(), user, guildId);
  return (
    <AppShell expectedUserId={user}
      guild={v.guildName}
      guildId={guildId}
      context={`Community research · UTC week of ${v.week}`}
    >
      <ResearchCommunity
        initial={JSON.parse(JSON.stringify(v)) as CommunityView}
        userId={user}
      />
    </AppShell>
  );
}
