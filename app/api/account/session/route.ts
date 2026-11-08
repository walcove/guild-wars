import type { NextRequest } from "next/server";
import { getPool } from "@/src/server/db/client";
import {
  newBrowserSession,
  readSession,
  type BrowserSession,
} from "@/src/server/auth/sessions";
import {
  sessionCookie,
  csrfCookie,
  privateJson,
  setSessionCookies,
  setCsrfCookie,
  sessionCsrf,
  httpError,
} from "@/src/server/auth/http";
import { invariant } from "@/src/domain/errors";
function result(
  request: NextRequest,
  credentials: BrowserSession,
  created: boolean
) {
  const response = privateJson({
    userId: credentials.userId,
    csrfToken: credentials.csrfToken,
    telegramConfigured: Boolean(
      process.env.TELEGRAM_BOT_USERNAME &&
      process.env.TELEGRAM_BOT_TOKEN &&
      process.env.TELEGRAM_WEBHOOK_SECRET &&
      process.env.GW_TELEGRAM_SENDING_ENABLED === "true"
    ),
  });
  if (created) setSessionCookies(response, credentials);
  else if (request.cookies.get(csrfCookie)?.value !== credentials.csrfToken)
    setCsrfCookie(response, credentials.csrfToken);
  return response;
}
async function existing(request: NextRequest): Promise<BrowserSession | null> {
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) return null;
  const s = await readSession(getPool(), token);
  return {
    sessionToken: token,
    csrfToken: await sessionCsrf(
      token,
      request.cookies.get(csrfCookie)?.value,
      s.csrfHash
    ),
    userId: s.userId,
  };
}
export async function GET(request: NextRequest) {
  try {
    invariant(
      request.headers.get("sec-fetch-site") !== "cross-site",
      "csrf",
      "Open Guild Wars directly to connect"
    );
    const credentials = await existing(request);
    if (credentials) return result(request, credentials, false);
    return result(request, await newBrowserSession(getPool()), true);
  } catch (e) {
    return httpError(e);
  }
}
// Expired sessions restart only through an explicit same-origin browser action. A delayed old GET
// must never mint a guest or echo an old authentication cookie over a newly confirmed session.
export async function POST(request: NextRequest) {
  try {
    invariant(
      request.headers.get("sec-fetch-site") !== "cross-site" &&
        request.headers.get("origin") ===
          (process.env.APP_ORIGIN ?? "http://127.0.0.1:3000"),
      "csrf",
      "Restart the connection in its original browser"
    );
    let credentials: BrowserSession | null = null;
    try {
      credentials = await existing(request);
    } catch (e) {
      if ((e as { code?: string }).code !== "invalid_session") throw e;
    }
    return credentials
      ? result(request, credentials, false)
      : result(request, await newBrowserSession(getPool()), true);
  } catch (e) {
    return httpError(e);
  }
}
