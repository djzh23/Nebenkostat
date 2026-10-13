import { formatEur, formatM2 } from "@/lib/allocation";
import type { AppState, CostItem, KeyType, Tenancy, Unit } from "./types";
import { KEY_LABELS } from "./types";

// Rules from docs/PRD.md section 5. Pure functions only, so the same arithmetic
// can be checked against the backend later. All shares are exact rationals,
// rounded half-up to the cent once per line.

const DAY_MS = 86_400_000;

export function daysInYear(year: number): number {
  return (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / DAY_MS;
}

function toUtc(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Inclusive day range of a tenancy inside the settlement year, or null when it does not overlap. */
function activeRange(tenancy: Tenancy, year: number): { start: number; end: number } | null {
  const yearStart = Date.UTC(year, 0, 1);
  const yearEnd = Date.UTC(year, 11, 31);
  const start = Math.max(toUtc(tenancy.from), yearStart);
  const end = Math.min(tenancy.to ? toUtc(tenancy.to) : yearEnd, yearEnd);
  return end >= start ? { start, end } : null;
}

export function activeDays(tenancy: Tenancy, year: number): number {
  const range = activeRange(tenancy, year);
  return range ? Math.round((range.end - range.start) / DAY_MS) + 1 : 0;
}

/** Calendar months in which the tenancy covers at least one day. Used for the prepayment. */
export function activeMonths(tenancy: Tenancy, year: number): number {
  const range = activeRange(tenancy, year);
  if (!range) return 0;
  let count = 0;
  for (let month = 0; month < 12; month++) {
    const monthStart = Date.UTC(year, month, 1);
    const monthEnd = Date.UTC(year, month + 1, 0);
    if (Math.max(range.start, monthStart) <= Math.min(range.end, monthEnd)) count++;
  }
  return count;
}

/** Half-up rounding of num/den for non-negative bigints. */
function roundHalfUp(num: bigint, den: bigint): bigint {
  return (BigInt(2) * num + den) / (BigInt(2) * den);
}

export type TenancyShare = {
  tenancyId: string;
  cents: number;
  formula: string;
};

export type CostSettlement = {
  cost: CostItem;
  shares: TenancyShare[];
  allocatedCents: number;
  vacancyCents: number;
  rule: string;
};

export type TenancyResult = {
  tenancy: Tenancy;
  unit: Unit;
  days: number;
  months: number;
  costCents: number;
  prepaidCents: number;
  balanceCents: number;
};

export type YearSettlement = {
  year: number;
  daysInYear: number;
  costs: CostSettlement[];
  tenancies: TenancyResult[];
  totalCostCents: number;
  totalVacancyCents: number;
};

const RULES: Record<KeyType, string> = {
  flaeche: "Kosten × Wohnfläche ÷ Gesamtfläche × Zeitanteil",
  personen: "Kosten × Personen-Tage ÷ Summe aller Personen-Tage",
  einheiten: "Kosten ÷ Anzahl Einheiten × Zeitanteil",
};

export function settleYear(state: AppState, propertyId: string, year: number): YearSettlement {
  const units = state.units.filter((unit) => unit.propertyId === propertyId);
  const unitById = new Map(units.map((unit) => [unit.id, unit]));
  const tenancies = state.tenancies.filter((tenancy) => unitById.has(tenancy.unitId));
  const costs = state.costs.filter((cost) => cost.propertyId === propertyId && cost.year === year);

  const days = daysInYear(year);
  const totalAreaHundredths = units.reduce((sum, unit) => sum + unit.areaHundredths, 0);
  const active = tenancies
    .map((tenancy) => ({ tenancy, days: activeDays(tenancy, year) }))
    .filter((entry) => entry.days > 0);
  const personDays = active.reduce((sum, entry) => sum + entry.tenancy.persons * entry.days, 0);

  const costSettlements: CostSettlement[] = costs.map((cost) => {
    const costCents = BigInt(cost.amountCents);
    const shares: TenancyShare[] = active.map(({ tenancy, days: tenancyDays }) => {
      const unit = unitById.get(tenancy.unitId)!;
      let num: bigint;
      let den: bigint;
      let formula: string;

      if (cost.key === "flaeche") {
        num = costCents * BigInt(unit.areaHundredths) * BigInt(tenancyDays);
        den = BigInt(totalAreaHundredths) * BigInt(days);
        formula = `${formatEur(cost.amountCents)} × ${formatM2(unit.areaHundredths)} × ${tenancyDays} Tage ÷ (${formatM2(totalAreaHundredths)} × ${days} Tage)`;
      } else if (cost.key === "personen") {
        num = costCents * BigInt(tenancy.persons * tenancyDays);
        den = BigInt(personDays);
        formula = `${formatEur(cost.amountCents)} × ${tenancy.persons} Pers. × ${tenancyDays} Tage ÷ ${personDays} Personen-Tage`;
      } else {
        num = costCents * BigInt(tenancyDays);
        den = BigInt(units.length) * BigInt(days);
        formula = `${formatEur(cost.amountCents)} × ${tenancyDays} Tage ÷ (${units.length} Einheiten × ${days} Tage)`;
      }

      return { tenancyId: tenancy.id, cents: Number(roundHalfUp(num, den)), formula };
    });

    const allocatedCents = shares.reduce((sum, share) => sum + share.cents, 0);
    return {
      cost,
      shares,
      allocatedCents,
      vacancyCents: cost.amountCents - allocatedCents,
      rule: `${KEY_LABELS[cost.key]}: ${RULES[cost.key]}`,
    };
  });

  const tenancyResults: TenancyResult[] = active.map(({ tenancy, days: tenancyDays }) => {
    const costCents = costSettlements.reduce(
      (sum, settlement) =>
        sum + (settlement.shares.find((share) => share.tenancyId === tenancy.id)?.cents ?? 0),
      0,
    );
    const months = activeMonths(tenancy, year);
    const prepaidCents = tenancy.prepaymentCents * months;
    return {
      tenancy,
      unit: unitById.get(tenancy.unitId)!,
      days: tenancyDays,
      months,
      costCents,
      prepaidCents,
      balanceCents: costCents - prepaidCents,
    };
  });

  return {
    year,
    daysInYear: days,
    costs: costSettlements,
    tenancies: tenancyResults,
    totalCostCents: costs.reduce((sum, cost) => sum + cost.amountCents, 0),
    totalVacancyCents: costSettlements.reduce((sum, settlement) => sum + settlement.vacancyCents, 0),
  };
}

// Statements cover the previous calendar year. § 556 Abs. 3 BGB: the statement must
// reach the tenant within 12 months after the period ends. The app shows it as an orientation only.
export function settlementYear(now: Date = new Date()): number {
  return now.getFullYear() - 1;
}
