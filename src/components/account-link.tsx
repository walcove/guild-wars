"use client";
import { useState, useMemo, useSyncExternalStore } from "react";
import { LocalTime } from "./ui/local-time";
import Link from "next/link";
import useSWR from "swr";
type Account = {
  userId: string | null;
  csrfToken: string;
  telegramConfigured: boolean;
};
type Challenge = { token: string; expiresAt: string; botUrl: string };
async function fetchJson(url: string) {
  const response = await fetch(url, {
      credentials: "same-origin",
      cache: "no-store",
    }),
    data = await response.json();
  if (!response.ok)
    throw Object.assign(new Error(data.message ?? "Connection unavailable"), {
      code: data.error,
      status: response.status,
    });
  return data;
}
const subscribeLink = (notify: () => void) => {
  for (const event of ["storage", "gw:link-changed", "gw:identity-changed"])
    window.addEventListener(event, notify);
  return () => {
    for (const event of ["storage", "gw:link-changed", "gw:identity-changed"])
      window.removeEventListener(event, notify);
  };
};
const storedLink = () => sessionStorage.getItem("gw:link");
function setChallenge(next: Challenge | null) {
  if (next) sessionStorage.setItem("gw:link", JSON.stringify(next));
  else sessionStorage.removeItem("gw:link");
  window.dispatchEvent(new Event("gw:link-changed"));
}
const clearIdentityState = () => {
  for (const key of Object.keys(sessionStorage))
    if (key.startsWith("gw:")) sessionStorage.removeItem(key);
  try {
    localStorage.setItem("gw:identity-version", crypto.randomUUID());
  } catch {}
  window.dispatchEvent(new Event("gw:identity-changed"));
};
export function AccountLink({ returnPath }: { returnPath: string }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [destination, setDestination] = useState(returnPath);
  const stored = useSyncExternalStore(subscribeLink, storedLink, () => null);
  const challenge = useMemo<Challenge | null>(() => {
    try {
      const saved = JSON.parse(stored ?? "null");
      return saved &&
        /^[A-Za-z0-9_-]{43}$/.test(saved.token) &&
        typeof saved.expiresAt === "string" &&
        typeof saved.botUrl === "string" &&
        saved.botUrl.startsWith("https://t.me/")
        ? saved
        : null;
    } catch {
      return null;
    }
  }, [stored]);
  const {
    data: account,
    error: sessionError,
    mutate: mutateAccount,
  } = useSWR<Account>("/api/account/session", fetchJson, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
    dedupingInterval: 0,
  });
  const { data: proof } = useSWR<{ state: string; telegramId?: string }>(
    challenge && !account?.userId
      ? ["/api/account/telegram-link", challenge.token]
      : null,
    ([url]: [string, string]) => fetchJson(url),
    {
      refreshInterval: 5000,
      refreshWhenHidden: false,
      refreshWhenOffline: false,
      shouldRetryOnError: false,
    }
  );
  const provedId = proof?.state === "proved" ? proof.telegramId : null;
  const displayError =
    error ||
    (sessionError
      ? "Connection unavailable. Check your network and retry; your original destination is retained."
      : proof?.state === "expired"
        ? "This connection expired. Restart it in this browser."
        : "");
  async function reload() {
    setBusy(true);
    setError("");
    try {
      if ((sessionError as { code?: string })?.code === "invalid_session") {
        const response = await fetch("/api/account/session", {
            method: "POST",
            credentials: "same-origin",
            cache: "no-store",
          }),
          next = await response.json();
        if (!response.ok)
          throw Error(next.message ?? "Browser connection was not restarted");
        clearIdentityState();
        setChallenge(null);
        await mutateAccount(next, { revalidate: false });
      } else await mutateAccount();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function send<T>(path: string, input: unknown): Promise<T> {
    const response = await fetch(path, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "X-GW-CSRF": account?.csrfToken ?? "",
        },
        body: JSON.stringify(input),
      }),
      data = await response.json();
    if (!response.ok)
      throw new Error(
        data.message ??
          "The request was not confirmed. Check your connection and retry."
      );
    return data;
  }
  async function begin() {
    setBusy(true);
    setError("");
    try {
      const next = await send<Challenge>("/api/account/telegram-link", {
        returnPath: destination,
        purpose: "sign_in",
      });
      setChallenge(next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function finish() {
    if (!challenge) return;
    setBusy(true);
    setError("");
    try {
      const result = await send<{
        userId: string;
        csrfToken: string;
        returnPath: string;
      }>("/api/account/telegram-link/confirm", {
        token: challenge.token,
        telegramId: provedId,
      });
      clearIdentityState();
      setChallenge(null);
      setDestination(result.returnPath);
      await mutateAccount(
        (previous) => ({
          ...previous!,
          userId: result.userId,
          csrfToken: result.csrfToken,
        }),
        { revalidate: false }
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    try {
      await send("/api/account/logout", {});
      clearIdentityState();
      setChallenge(null);
      await mutateAccount();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="Telegram connection">
      <p>1. Confirm in the bot. 2. Return to this browser to finish.</p>
      <p>
        Return after connecting: <span className="mono">{destination}</span>
      </p>
      {!account && !displayError && (
        <p role="status">Checking your connection…</p>
      )}
      {displayError && (
        <div className="status-notice error" role="alert">
          <strong>Connection not completed</strong>
          <p>{displayError}</p>
          <p>
            If Telegram opened a different browser, return to the original
            browser tab, or restart the connection here. Proof never transfers
            between browsers.
          </p>
          <button
            className="button"
            onClick={() => void reload()}
            disabled={busy}
          >
            Check connection again
          </button>
        </div>
      )}
      {account?.userId ? (
        <>
          <p role="status">
            Your Telegram account is connected. Guild membership is checked
            separately.
          </p>
          <div className="actions">
            <Link className="button primary" href={destination}>
              Continue to your original destination
            </Link>
            <button
              className="button"
              onClick={() => void logout()}
              disabled={busy}
            >
              Sign out
            </button>
          </div>
        </>
      ) : (
        <>
          {account && !account.telegramConfigured && (
            <p className="status-notice">
              A separate authorized test bot is not configured in this local
              environment. You can still explore the hypothetical calculator.
            </p>
          )}
          {challenge && (
            <div>
              <h2>Confirm, then come back</h2>
              <a
                href={challenge.botUrl}
                target="_blank"
                rel="noreferrer"
                className="button primary"
              >
                Confirm in Telegram
              </a>
              <p>
                Connection expires:{" "}
                <time dateTime={challenge.expiresAt}>
                  {new Date(challenge.expiresAt).toUTCString()}
                </time>
              </p>
              <p>
                Local time: <LocalTime iso={challenge.expiresAt} />. The server
                checks the deadline.
              </p>
              <p>
                {provedId
                  ? `Telegram account ${provedId} confirmed in the bot. Check this is your account before finishing.`
                  : "Waiting for your confirmation in the bot."}
              </p>
              <button
                className="button primary"
                onClick={() => void finish()}
                disabled={busy || !provedId}
              >
                Finish in this browser
              </button>
            </div>
          )}
          <button
            className="button"
            onClick={() => void begin()}
            disabled={busy || !account?.telegramConfigured}
          >
            {challenge ? "Restart connection" : "Connect Telegram"}
          </button>
          <p>
            No wallet, deposit, token or trade is required for simulation,
            research or voting.
          </p>
        </>
      )}
      {busy && account && <p role="status">Checking the saved connection…</p>}
    </section>
  );
}
