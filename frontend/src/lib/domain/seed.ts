import type { AppState } from "./types";

// Demo statement, labelled "Beispiel" wherever it appears. Used until the user
// adds a property of their own.
export const SEED_STATE: AppState = {
  properties: [
    {
      id: "beispiel-haus",
      name: "Beispielhaus",
      street: "Musterstraße 1",
      zip: "00000",
      city: "Beispielstadt",
    },
  ],
  units: [
    { id: "u-eg", propertyId: "beispiel-haus", label: "EG links", areaHundredths: 6200 },
    { id: "u-og", propertyId: "beispiel-haus", label: "OG rechts", areaHundredths: 4850 },
    { id: "u-dg", propertyId: "beispiel-haus", label: "DG", areaHundredths: 6950 },
  ],
  tenancies: [
    {
      id: "t-eg",
      unitId: "u-eg",
      tenant: "Mietpartei EG (Beispiel)",
      from: "2024-06-01",
      to: null,
      persons: 2,
      prepaymentCents: 18000,
    },
    {
      id: "t-og-alt",
      unitId: "u-og",
      tenant: "Mietpartei OG, alt (Beispiel)",
      from: "2024-01-01",
      to: "2025-06-30",
      persons: 1,
      prepaymentCents: 12000,
    },
    {
      id: "t-og-neu",
      unitId: "u-og",
      tenant: "Mietpartei OG, neu (Beispiel)",
      from: "2025-07-01",
      to: null,
      persons: 3,
      prepaymentCents: 15000,
    },
    {
      id: "t-dg",
      unitId: "u-dg",
      tenant: "Mietpartei DG (Beispiel)",
      from: "2025-03-01",
      to: null,
      persons: 2,
      prepaymentCents: 22000,
    },
  ],
  costs: [
    {
      id: "c-wasser",
      propertyId: "beispiel-haus",
      year: 2025,
      category: "Wasser",
      amountCents: 120000,
      key: "flaeche",
      receipts: ["Wasserrechnung 2025 (Beispiel).pdf", "Abwasser 2025 (Beispiel).pdf"],
    },
    {
      id: "c-muell",
      propertyId: "beispiel-haus",
      year: 2025,
      category: "Müll",
      amountCents: 64000,
      key: "einheiten",
      receipts: ["Müllgebühren 2025 (Beispiel).pdf"],
    },
    {
      id: "c-heizung",
      propertyId: "beispiel-haus",
      year: 2025,
      category: "Heizung",
      amountCents: 280000,
      key: "personen",
      receipts: [],
    },
    {
      id: "c-grundsteuer",
      propertyId: "beispiel-haus",
      year: 2025,
      category: "Grundsteuer",
      amountCents: 45000,
      key: "flaeche",
      receipts: ["Grundsteuerbescheid 2025 (Beispiel).pdf"],
    },
  ],
  finalized: [],
};
