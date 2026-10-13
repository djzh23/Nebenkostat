import { describe, expect, it } from "vitest";
import { allocateByArea, formatEur, parseEuroToCents, parseM2 } from "./allocation";

describe("parseEuroToCents", () => {
  it.each([
    ["1.200,00", 120000],
    ["1200,5", 120050],
    ["1.200", 120000],
    ["1.200.000", 120000000],
    ["12.5", 1250],
    ["12.50", 1250],
    ["12,5", 1250],
    ["0,99", 99],
    ["1200", 120000],
    [" 1 200,00 € ", 120000],
  ])("reads %s as %i cents", (input, cents) => {
    expect(parseEuroToCents(input)).toBe(cents);
  });

  it.each(["", "abc", "-5", "1.2.3", "12,345", "1,2,3"])("rejects %s", (input) => {
    expect(parseEuroToCents(input)).toBeNull();
  });
});

describe("parseM2", () => {
  it("accepts comma and dot decimals and rejects zero", () => {
    expect(parseM2("62,5")).toBe(6250);
    expect(parseM2("62.5")).toBe(6250);
    expect(parseM2("0")).toBeNull();
    expect(parseM2("abc")).toBeNull();
  });
});

describe("allocateByArea", () => {
  it("matches the Flächenschlüssel of the EG example", () => {
    // 1.200,00 € × 62 m² ÷ 180 m² = 413,33 €
    expect(allocateByArea(120000, 6200, 18000).shareCents).toBe(41333);
  });

  it("rounds half-up to the cent", () => {
    expect(allocateByArea(1, 1, 2).shareCents).toBe(1);
  });

  it("puts the remainder into the vacancy", () => {
    const result = allocateByArea(120000, 6200, 18000);
    expect(result.restCents).toBe(120000 - 41333);
  });
});

describe("formatEur", () => {
  it("formats with German separators", () => {
    expect(formatEur(41333)).toBe("413,33 €");
  });
});
