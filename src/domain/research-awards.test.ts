import { expect, it } from "vitest";
import {
  forecastTerms,
  resolveForecast,
  awardEligibility,
  rotateDecisionMakers,
  appealOpen,
} from "./research-awards";
const terms = {
  asset: "SOL",
  claim: "SOL closes above the specified benchmark price",
  metric: "closing_price",
  operator: "above" as const,
  target: "100",
  benchmark: "USD per SOL",
  sourceUrl: "https://status.solana.com/",
  deadline: "2026-11-15T12:00:00.000Z",
  confidence: 60,
  disclosures: "No paid promotion or undisclosed interest",
  resolutionRule:
    "Use the first source close published at the deadline; missing source stays unresolved",
};
it("requires measurable pre-outcome terms and retains verified misses", () => {
  expect(forecastTerms(terms, "2026-11-08T12:00:00.000Z")).toEqual(terms);
  expect(() => forecastTerms(terms, terms.deadline)).toThrow(/before/);
  expect(
    resolveForecast(terms, {
      value: "99",
      observedAt: terms.deadline,
      verified: true,
    })
  ).toBe("miss");
  expect(
    resolveForecast(terms, {
      value: "101",
      observedAt: terms.deadline,
      verified: false,
    })
  ).toBe("unresolved");
});
it("rewards useful verified research with two conflict-free decisions, never posting volume, capital or trade profit", () => {
  const base = {
    registeredBeforeOutcome: true,
    verifiedUseful: true,
    decisions: [
      { reviewerId: "b", accept: true, conflicted: false },
      { reviewerId: "c", accept: true, conflicted: false },
    ],
    authorId: "a",
    appealPending: false,
    appealClosed: true,
  };
  expect(awardEligibility(base)).toBe(true);
  expect(awardEligibility({ ...base, verifiedUseful: false })).toBe(false);
  expect(
    awardEligibility({
      ...base,
      decisions: [
        { reviewerId: "a", accept: true, conflicted: true },
        base.decisions[1],
      ],
    })
  ).toBe(false);
  expect(
    awardEligibility({
      ...base,
      decisions: [base.decisions[0], base.decisions[0]],
    })
  ).toBe(false);
});
it("rotates two members only for the particular award and enforces the exact 48-hour appeal boundary", () => {
  expect(
    rotateDecisionMakers(
      [
        { id: "a", assignments: 0 },
        { id: "b", assignments: 2 },
        { id: "c", assignments: 0 },
        { id: "d", assignments: 1 },
      ],
      ["a"]
    )
  ).toEqual(["c", "d"]);
  expect(rotateDecisionMakers([{ id: "a", assignments: 0 }], ["a"])).toEqual(
    []
  );
  expect(
    appealOpen("2026-11-08T12:00:00.000Z", "2026-11-10T11:59:59.999Z")
  ).toBe(true);
  expect(
    appealOpen("2026-11-08T12:00:00.000Z", "2026-11-10T12:00:00.000Z")
  ).toBe(false);
});
