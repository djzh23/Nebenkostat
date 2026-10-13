// Domain types for the Nebenkostenabrechnung. Money is integer cents, areas are
// integer hundredths of m², dates are ISO "YYYY-MM-DD" strings (inclusive).

export type KeyType = "flaeche" | "personen" | "einheiten";

export const KEY_LABELS: Record<KeyType, string> = {
  flaeche: "Wohnfläche",
  personen: "Personen",
  einheiten: "Einheiten",
};

export const COST_CATEGORIES = [
  "Wasser",
  "Abwasser",
  "Müll",
  "Heizung",
  "Warmwasser",
  "Hauswart",
  "Sach- und Haftpflichtversicherung",
  "Aufzug",
  "Gemeinschaftsantenne und Kabelfernsehen",
  "Kosten der Beleuchtung",
  "Straßenreinigung",
  "Schornsteinreinigung",
  "Sonstige Kosten",
  "Grundsteuer",
  "Versicherung",
  "Hausmeister",
  "Sonstiges",
] as const;

export type Property = {
  id: string;
  name: string;
  street: string;
  zip: string;
  city: string;
};

export type Unit = {
  id: string;
  propertyId: string;
  label: string;
  areaHundredths: number;
};

export type Tenancy = {
  id: string;
  unitId: string;
  tenant: string;
  from: string;
  to: string | null;
  persons: number;
  prepaymentCents: number;
};

export type CostItem = {
  id: string;
  propertyId: string;
  year: number;
  category: string;
  amountCents: number;
  key: KeyType;
  receipts: string[];
};

export type FinalizedRecord = {
  propertyId: string;
  year: number;
  finalizedAt: string;
};

export type AppState = {
  properties: Property[];
  units: Unit[];
  tenancies: Tenancy[];
  costs: CostItem[];
  finalized: FinalizedRecord[];
};
