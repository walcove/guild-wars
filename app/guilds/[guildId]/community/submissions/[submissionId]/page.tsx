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
  params: Promise<{ guildId: string; submissionId: string }>;
}) {
  const { guildId, submissionId } = await params,
    user = await pageUser(
      `/guilds/${guildId}/community/submissions/${submissionId}`
    ),
    v = await readCommunity(getPool(), user, guildId, null, null, submissionId);
  return (
    <AppShell expectedUserId={user}
      guild={v.guildName}
      guildId={guildId}
      context="Community research · Exact submission and appeal"
    >
      <ResearchCommunity
        initial={JSON.parse(JSON.stringify(v)) as CommunityView}
        userId={user}
        focusSubmissionId={submissionId}
      />
    </AppShell>
  );
}
