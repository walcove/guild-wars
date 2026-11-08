"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  browserJson,
  BrowserRequestError,
  guildMutation,
} from "../guild-invitation";
import { LocalTime } from "../ui/local-time";
import type { ForecastTerms } from "../../domain/research-awards";
interface Submission {
  id: string;
  authorId: string;
  record: {
    summary: string;
    evidenceUrl: string;
    verificationPlan: string;
    disclosures: string;
  };
  outcome: {
    id: string;
    accepted: boolean;
    reason: string;
    generation: number;
    appealClosesAt: string;
  } | null;
  appealPending: boolean;
  recognized: boolean;
  appeals: number;
}
export interface CommunityView {
  guildId: string;
  guildName: string;
  week: string;
  checkedAt: string;
  canCoordinate: boolean;
  nextForecastCursor: string | null;
  nextSubmissionCursor: string | null;
  remainingForecasts: number;
  forecasts: {
    id: string;
    authorId: string;
    terms: ForecastTerms;
    state: string;
    outcome: { result: string; dataClass: string; revision: string } | null;
    supersedesId: string | null;
  }[];
  bounty: {
    id: string;
    criteria: {
      question: string;
      acceptanceCriteria: string;
      sourceRequirements: string;
      deadline: string;
      budget: string;
    };
  } | null;
  submissions: Submission[];
  assignments: {
    id: string;
    submissionId: string;
    generation: number;
    decided: boolean;
  }[];
  recognition: {
    learningXp: number;
    researchReputation: number;
    seasonPoints: string;
  };
  budget: string;
  digest: {
    botConfigured: boolean;
    privateStarted: boolean;
    active: boolean;
    sendingEnabled: boolean;
  };
}
function fields(form: HTMLFormElement) {
  return Object.fromEntries(new FormData(form).entries());
}
export function ResearchCommunity({
  initial,
  userId,
  focusSubmissionId,
}: {
  initial: CommunityView;
  userId: string;
  focusSubmissionId?: string;
}) {
  const { data, error, mutate } = useSWR<CommunityView>(
      [
        "gw-private",
        userId,
        initial.guildId,
        focusSubmissionId ?? "all",
        "community",
      ],
      () =>
        browserJson(
          `/api/guilds/${initial.guildId}/community${focusSubmissionId ? "?submission=" + focusSubmissionId : ""}`
        ),
      {
        fallbackData: initial,
        refreshInterval: 30000,
        refreshWhenHidden: false,
        refreshWhenOffline: false,
        shouldRetryOnError: false,
      }
    ),
    { data: session } = useSWR("/api/account/session", browserJson, {
      shouldRetryOnError: false,
    }),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [failed, setFailed] = useState(false),
    [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [olderForecasts, setOlderForecasts] = useState<
      CommunityView["forecasts"]
    >([]),
    [olderSubmissions, setOlderSubmissions] = useState<Submission[]>([]),
    [forecastCursor, setForecastCursor] = useState<string | null | undefined>(),
    [submissionCursor, setSubmissionCursor] = useState<
      string | null | undefined
    >(),
    [loadingHistory, setLoadingHistory] = useState(false);
  const v = data ?? initial,
    allForecasts = [...v.forecasts, ...olderForecasts].filter(
      (f, i, a) => a.findIndex((x) => x.id === f.id) === i
    ),
    allSubmissions = [...v.submissions, ...olderSubmissions].filter(
      (f, i, a) => a.findIndex((x) => x.id === f.id) === i
    ),
    ready = !!session?.csrfToken && !busy;
  async function save(input: unknown, form?: HTMLFormElement) {
    setBusy(true);
    setNotice("");
    setFailed(false);
    try {
      await guildMutation(
        `/api/guilds/${initial.guildId}/community`,
        input,
        session?.csrfToken ?? ""
      );
      setNotice(
        "Saved to the shared research record. No trade or valuable reward was authorized."
      );
      setRequestId(crypto.randomUUID());
      setOlderForecasts([]);
      setOlderSubmissions([]);
      setForecastCursor(undefined);
      setSubmissionCursor(undefined);
      form?.reset();
      await mutate();
    } catch (e) {
      setFailed(true);
      setNotice((e as Error).message + " Your form text is retained.");
    } finally {
      setBusy(false);
    }
  }
  async function loadHistory(kind: "forecast" | "submission") {
    const cursor =
      kind === "forecast"
        ? forecastCursor === undefined
          ? v.nextForecastCursor
          : forecastCursor
        : submissionCursor === undefined
          ? v.nextSubmissionCursor
          : submissionCursor;
    if (!cursor) return;
    setLoadingHistory(true);
    try {
      const page = (await browserJson(
        `/api/guilds/${v.guildId}/community?${kind}Cursor=${encodeURIComponent(cursor)}`
      )) as CommunityView;
      if (kind === "forecast") {
        setOlderForecasts((old) => [...old, ...page.forecasts]);
        setForecastCursor(page.nextForecastCursor);
      } else {
        setOlderSubmissions((old) => [...old, ...page.submissions]);
        setSubmissionCursor(page.nextSubmissionCursor);
      }
    } catch (e) {
      setFailed(true);
      setNotice(
        (e as Error).message + " Previously loaded history remains visible."
      );
    } finally {
      setLoadingHistory(false);
    }
  }
  function forecast(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = e.currentTarget,
      { supersedesId, ...d } = fields(f);
    try {
      const terms = {
        ...d,
        confidence: Number(d.confidence),
        deadline: new Date(String(d.deadline)).toISOString(),
      };
      void save(
        {
          action: "forecast",
          requestId,
          terms,
          supersedesId: String(supersedesId ?? "").trim() || null,
        },
        f
      );
    } catch {
      setFailed(true);
      setNotice(
        "Choose a valid future local date and time. Your text is retained."
      );
    }
  }
  function work(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = e.currentTarget,
      { target, ...d } = fields(f);
    void save(
      {
        action: "submit_work",
        submission: {
          ...d,
          requestId,
          bountyId: target === "bounty" ? (v.bounty?.id ?? null) : null,
          forecastId: null,
          conflictedUserIds: String(d.conflictedUserIds ?? "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        },
      },
      f
    );
  }
  function publish(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = e.currentTarget,
      d = fields(f);
    try {
      void save(
        {
          action: "publish_bounty",
          criteria: {
            ...d,
            deadline: new Date(String(d.deadline)).toISOString(),
            budget: "recognition_only",
          },
        },
        f
      );
    } catch {
      setFailed(true);
      setNotice(
        "Choose a valid future bounty deadline. Your text is retained."
      );
    }
  }
  if (error instanceof BrowserRequestError && [401, 403].includes(error.status))
    return (
      <p role="alert">
        Community records are unavailable for this account.{" "}
        <Link href="/connect">Check your connection</Link>.
      </p>
    );
  return (
    <>
      <p className="section-label">Community research · UTC week of {v.week}</p>
      <h1>
        {focusSubmissionId
          ? "Written research decision"
          : "Bring useful evidence"}
      </h1>
      <p>
        Every active member can research, challenge and contribute. The
        tracked-call cap never limits ordinary debate. There is no research role
        or reputation gate.
      </p>
      {error && (
        <p role="alert">
          Research refresh failed. Retained records may have changed; your
          unsaved text remains here.
        </p>
      )}
      {notice && (
        <p role={failed ? "alert" : "status"} className="status-notice">
          {notice}
        </p>
      )}
      {!focusSubmissionId && (
        <>
          <section aria-labelledby="bounty-title">
            <h2 id="bounty-title">This week’s focused bounty</h2>
            {v.bounty ? (
              <>
                <h3>{v.bounty.criteria.question}</h3>
                <p>
                  Acceptance criteria: {v.bounty.criteria.acceptanceCriteria}
                </p>
                <p>
                  Source requirements: {v.bounty.criteria.sourceRequirements}
                </p>
                <p>
                  Deadline (UTC): {v.bounty.criteria.deadline} · Your time:{" "}
                  <LocalTime iso={v.bounty.criteria.deadline} />
                </p>
              </>
            ) : (
              <p>
                No bounty is published for this UTC week. You can still bring an
                independent sourced challenge.
              </p>
            )}
            <p>
              {v.budget} Criteria are fixed before submissions. No token, cash
              award or XP conversion is offered.
            </p>
            {!v.bounty && v.canCoordinate && (
              <details>
                <summary>Publish the one weekly bounty</summary>
                <form onSubmit={publish}>
                  <fieldset disabled={!ready}>
                    <label>
                      Focused question
                      <input
                        name="question"
                        required
                        minLength={10}
                        maxLength={500}
                      />
                    </label>
                    <label>
                      Measurable acceptance criteria
                      <textarea
                        name="acceptanceCriteria"
                        required
                        minLength={30}
                        maxLength={1500}
                      />
                    </label>
                    <label>
                      Source requirements
                      <textarea
                        name="sourceRequirements"
                        required
                        minLength={15}
                        maxLength={1000}
                      />
                    </label>
                    <label>
                      Deadline in your local time
                      <input name="deadline" type="datetime-local" required />
                    </label>
                    <button className="button secondary">
                      Publish recognition-only criteria
                    </button>
                  </fieldset>
                </form>
              </details>
            )}
          </section>
          <section>
            <h2>Submit useful research or a challenge</h2>
            <p>
              Explain what the source shows, what remains uncertain, and why it
              helps the covered-call decision. Two conflict-free members rotate
              for this submission only; written reasons and an exact 48-hour
              appeal are recorded.
            </p>
            <form onSubmit={work}>
              <fieldset disabled={!ready}>
                <label htmlFor="research-target">Submission type</label>
                <select id="research-target" name="target">
                  <option value="independent">
                    Independent sourced challenge
                  </option>
                  {v.bounty &&
                    Date.parse(v.bounty.criteria.deadline) >
                      Date.parse(v.checkedAt) && (
                      <option value="bounty">
                        This week’s published bounty
                      </option>
                    )}
                </select>
                <label>
                  Your sourced finding or challenge
                  <textarea
                    name="summary"
                    required
                    minLength={30}
                    maxLength={1500}
                    placeholder="What should the guild reconsider, and why?"
                  />
                </label>
                <label>
                  Original evidence URL
                  <input
                    name="evidenceUrl"
                    type="url"
                    required
                    placeholder="https://…"
                  />
                </label>
                <label>
                  How to verify it, including uncertainty
                  <textarea
                    name="verificationPlan"
                    required
                    minLength={20}
                    maxLength={1500}
                  />
                </label>
                <label>
                  Interests, positions and paid promotion disclosures
                  <input
                    name="disclosures"
                    required
                    minLength={2}
                    maxLength={1000}
                  />
                </label>
                <details>
                  <summary>Disclose a conflict with another member</summary>
                  <label>
                    Conflicted member IDs, separated by commas
                    <input
                      name="conflictedUserIds"
                      placeholder="Member IDs; no trading accounts or secrets"
                    />
                  </label>
                  <p>
                    Your own member ID is {userId}. The author and disclosed
                    conflicts cannot decide the award.
                  </p>
                </details>
                <button className="button">
                  Submit for source and usefulness decisions
                </button>
              </fieldset>
            </form>
          </section>
          <section>
            <h2>Tracked calls: outcomes stay visible</h2>
            <p>
              <strong>{v.remainingForecasts} of 3 registrations remain</strong>{" "}
              this UTC week, across guilds. Revised terms create another
              retained record; old claims and misses are kept. Stock and macro
              research does not enable stock trading.
            </p>
            <details>
              <summary>Add a measurable tracked call</summary>
              <form onSubmit={forecast}>
                <fieldset disabled={!ready || v.remainingForecasts === 0}>
                  <label>
                    Asset or topic
                    <input
                      name="asset"
                      required
                      maxLength={40}
                      placeholder="SOL, a stock, or a macro measure"
                    />
                  </label>
                  <label>
                    One measurable claim
                    <textarea
                      name="claim"
                      required
                      minLength={10}
                      maxLength={1000}
                    />
                  </label>
                  <label>
                    Metric
                    <input
                      name="metric"
                      required
                      minLength={3}
                      maxLength={100}
                      placeholder="Closing price, reported figure…"
                    />
                  </label>
                  <label htmlFor="forecast-operator">Comparison</label>
                  <select id="forecast-operator" name="operator">
                    <option value="above">Above</option>
                    <option value="below">Below</option>
                    <option value="at_least">At least</option>
                    <option value="at_most">At most</option>
                  </select>
                  <label>
                    Target value
                    <input
                      name="target"
                      required
                      inputMode="decimal"
                      pattern="(0|[1-9][0-9]*)(\.[0-9]+)?"
                    />
                  </label>
                  <label>
                    Benchmark and units
                    <input
                      name="benchmark"
                      required
                      minLength={3}
                      maxLength={200}
                      placeholder="For example, USD per SOL; name any comparison"
                    />
                  </label>
                  <label>
                    Original resolution source URL
                    <input name="sourceUrl" type="url" required />
                  </label>
                  <label>
                    Outcome deadline in your local time
                    <input name="deadline" type="datetime-local" required />
                  </label>
                  <label>
                    Confidence percentage
                    <input
                      name="confidence"
                      type="number"
                      min="1"
                      max="99"
                      required
                    />
                  </label>
                  <label>
                    Interests and position disclosures
                    <input
                      name="disclosures"
                      required
                      minLength={2}
                      maxLength={1000}
                    />
                  </label>
                  <label>
                    Exact resolution rule
                    <textarea
                      name="resolutionRule"
                      required
                      minLength={20}
                      maxLength={1500}
                      placeholder="Which published value and timestamp? What happens if the source is unavailable?"
                    />
                  </label>
                  <details>
                    <summary>
                      Register a retained revision of your earlier call
                    </summary>
                    <label>
                      Earlier tracked-call record ID (optional)
                      <input
                        name="supersedesId"
                        placeholder="Copy the record ID from your own earlier call"
                      />
                    </label>
                    <p>
                      This is another registration within your three-call
                      allowance. The original terms and any later miss stay
                      visible; only a not-yet-due call can be revised.
                    </p>
                  </details>
                  <button className="button secondary">
                    Register these fixed terms
                  </button>
                </fieldset>
              </form>
            </details>
            {allForecasts.length ? (
              allForecasts.map((f) => (
                <article className="panel" key={f.id}>
                  <h3>{f.terms.claim}</h3>
                  <p>
                    {f.state} · {f.terms.confidence}% stated confidence
                    {f.outcome?.dataClass === "teaching_only"
                      ? " · Original synthetic teaching resolution"
                      : ""}
                  </p>
                  <p>
                    {f.terms.asset} · {f.terms.metric}{" "}
                    {f.terms.operator.replaceAll("_", " ")} {f.terms.target} ·{" "}
                    {f.terms.benchmark}
                  </p>
                  <p>
                    Deadline: {f.terms.deadline}.{" "}
                    <a
                      href={f.terms.sourceUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Declared source
                    </a>
                  </p>
                  <details>
                    <summary>
                      Fixed rule, disclosures and source revision
                    </summary>
                    <p>{f.terms.resolutionRule}</p>
                    <p>{f.terms.disclosures}</p>
                    <p>
                      Source revision:{" "}
                      {f.outcome?.revision ??
                        "Unresolved; no permitted outcome source is installed or verified."}
                    </p>
                    <p>
                      Record {f.id}
                      {f.supersedesId
                        ? " · Retained revision of " + f.supersedesId
                        : ""}
                    </p>
                  </details>
                </article>
              ))
            ) : (
              <p>
                No tracked calls yet. Start with one claim that another member
                could check from the same source.
              </p>
            )}
            {(forecastCursor === undefined
              ? v.nextForecastCursor
              : forecastCursor) && (
              <button
                className="button secondary"
                disabled={loadingHistory}
                onClick={() => void loadHistory("forecast")}
              >
                Load older tracked calls, including misses
              </button>
            )}
          </section>
        </>
      )}
      <section>
        <h2>Written decisions and appeals</h2>
        {allSubmissions.length ? (
          allSubmissions.map((s) => (
            <article className="panel" key={s.id}>
              <h3>
                {focusSubmissionId ? (
                  s.record.summary
                ) : (
                  <Link
                    href={`/guilds/${v.guildId}/community/submissions/${s.id}`}
                  >
                    {s.record.summary}
                  </Link>
                )}
              </h3>
              <p>
                <a href={s.record.evidenceUrl} target="_blank" rel="noreferrer">
                  Submitted source
                </a>{" "}
                · {s.record.disclosures}
              </p>
              <p>{s.record.verificationPlan}</p>
              <p>
                {s.recognized
                  ? "Recognized after the appeal process"
                  : s.appealPending
                    ? "Appeal pending independent reconsideration"
                    : s.outcome
                      ? Date.parse(v.checkedAt) <
                        Date.parse(s.outcome.appealClosesAt)
                        ? "Decision recorded · Appeal window open"
                        : s.outcome.accepted
                          ? "Recognition check pending"
                          : "Not awarded"
                      : "Awaiting two conflict-free written decisions"}
              </p>
              {s.outcome && (
                <>
                  <p>Reasons: {s.outcome.reason}</p>
                  <p>
                    Appeal closes (UTC): {s.outcome.appealClosesAt} ·{" "}
                    <LocalTime iso={s.outcome.appealClosesAt} />
                  </p>
                  {!s.appeals &&
                    Date.parse(v.checkedAt) <
                      Date.parse(s.outcome.appealClosesAt) && (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          void save(
                            {
                              action: "appeal",
                              submissionId: s.id,
                              reason: fields(e.currentTarget).reason,
                            },
                            e.currentTarget
                          );
                        }}
                      >
                        <fieldset disabled={!ready}>
                          <label>
                            Source or interpretation issue to appeal
                            <textarea
                              name="reason"
                              required
                              minLength={20}
                              maxLength={1500}
                            />
                          </label>
                          <button className="button secondary">
                            Submit one independent appeal
                          </button>
                        </fieldset>
                      </form>
                    )}
                </>
              )}
              {(!s.outcome || s.appealPending) && (
                <button
                  type="button"
                  className="button secondary"
                  disabled={!ready}
                  onClick={() =>
                    void save({
                      action: "request_assignments",
                      submissionId: s.id,
                    })
                  }
                >
                  Check for two eligible decision makers
                </button>
              )}
              {v.assignments
                .filter((a) => a.submissionId === s.id && !a.decided)
                .map((a) => (
                  <AwardDecision
                    key={a.id}
                    submissionId={s.id}
                    ready={ready}
                    save={save}
                  />
                ))}
            </article>
          ))
        ) : (
          <p>
            No submissions are awaiting decisions. Ordinary evidence and debate
            do not require an award submission.
          </p>
        )}
        {(submissionCursor === undefined
          ? v.nextSubmissionCursor
          : submissionCursor) && (
          <button
            className="button secondary"
            disabled={loadingHistory}
            onClick={() => void loadHistory("submission")}
          >
            Load older decisions and appeals
          </button>
        )}
      </section>
      {!focusSubmissionId && (
        <>
          <section>
            <h2>Your separate recognition records</h2>
            <dl className="numeric-list">
              <div>
                <dt>Learning XP</dt>
                <dd>{v.recognition.learningXp}</dd>
              </div>
              <div>
                <dt>Research reputation</dt>
                <dd>{v.recognition.researchReputation}</dd>
              </div>
              <div>
                <dt>Season points</dt>
                <dd>Separate competitive score ledger</dd>
              </div>
            </dl>
            <p>
              Greetings, likes, referrals, posting volume, capital, trade volume
              and profit earn no research award.
            </p>
          </section>
          <section>
            <h2>Optional weekly Telegram digest</h2>
            <p>
              Includes useful evidence, challenges, resolved calls, misses and
              unresolved sources. No full-chat ingestion or private trading
              amounts.
            </p>
            {!v.digest.botConfigured ? (
              <p>Unavailable: the community bot is not configured.</p>
            ) : !v.digest.privateStarted ? (
              <p>Start the exact community bot privately before opting in.</p>
            ) : (
              <button
                disabled={!ready}
                className="button secondary"
                onClick={() =>
                  void save({ action: "digest", active: !v.digest.active })
                }
              >
                {v.digest.active
                  ? "Stop my weekly digest"
                  : "Opt into my weekly digest"}
              </button>
            )}
            {v.digest.active && !v.digest.sendingEnabled && (
              <p>Opt-in saved. Sending is disabled in this environment.</p>
            )}
          </section>
        </>
      )}
      <p>
        {focusSubmissionId && (
          <>
            <Link href={`/guilds/${v.guildId}/community`}>
              Return to community research
            </Link>{" "}
            ·{" "}
          </>
        )}
        <Link href={`/guilds/${v.guildId}`}>
          Return to the guild’s current decision
        </Link>{" "}
        ·{" "}
        <Link href={`/guilds/${v.guildId}/results`}>
          Review competitive results
        </Link>
      </p>
    </>
  );
}
function AwardDecision({
  submissionId,
  ready,
  save,
}: {
  submissionId: string;
  ready: boolean;
  save: (input: unknown, form?: HTMLFormElement) => Promise<void>;
}) {
  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = e.currentTarget,
            d = fields(f);
          void save(
            {
              action: "decide",
              submissionId,
              decision: {
                accept: d.accept === "yes",
                verifiedUseful: d.verifiedUseful === "on",
                reason: d.reason,
                verification: d.verification,
              },
            },
            f
          );
        }}
      >
        <fieldset disabled={!ready}>
          <legend>Your decision for this submission</legend>
          <p>
            This assignment gives no standing research role, special vote weight
            or trading permission. Disclosed conflicts and the author cannot
            decide.
          </p>
          <label htmlFor={`award-decision-${submissionId}`}>Decision</label>
          <select id={`award-decision-${submissionId}`} name="accept">
            <option value="no">Not accepted under the criteria</option>
            <option value="yes">Useful verified research</option>
          </select>
          <label className="checkbox">
            <input name="verifiedUseful" type="checkbox" />I checked the source
            and usefulness, including uncertainty
          </label>
          <label>
            What you verified
            <textarea
              name="verification"
              required
              minLength={20}
              maxLength={1500}
            />
          </label>
          <label>
            Written reason
            <textarea name="reason" required minLength={20} maxLength={1500} />
          </label>
          <button className="button secondary">
            Save this written decision
          </button>
        </fieldset>
      </form>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save(
            {
              action: "declare_conflict",
              submissionId,
              reason: fields(e.currentTarget).reason,
            },
            e.currentTarget
          );
        }}
      >
        <fieldset disabled={!ready}>
          <label>
            Newly discovered conflict
            <textarea name="reason" required minLength={20} maxLength={1500} />
          </label>
          <button className="button secondary">
            Decline this assignment and disclose conflict
          </button>
        </fieldset>
      </form>
    </>
  );
}
