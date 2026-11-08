import { z } from "zod";
import { invariant } from "./errors";
import { decimal, compare } from "./money";
import { parseUtc, decimalSchema } from "./types";
const source = z
  .url()
  .refine(
    (v) =>
      new URL(v).protocol === "https:" &&
      !new URL(v).username &&
      !new URL(v).password,
    "Use a public HTTPS source"
  );
export const forecastSchema = z
  .object({
    asset: z.string().min(1).max(40),
    claim: z.string().min(10).max(1000),
    metric: z.string().min(3).max(100),
    operator: z.enum(["above", "below", "at_least", "at_most"]),
    target: decimalSchema.max(60),
    benchmark: z.string().min(3).max(200),
    sourceUrl: source,
    deadline: z.string(),
    confidence: z.number().int().min(1).max(99),
    disclosures: z.string().min(2).max(1000),
    resolutionRule: z.string().min(20).max(1500),
  })
  .strict();
export type ForecastTerms = z.infer<typeof forecastSchema>;
export function forecastTerms(input: unknown, now: string): ForecastTerms {
  const t = forecastSchema.parse(input);
  parseUtc(t.deadline);
  parseUtc(now);
  invariant(
    t.deadline > now,
    "forecast_deadline",
    "Register measurable terms before the outcome deadline"
  );
  invariant(
    Date.parse(t.deadline) - Date.parse(now) <= 366 * 86400000,
    "forecast_deadline",
    "Use a deadline within one year"
  );
  return t;
}
export function resolveForecast(
  t: ForecastTerms,
  evidence: { value: string; observedAt: string; verified: boolean }
): "hit" | "miss" | "unresolved" {
  parseUtc(evidence.observedAt);
  if (!evidence.verified || evidence.observedAt !== t.deadline)
    return "unresolved";
  const comparison = compare(decimal(evidence.value), decimal(t.target));
  return (
    t.operator === "above"
      ? comparison > 0
      : t.operator === "below"
        ? comparison < 0
        : t.operator === "at_least"
          ? comparison >= 0
          : comparison <= 0
  )
    ? "hit"
    : "miss";
}
export function rotateDecisionMakers(
  members: readonly { id: string; assignments: number }[],
  excluded: readonly string[]
): string[] {
  const ordered = members
    .filter((m) => !excluded.includes(m.id))
    .toSorted(
      (a, b) => a.assignments - b.assignments || a.id.localeCompare(b.id)
    );
  return ordered.length >= 2 ? ordered.slice(0, 2).map((m) => m.id) : [];
}
export function appealOpen(decidedAt: string, now: string): boolean {
  const start = Date.parse(parseUtc(decidedAt)),
    at = Date.parse(parseUtc(now));
  return at >= start && at < start + 172800000;
}
export function awardEligibility(r: {
  registeredBeforeOutcome: boolean;
  verifiedUseful: boolean;
  authorId: string;
  decisions: readonly {
    reviewerId: string;
    accept: boolean;
    conflicted: boolean;
  }[];
  appealPending: boolean;
  appealClosed: boolean;
}): boolean {
  return (
    r.registeredBeforeOutcome &&
    r.verifiedUseful &&
    r.appealClosed &&
    !r.appealPending &&
    r.decisions.length === 2 &&
    new Set(r.decisions.map((d) => d.reviewerId)).size === 2 &&
    r.decisions.every(
      (d) => d.accept && !d.conflicted && d.reviewerId !== r.authorId
    )
  );
}
export function competitionWeek(iso: string): string {
  const d = new Date(parseUtc(iso)),
    day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}
