import { describe, expect, it } from "vitest";
import { activeMonths, daysInYear, settleYear, settlementYear } from "./settlement";
import { SEED_STATE } from "./seed";

// Expected values were computed independently with exact fractions and half-up rounding
// (Python `fractions`), and match the amounts shown on the seed statement.
const PROPERTY = "beispiel-haus";

function sharesOf(settlement: ReturnType<typeof settleYear>, category: string) {
  const cost = settlement.costs.find((candidate) => candidate.cost.category === category);
  if (!cost) throw new Error(`Kostenart ${category} fehlt`);
  return Object.fromEntries(cost.shares.map((share) => [share.tenancyId, share.cents]));
}

describe("settleYear for the seed statement 2025", () => {
  const result = settleYear(SEED_STATE, PROPERTY, 2025);

  it("uses 365 days", () => {
    expect(result.daysInYear).toBe(365);
  });

  it("allocates Wasser by area and time", () => {
    expect(sharesOf(result, "Wasser")).toEqual({ "t-eg": 41333, "t-og-alt": 16034, "t-og-neu": 16300, "t-dg": 38844 });
    expect(result.costs.find((cost) => cost.cost.category === "Wasser")?.vacancyCents).toBe(7489);
  });

  it("allocates Müll by unit and time", () => {
    expect(sharesOf(result, "Müll")).toEqual({ "t-eg": 21333, "t-og-alt": 10579, "t-og-neu": 10754, "t-dg": 17885 });
  });

  it("allocates Heizung by persons and time without vacancy", () => {
    expect(sharesOf(result, "Heizung")).toEqual({ "t-eg": 98506, "t-og-alt": 24424, "t-og-neu": 74487, "t-dg": 82583 });
    expect(result.costs.find((cost) => cost.cost.category === "Heizung")?.vacancyCents).toBe(0);
  });

  it("allocates Grundsteuer by area and time", () => {
    expect(sharesOf(result, "Grundsteuer")).toEqual({ "t-eg": 15500, "t-og-alt": 6013, "t-og-neu": 6112, "t-dg": 14566 });
  });

  it("counts calendar months for the prepayment", () => {
    const months = Object.fromEntries(result.tenancies.map((row) => [row.tenancy.id, row.months]));
    expect(months).toEqual({ "t-eg": 12, "t-og-alt": 6, "t-og-neu": 6, "t-dg": 10 });
  });

  it("accounts for every cost: shares plus vacancy equal the cost", () => {
    for (const cost of result.costs) {
      const allocated = cost.shares.reduce((sum, share) => sum + share.cents, 0);
      expect(allocated + cost.vacancyCents).toBe(cost.cost.amountCents);
    }
  });

  it("keeps tenancy totals consistent with the cost totals", () => {
    const allocated = result.tenancies.reduce((sum, row) => sum + row.costCents, 0);
    const vacancy = result.costs.reduce((sum, cost) => sum + cost.vacancyCents, 0);
    expect(allocated + vacancy).toBe(result.totalCostCents);
  });
});

describe("date helpers", () => {
  it("handles leap years", () => {
    expect(daysInYear(2024)).toBe(366);
    expect(daysInYear(2025)).toBe(365);
  });

  it("counts months touched by a partial tenancy", () => {
    const tenancy = { id: "x", unitId: "u", tenant: "t", from: "2025-03-15", to: "2025-04-01", persons: 1, prepaymentCents: 0 };
    expect(activeMonths(tenancy, 2025)).toBe(2);
  });

  it("names the settlement year as the previous calendar year", () => {
    expect(settlementYear(new Date(2026, 9, 3))).toBe(2025);
  });
});
