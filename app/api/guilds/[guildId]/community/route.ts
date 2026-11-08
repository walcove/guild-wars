import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  body,
  mutationUser,
  privateJson,
  httpError,
  sessionCookie,
} from "@/src/server/auth/http";
import { readSession } from "@/src/server/auth/sessions";
import { getPool } from "@/src/server/db/client";
import { invariant } from "@/src/domain/errors";
import { forecastSchema } from "@/src/domain/research-awards";
import {
  readCommunity,
  registerForecast,
} from "@/src/server/services/forecasts";
import {
  bountySchema,
  submissionSchema,
  publishBounty,
  submitResearch,
} from "@/src/server/services/bounties";
import {
  decideResearchAward,
  appealResearchAward,
  requestResearchAssignments,
  declareResearchConflict,
} from "@/src/server/services/award-decisions";
import { setResearchDigest } from "@/src/server/jobs/research-digest";
import { telegramConfiguration } from "@/src/server/telegram/bot";
const schema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("request_assignments"),
      submissionId: z.uuid(),
    })
    .strict(),
  z
    .object({
      action: z.literal("declare_conflict"),
      submissionId: z.uuid(),
      reason: z.string().min(20).max(1500),
    })
    .strict(),
  z
    .object({
      action: z.literal("forecast"),
      requestId: z.uuid(),
      terms: forecastSchema,
      supersedesId: z.uuid().nullable().optional(),
    })
    .strict(),
  z
    .object({ action: z.literal("publish_bounty"), criteria: bountySchema })
    .strict(),
  z
    .object({ action: z.literal("submit_work"), submission: submissionSchema })
    .strict(),
  z
    .object({
      action: z.literal("decide"),
      submissionId: z.uuid(),
      decision: z
        .object({
          accept: z.boolean(),
          verifiedUseful: z.boolean(),
          reason: z.string().min(20).max(1500),
          verification: z.string().min(20).max(1500),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      action: z.literal("appeal"),
      submissionId: z.uuid(),
      reason: z.string().min(20).max(1500),
    })
    .strict(),
  z.object({ action: z.literal("digest"), active: z.boolean() }).strict(),
]);
type Context = { params: Promise<{ guildId: string }> };
export async function GET(request: NextRequest, { params }: Context) {
  try {
    const user = (
      await readSession(
        getPool(),
        request.cookies.get(sessionCookie)?.value ?? ""
      )
    ).userId;
    invariant(user, "unauthorized", "Connect Telegram first");
    return privateJson(
      await readCommunity(
        getPool(),
        user,
        (await params).guildId,
        request.nextUrl.searchParams.get("forecastCursor"),
        request.nextUrl.searchParams.get("submissionCursor"),
        request.nextUrl.searchParams.get("submission")
      )
    );
  } catch (e) {
    return httpError(e);
  }
}
export async function POST(request: NextRequest, { params }: Context) {
  try {
    const user = await mutationUser(request),
      { guildId } = await params,
      input = await body(request, schema, 16384);
    if (input.action === "forecast")
      return privateJson(
        await registerForecast(getPool(), user, guildId, input),
        201
      );
    if (input.action === "publish_bounty")
      return privateJson(
        await publishBounty(getPool(), user, guildId, input.criteria),
        201
      );
    if (input.action === "submit_work")
      return privateJson(
        await submitResearch(getPool(), user, guildId, input.submission),
        201
      );
    if (input.action === "digest") {
      await setResearchDigest(
        getPool(),
        user,
        guildId,
        input.active,
        input.active ? telegramConfiguration().botId : null
      );
      return privateJson({ state: "saved" });
    }
    invariant(
      (
        await getPool().query(
          "SELECT id FROM research_submissions WHERE id=$1 AND guild_id=$2",
          [input.submissionId, guildId]
        )
      ).rowCount,
      "submission_unavailable",
      "Submission unavailable in this guild"
    );
    if (input.action === "request_assignments")
      return privateJson(
        await requestResearchAssignments(getPool(), user, input.submissionId)
      );
    if (input.action === "declare_conflict")
      return privateJson(
        await declareResearchConflict(
          getPool(),
          user,
          input.submissionId,
          input.reason
        )
      );
    return privateJson(
      input.action === "decide"
        ? await decideResearchAward(
            getPool(),
            user,
            input.submissionId,
            input.decision
          )
        : await appealResearchAward(
            getPool(),
            user,
            input.submissionId,
            input.reason
          )
    );
  } catch (e) {
    return httpError(e);
  }
}
