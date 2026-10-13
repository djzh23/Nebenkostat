"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  isFinalized,
  replaceCostsForProperty,
  upsertFinalized,
  replaceProperties,
  replaceUnitsForProperty,
  resetDemo,
  useAppState,
} from "@/lib/domain/store";
import { settlementYear } from "@/lib/domain/settlement";
import type { AppState, KeyType } from "@/lib/domain/types";
import { buttonPrimary, buttonQuiet, buttonSecondary, EmptyState, Panel, Pill, SectionHeading } from "../../_components/ui";

const DAY_MS = 86_400_000;

function deadlineFor(year: number): string {
  return `31.12.${year + 1}`;
}

function statusFor(state: AppState, propertyId: string, year: number) {
  if (isFinalized(state, propertyId, year)) return { tone: "done" as const, label: "Abgerechnet" };
  const costs = state.costs.filter((cost) => cost.propertyId === propertyId && cost.year === year);
  if (costs.length === 0) return { tone: "warn" as const, label: "Kosten fehlen" };
  const withoutReceipts = costs.filter((cost) => cost.receipts.length === 0).length;
  if (withoutReceipts > 0) return { tone: "warn" as const, label: `Belege fehlen (${withoutReceipts})` };
  return { tone: "ok" as const, label: "Prüfbereit" };
}

// Current time as a stable snapshot. Null on the server, so the countdown never mismatches hydration.
function subscribeNever() {
  return () => {};
}

function currentDayIndex(): number {
  return Math.floor(Date.now() / DAY_MS);
}

function useNow(): number | null {
  const dayIndex = useSyncExternalStore(subscribeNever, currentDayIndex, () => null);
  return dayIndex === null ? null : dayIndex * DAY_MS;
}

export function Dashboard() {
  const state = useAppState();
  const [propertiesLoaded, setPropertiesLoaded] = useState(false);
  const [relatedDataLoaded, setRelatedDataLoaded] = useState(false);
  const now = useNow();
  const [confirmReset, setConfirmReset] = useState(false);
  const year = settlementYear();
  const deadline = Date.UTC(year + 1, 11, 31);
  const daysLeft = now === null ? null : Math.ceil((deadline - now) / DAY_MS);

  useEffect(() => {
    let cancelled = false;

    async function loadProperties() {
      try {
        const response = await fetch("/api/properties");
        const result = (await response.json().catch(() => null)) as unknown;
        if (!response.ok || !Array.isArray(result)) return;

        const properties = result.flatMap((item) => {
          if (!item || typeof item !== "object") return [];
          const record = item as Record<string, unknown>;
          if (
            typeof record.id !== "string" ||
            typeof record.name !== "string" ||
            typeof record.street !== "string" && record.street !== null ||
            typeof record.zip !== "string" && record.zip !== null ||
            typeof record.city !== "string" && record.city !== null
          ) return [];
          return [{
            id: record.id,
            name: record.name,
            street: typeof record.street === "string" ? record.street : "",
            zip: typeof record.zip === "string" ? record.zip : "",
            city: typeof record.city === "string" ? record.city : "",
          }];
        });

        if (!cancelled) {
          replaceProperties(properties);
          setPropertiesLoaded(true);
        }
      } catch {
        // Keep the local snapshot available if Supabase is temporarily unreachable.
      }
    }

    void loadProperties();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!propertiesLoaded) return;
    let cancelled = false;

    async function loadRelatedData() {
      try {
        const results = await Promise.all(
          state.properties.map(async (property) => {
            const [unitsResponse, costsResponse, statementResponse] = await Promise.all([
              fetch(`/api/properties/${property.id}/units`),
              fetch(`/api/properties/${property.id}/costs`),
              fetch(`/api/properties/${property.id}/statements/${year}`),
            ]);
            const unitsResult = (await unitsResponse.json().catch(() => null)) as unknown;
            const costsResult = (await costsResponse.json().catch(() => null)) as unknown;
            const statementResult = (await statementResponse.json().catch(() => null)) as unknown;
            return { propertyId: property.id, unitsResponse, costsResponse, statementResponse, unitsResult, costsResult, statementResult };
          }),
        );

        if (cancelled) return;

        for (const result of results) {
          if (result.unitsResponse.ok && Array.isArray(result.unitsResult)) {
            const units = result.unitsResult.flatMap((item) => {
              if (!item || typeof item !== "object") return [];
              const record = item as Record<string, unknown>;
              const areaM2 = Number(record.area_m2);
              if (
                typeof record.id !== "string" ||
                typeof record.property_id !== "string" ||
                typeof record.label !== "string" ||
                !Number.isFinite(areaM2) ||
                areaM2 <= 0
              ) return [];
              return [{
                id: record.id,
                propertyId: record.property_id,
                label: record.label,
                areaHundredths: Math.round(areaM2 * 100),
              }];
            });
            replaceUnitsForProperty(result.propertyId, units);
          }

          if (result.costsResponse.ok && Array.isArray(result.costsResult)) {
            const costs = result.costsResult.flatMap((item) => {
              if (!item || typeof item !== "object") return [];
              const record = item as Record<string, unknown>;
              const amountEur = Number(record.amount_eur);
              const year = Number(record.billing_year);
              const key = record.distribution_key;
              if (
                typeof record.id !== "string" ||
                typeof record.property_id !== "string" ||
                typeof record.category !== "string" ||
                !Number.isFinite(amountEur) ||
                !Number.isInteger(year) ||
                (key !== "flaeche" && key !== "personen" && key !== "einheiten")
              ) return [];
              return [{
                id: record.id,
                propertyId: record.property_id,
                year,
                category: record.category,
                amountCents: Math.round(amountEur * 100),
                key: key as KeyType,
                receipts: typeof record.receipt_path === "string" && record.receipt_path ? [record.receipt_path] : [],
              }];
            });
            replaceCostsForProperty(result.propertyId, costs);
          }

          if (result.statementResponse.ok && result.statementResult && typeof result.statementResult === "object") {
            const statement = result.statementResult as Record<string, unknown>;
            if (statement.status === "finalized" && typeof statement.finalized_at === "string") {
              upsertFinalized({
                propertyId: result.propertyId,
                year,
                finalizedAt: statement.finalized_at,
              });
            }
          }
        }

        setRelatedDataLoaded(true);
      } catch {
        // Keep the dashboard usable if a related-data request is temporarily unavailable.
      }
    }

    void loadRelatedData();
    return () => {
      cancelled = true;
    };
  }, [propertiesLoaded, state.properties, year]);

  const properties = propertiesLoaded ? state.properties : [];

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="font-sans text-[clamp(2.25rem,4vw,3.25rem)] font-black leading-none tracking-[-0.03em]">
            Übersicht
          </h1>
          <p className="mt-3 text-base text-ink-muted">
            Abrechnungsjahr {year}. Frist laut Orientierung: {deadlineFor(year)}
            {daysLeft !== null ? ` · noch ${daysLeft} Tage` : ""}.
          </p>
        </div>
        <Link href="/app/objekte/neu" className={buttonPrimary}>
          Objekt anlegen
        </Link>
      </div>

      <Panel>
        <SectionHeading note={`${properties.length} Objekt${properties.length === 1 ? "" : "e"}`}>
          Objekte
        </SectionHeading>

        {properties.length === 0 ? (
          <EmptyState title="Noch kein Objekt angelegt">
            Lege ein Objekt mit Einheiten an. Danach erscheint die erste Formel-Karte, sobald eine Kostenposition erfasst ist.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-dashed divide-rule">
            {properties.map((property) => {
              const status = relatedDataLoaded
                ? statusFor(state, property.id, year)
                : { tone: "neutral" as const, label: "Daten werden geladen" };
              const unitCount = relatedDataLoaded
                ? state.units.filter((unit) => unit.propertyId === property.id).length
                : null;
              return (
                <li key={property.id} className="grid gap-3 py-5 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div className="min-w-0">
                    <Link
                      href={`/app/objekte/${property.id}/${year}`}
                      className="font-sans text-xl font-bold underline decoration-ink/30 decoration-2 underline-offset-4 hover:decoration-stamp"
                    >
                      {property.name}
                    </Link>
                    <p className="mt-1 text-sm text-ink-muted">
                      {[property.street, [property.zip, property.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") || "Keine Adresse"}
                      {" · "}
                      {unitCount === null ? "Daten werden geladen" : `${unitCount} Einheit${unitCount === 1 ? "" : "en"}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                    <Pill tone={status.tone}>{status.label}</Pill>
                    <Link href={`/app/objekte/${property.id}/${year}/abrechnung`} className={buttonSecondary}>
                      Abrechnung
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <div className="flex flex-wrap items-center gap-6 text-sm text-ink-muted">
        {confirmReset ? (
          <>
            <p className="font-semibold text-stamp-deep">Alle Daten in diesem Browser werden gelöscht.</p>
            <button
              type="button"
              className={`${buttonQuiet} min-h-0 text-stamp-deep`}
              onClick={() => {
                resetDemo();
                setConfirmReset(false);
              }}
            >
              Ja, zurücksetzen
            </button>
            <button type="button" className={`${buttonQuiet} min-h-0`} onClick={() => setConfirmReset(false)}>
              Abbrechen
            </button>
          </>
        ) : (
          <button type="button" className={`${buttonQuiet} min-h-0`} onClick={() => setConfirmReset(true)}>
            Beispieldaten zurücksetzen
          </button>
        )}
      </div>
    </div>
  );
}
