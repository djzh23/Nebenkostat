"use client";

import { useSyncExternalStore } from "react";
import { parseEuroToCents, parseM2 } from "@/lib/allocation";
import { SEED_STATE } from "./seed";
import type { AppState, CostItem, FinalizedRecord, KeyType, Property, Tenancy, Unit } from "./types";

// Browser-only UI store. Domain interactions remain here while the data migration
// to the API happens incrementally. Server-created records are mirrored only after
// the API has confirmed them.

const STORAGE_KEY = "nebenkostat.demo.v1";

export class DomainError extends Error {}

let current: AppState = SEED_STATE;
let hydrated = false;
const listeners = new Set<() => void>();

function readStorage(): AppState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppState;
    return Array.isArray(parsed.properties) && Array.isArray(parsed.costs) ? parsed : null;
  } catch {
    return null;
  }
}

function writeStorage(state: AppState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage can be blocked (private mode, full quota). The session keeps working in memory.
  }
}

function getSnapshot(): AppState {
  if (!hydrated && typeof window !== "undefined") {
    hydrated = true;
    const stored = readStorage();
    if (stored) current = stored;
  }
  return current;
}

function getServerSnapshot(): AppState {
  return SEED_STATE;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function commit(next: AppState) {
  current = next;
  writeStorage(next);
  listeners.forEach((listener) => listener());
}

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function requireText(value: string, message: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new DomainError(message);
  return trimmed;
}

function assertOpen(state: AppState, propertyId: string, year: number) {
  if (state.finalized.some((record) => record.propertyId === propertyId && record.year === year)) {
    throw new DomainError(`Die Abrechnung ${year} ist abgeschlossen. Änderungen sind gesperrt.`);
  }
}

export function isFinalized(state: AppState, propertyId: string, year: number): boolean {
  return state.finalized.some((record) => record.propertyId === propertyId && record.year === year);
}

// Units and tenancies span all years, so any finalized year locks the whole property's structure.
function assertNoFinalized(propertyId: string) {
  if (current.finalized.some((record) => record.propertyId === propertyId)) {
    throw new DomainError("Eine Abrechnung dieses Objekts ist abgeschlossen. Änderungen an Einheiten sind gesperrt.");
  }
}

export function addProperty(input: { name: string; street: string; zip: string; city: string }): string {
  const name = requireText(input.name, "Bitte einen Namen für das Objekt eingeben.");
  const id = newId("obj");
  commit({
    ...current,
    properties: [
      ...current.properties,
      { id, name, street: input.street.trim(), zip: input.zip.trim(), city: input.city.trim() },
    ],
  });
  return id;
}

export function upsertProperty(property: Property) {
  getSnapshot();
  const exists = current.properties.some((candidate) => candidate.id === property.id);
  const properties = exists
    ? current.properties.map((candidate) => (candidate.id === property.id ? property : candidate))
    : [...current.properties, property];
  commit({ ...current, properties });
}

export function replaceProperties(properties: Property[]) {
  getSnapshot();
  commit({ ...current, properties });
}

export function addUnit(propertyId: string, label: string, areaInput: string) {
  assertNoFinalized(propertyId);
  const name = requireText(label, "Bitte eine Bezeichnung für die Einheit eingeben.");
  const areaHundredths = parseM2(areaInput);
  if (areaHundredths === null) throw new DomainError("Die Wohnfläche muss größer als 0 m² sein.");
  const id = newId("ein");
  commit({
    ...current,
    units: [...current.units, { id, propertyId, label: name, areaHundredths }],
  });
  return id;
}

export function upsertUnit(unit: Unit) {
  getSnapshot();
  const exists = current.units.some((candidate) => candidate.id === unit.id);
  const units = exists
    ? current.units.map((candidate) => (candidate.id === unit.id ? unit : candidate))
    : [...current.units, unit];
  commit({ ...current, units });
}

export function replaceUnitsForProperty(propertyId: string, units: Unit[]) {
  getSnapshot();
  commit({
    ...current,
    units: [...current.units.filter((unit) => unit.propertyId !== propertyId), ...units],
  });
}

export function upsertCost(cost: CostItem) {
  getSnapshot();
  const exists = current.costs.some((candidate) => candidate.id === cost.id);
  const costs = exists
    ? current.costs.map((candidate) => (candidate.id === cost.id ? cost : candidate))
    : [...current.costs, cost];
  commit({ ...current, costs });
}

export function replaceCostsForProperty(propertyId: string, costs: CostItem[]) {
  getSnapshot();
  commit({
    ...current,
    costs: [...current.costs.filter((cost) => cost.propertyId !== propertyId), ...costs],
  });
}

export function upsertTenancy(tenancy: Tenancy) {
  getSnapshot();
  const exists = current.tenancies.some((candidate) => candidate.id === tenancy.id);
  const tenancies = exists
    ? current.tenancies.map((candidate) => (candidate.id === tenancy.id ? tenancy : candidate))
    : [...current.tenancies, tenancy];
  commit({ ...current, tenancies });
}

export function replaceTenanciesForUnits(unitIds: string[], tenancies: Tenancy[]) {
  getSnapshot();
  const ids = new Set(unitIds);
  commit({
    ...current,
    tenancies: [...current.tenancies.filter((tenancy) => !ids.has(tenancy.unitId)), ...tenancies],
  });
}

export function upsertFinalized(record: FinalizedRecord) {
  getSnapshot();
  const exists = current.finalized.some(
    (candidate) => candidate.propertyId === record.propertyId && candidate.year === record.year,
  );
  const finalized = exists
    ? current.finalized.map((candidate) =>
        candidate.propertyId === record.propertyId && candidate.year === record.year ? record : candidate,
      )
    : [...current.finalized, record];
  commit({ ...current, finalized });
}

export function addTenancy(input: {
  unitId: string;
  tenant: string;
  from: string;
  to: string;
  persons: string;
  prepayment: string;
  year: number;
}) {
  const unit = current.units.find((candidate) => candidate.id === input.unitId);
  if (!unit) throw new DomainError("Die Einheit wurde nicht gefunden.");
  assertOpen(current, unit.propertyId, input.year);

  const tenant = requireText(input.tenant, "Bitte den Namen der Mietpartei eingeben.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.from)) throw new DomainError("Bitte ein Einzugsdatum angeben.");
  const to = input.to ? input.to : null;
  if (to && !/^\d{4}-\d{2}-\d{2}$/.test(to)) throw new DomainError("Das Auszugsdatum ist ungültig.");
  if (to && to < input.from) throw new DomainError("Das Auszugsdatum liegt vor dem Einzugsdatum.");

  const persons = Number.parseInt(input.persons, 10);
  if (!Number.isInteger(persons) || persons < 1) throw new DomainError("Mindestens eine Person angeben.");

  const prepaymentCents = parseEuroToCents(input.prepayment);
  if (prepaymentCents === null) throw new DomainError("Die Vorauszahlung ist kein gültiger Betrag.");

  const candidate: Tenancy = {
    id: newId("mv"),
    unitId: unit.id,
    tenant,
    from: input.from,
    to,
    persons,
    prepaymentCents,
  };

  const overlaps = current.tenancies.some((existing) => {
    if (existing.unitId !== unit.id) return false;
    const existingEnd = existing.to ?? "9999-12-31";
    const candidateEnd = candidate.to ?? "9999-12-31";
    return candidate.from <= existingEnd && existing.from <= candidateEnd;
  });
  if (overlaps) throw new DomainError("Dieses Mietverhältnis überschneidet sich mit einem bestehenden auf derselben Einheit.");

  commit({ ...current, tenancies: [...current.tenancies, candidate] });
}

export function addCost(input: { propertyId: string; year: number; category: string; amount: string; key: KeyType }) {
  assertOpen(current, input.propertyId, input.year);
  const amountCents = parseEuroToCents(input.amount);
  if (amountCents === null || amountCents <= 0) throw new DomainError("Der Betrag muss größer als 0 € sein.");
  commit({
    ...current,
    costs: [
      ...current.costs,
      {
        id: newId("kos"),
        propertyId: input.propertyId,
        year: input.year,
        category: input.category,
        amountCents,
        key: input.key,
        receipts: [],
      },
    ],
  });
}

export function deleteCost(costId: string) {
  const cost = current.costs.find((candidate) => candidate.id === costId);
  if (!cost) return;
  assertOpen(current, cost.propertyId, cost.year);
  commit({ ...current, costs: current.costs.filter((candidate) => candidate.id !== costId) });
}

export function addReceipt(costId: string, fileName: string) {
  const name = requireText(fileName, "Bitte einen Namen für den Beleg eingeben.");
  const cost = current.costs.find((candidate) => candidate.id === costId);
  if (!cost) return;
  assertOpen(current, cost.propertyId, cost.year);
  commit({
    ...current,
    costs: current.costs.map((candidate) =>
      candidate.id === costId ? { ...candidate, receipts: [...candidate.receipts, name] } : candidate,
    ),
  });
}

export function finalizeYear(propertyId: string, year: number) {
  assertOpen(current, propertyId, year);
  const hasCosts = current.costs.some((cost) => cost.propertyId === propertyId && cost.year === year);
  if (!hasCosts) throw new DomainError("Ohne Kostenpositionen gibt es nichts abzurechnen.");
  commit({
    ...current,
    finalized: [...current.finalized, { propertyId, year, finalizedAt: new Date().toISOString() }],
  });
}

export function removeTenancy(tenancyId: string) {
  const tenancy = current.tenancies.find((candidate) => candidate.id === tenancyId);
  if (!tenancy) return;
  const unit = current.units.find((candidate) => candidate.id === tenancy.unitId);
  if (unit) assertNoFinalized(unit.propertyId);
  commit({ ...current, tenancies: current.tenancies.filter((candidate) => candidate.id !== tenancyId) });
}

export function removeUnit(unitId: string) {
  const unit = current.units.find((candidate) => candidate.id === unitId);
  if (!unit) return;
  assertNoFinalized(unit.propertyId);
  if (current.tenancies.some((tenancy) => tenancy.unitId === unitId)) {
    throw new DomainError("Diese Einheit hat Mietverhältnisse. Entferne zuerst die Mietverhältnisse.");
  }
  commit({ ...current, units: current.units.filter((candidate) => candidate.id !== unitId) });
}

export function removeReceipt(costId: string, index: number) {
  const cost = current.costs.find((candidate) => candidate.id === costId);
  if (!cost) return;
  assertOpen(current, cost.propertyId, cost.year);
  commit({
    ...current,
    costs: current.costs.map((candidate) =>
      candidate.id === costId
        ? { ...candidate, receipts: candidate.receipts.filter((_, position) => position !== index) }
        : candidate,
    ),
  });
}

export function resetDemo() {
  commit(SEED_STATE);
}
