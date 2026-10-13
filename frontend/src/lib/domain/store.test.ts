import { beforeEach, describe, expect, it } from "vitest";
import { addCost, addProperty, addTenancy, addUnit, DomainError, finalizeYear, resetDemo } from "./store";

// The store keeps module state; each test starts from the seed.
beforeEach(() => {
  resetDemo();
});

describe("tenancy validation", () => {
  it("rejects an overlapping tenancy on the same unit", () => {
    expect(() =>
      addTenancy({ unitId: "u-og", tenant: "Neu", from: "2025-06-01", to: "", persons: "1", prepayment: "100", year: 2025 }),
    ).toThrow("überschneidet");
  });

  it("accepts consecutive tenancies and rejects a later overlap", () => {
    const propertyId = addProperty({ name: "Testhaus", street: "", zip: "", city: "" });
    const unitId = addUnit(propertyId, "EG", "50");
    addTenancy({ unitId, tenant: "A", from: "2025-01-01", to: "2025-03-31", persons: "1", prepayment: "100", year: 2025 });
    addTenancy({ unitId, tenant: "B", from: "2025-04-01", to: "", persons: "1", prepayment: "100", year: 2025 });
    expect(() =>
      addTenancy({ unitId, tenant: "C", from: "2025-03-01", to: "", persons: "1", prepayment: "100", year: 2025 }),
    ).toThrow("überschneidet");
  });

  it("rejects an end date before the start date", () => {
    expect(() =>
      addTenancy({ unitId: "u-eg", tenant: "X", from: "2025-05-01", to: "2025-04-01", persons: "1", prepayment: "1", year: 2025 }),
    ).toThrow("Auszugsdatum");
  });
});

describe("input validation", () => {
  it("requires a positive area", () => {
    expect(() => addUnit("beispiel-haus", "Neu", "0")).toThrow(DomainError);
  });

  it("requires a name for a property", () => {
    expect(() => addProperty({ name: "   ", street: "", zip: "", city: "" })).toThrow(DomainError);
  });

  it("requires an amount above zero for a cost", () => {
    expect(() =>
      addCost({ propertyId: "beispiel-haus", year: 2025, category: "Wasser", amount: "0", key: "flaeche" }),
    ).toThrow(DomainError);
  });
});

describe("finalization", () => {
  it("locks the year for cost and tenancy changes", () => {
    finalizeYear("beispiel-haus", 2025);
    expect(() =>
      addCost({ propertyId: "beispiel-haus", year: 2025, category: "Müll", amount: "10", key: "einheiten" }),
    ).toThrow("abgeschlossen");
    expect(() =>
      addTenancy({ unitId: "u-eg", tenant: "X", from: "2025-01-01", to: "", persons: "1", prepayment: "1", year: 2025 }),
    ).toThrow("abgeschlossen");
  });

  it("locks the unit list once any year is finalized", () => {
    finalizeYear("beispiel-haus", 2025);
    expect(() => addUnit("beispiel-haus", "Neu", "10")).toThrow("abgeschlossen");
  });

  it("refuses to finalize a year without costs", () => {
    expect(() => finalizeYear("beispiel-haus", 2019)).toThrow("Ohne Kostenpositionen");
  });
});
