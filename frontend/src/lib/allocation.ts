// Preview of the Flächenschlüssel from docs/PRD.md. The API stays authoritative;
// this module only lets the landing page show the same arithmetic live.
// All money is integer cents and all areas are integer hundredths of m², so the
// half-up rounding is exact and never depends on floating-point error.

const euro = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

const squareMeters = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatEur(cents: number): string {
  return euro.format(cents / 100);
}

export function formatM2(hundredths: number): string {
  return `${squareMeters.format(hundredths / 100)} m²`;
}

/**
 * Parses a euro amount typed by a German user into cents.
 * "1.200,50" and "1200,5" use a comma as decimal separator, dots group thousands.
 * "1.200" (dots only, three digits after each) is 1200 €. "12.5" is a plain decimal.
 * Returns null for anything else, including negative values.
 */
export function parseEuroToCents(input: string): number | null {
  const compact = input.trim().replace(/\s/g, "").replace(/€/g, "");
  let normalized: string;

  if (compact.includes(",")) {
    if (!/^\d{1,3}(\.\d{3})*,\d{1,2}$|^\d+,\d{1,2}$/.test(compact)) return null;
    normalized = compact.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(compact)) {
    normalized = compact.replace(/\./g, "");
  } else if (/^\d+(\.\d{1,2})?$/.test(compact)) {
    normalized = compact;
  } else {
    return null;
  }

  const cents = Math.round(Number(normalized) * 100);
  return Number.isSafeInteger(cents) && cents >= 0 ? cents : null;
}

/** Parses "62", "62,5" into hundredths of m². Returns null unless the value is above zero. */
export function parseM2(input: string): number | null {
  const normalized = input.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const hundredths = Math.round(Number(normalized) * 100);
  return hundredths > 0 ? hundredths : null;
}

export type AreaAllocation = {
  shareCents: number;
  restCents: number;
};

/**
 * share = cost × unitArea ÷ totalArea, rounded half-up to the cent.
 * The denominator is fixed, so vacancy stays visible in the remainder.
 */
export function allocateByArea(
  costCents: number,
  unitAreaHundredths: number,
  totalAreaHundredths: number,
): AreaAllocation {
  const numerator = costCents * unitAreaHundredths;
  const shareCents = Math.floor((2 * numerator + totalAreaHundredths) / (2 * totalAreaHundredths));
  return { shareCents, restCents: costCents - shareCents };
}
