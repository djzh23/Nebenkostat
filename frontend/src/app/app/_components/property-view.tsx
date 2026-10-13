"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { formatEur, formatM2 } from "@/lib/allocation";
import {
  deleteCost,
  DomainError,
  isFinalized,
  replaceCostsForProperty,
  replaceTenanciesForUnits,
  replaceUnitsForProperty,
  upsertTenancy,
  upsertCost,
  upsertUnit,
  useAppState,
} from "@/lib/domain/store";
import { activeDays } from "@/lib/domain/settlement";
import { COST_CATEGORIES, KEY_LABELS, type AppState, type KeyType } from "@/lib/domain/types";
import {
  buttonPrimary,
  buttonQuiet,
  EmptyState,
  ErrorText,
  fieldInput,
  fieldLabel,
  fieldText,
  formatDateDe,
  Panel,
  Pill,
  SectionHeading,
} from "../../_components/ui";

const selectClass = `${fieldText} cursor-pointer`;

export function PropertyView({ propertyId, year, otherYears }: { propertyId: string; year: number; otherYears: number[] }) {
  const state = useAppState();
  const [unitsLoaded, setUnitsLoaded] = useState(false);
  const [costsLoaded, setCostsLoaded] = useState(false);
  const [tenanciesLoaded, setTenanciesLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadUnits() {
      try {
        const response = await fetch(`/api/properties/${propertyId}/units`);
        const result = (await response.json().catch(() => null)) as unknown;
        if (!response.ok || !Array.isArray(result)) return;

        const units = result.flatMap((item) => {
          if (!item || typeof item !== "object") return [];
          const record = item as Record<string, unknown>;
          const areaM2 = Number(record.area_m2);
          if (
            typeof record.id !== "string" ||
            typeof record.property_id !== "string" ||
            typeof record.label !== "string" ||
            !Number.isFinite(areaM2) ||
            areaM2 <= 0
          ) {
            return [];
          }
          return [{
            id: record.id,
            propertyId: record.property_id,
            label: record.label,
            areaHundredths: Math.round(areaM2 * 100),
          }];
        });

        if (!cancelled) {
          replaceUnitsForProperty(propertyId, units);
          setUnitsLoaded(true);
        }
      } catch {
        // The existing local state remains available if Supabase is temporarily unreachable.
      }
    }

    void loadUnits();
    return () => {
      cancelled = true;
    };
  }, [propertyId]);

  useEffect(() => {
    if (!unitsLoaded) return;
    let cancelled = false;

    async function loadTenancies() {
      try {
        const propertyUnits = state.units.filter((unit) => unit.propertyId === propertyId);
        const response = await fetch(`/api/properties/${propertyId}/tenancies`);
        const result = (await response.json().catch(() => null)) as unknown;
        if (!response.ok || !Array.isArray(result)) return;

        const tenancies = result.flatMap((item) => {
          if (!item || typeof item !== "object") return [];
          const record = item as Record<string, unknown>;
          const persons = Number(record.persons);
          const prepayment = Number(record.monthly_prepayment_eur);
          if (
            typeof record.id !== "string" ||
            typeof record.unit_id !== "string" ||
            typeof record.tenant_name !== "string" ||
            typeof record.start_date !== "string" ||
            !Number.isInteger(persons) ||
            !Number.isFinite(prepayment)
          ) return [];
          return [{
            id: record.id,
            unitId: record.unit_id,
            tenant: record.tenant_name,
            from: record.start_date,
            to: record.end_date ? String(record.end_date) : null,
            persons,
            prepaymentCents: Math.round(prepayment * 100),
          }];
        });

        if (!cancelled) {
          replaceTenanciesForUnits(propertyUnits.map((unit) => unit.id), tenancies);
          setTenanciesLoaded(true);
        }
      } catch {
        // The existing local state remains available if Supabase is temporarily unreachable.
      }
    }

    void loadTenancies();
    return () => {
      cancelled = true;
    };
  }, [propertyId, unitsLoaded, state.units]);

  useEffect(() => {
    let cancelled = false;

    async function loadCosts() {
      try {
        const response = await fetch(`/api/properties/${propertyId}/costs`);
        const result = (await response.json().catch(() => null)) as unknown;
        if (!response.ok || !Array.isArray(result)) return;

        const costs = result.flatMap((item) => {
          if (!item || typeof item !== "object") return [];
          const record = item as Record<string, unknown>;
          const amountEur = Number(record.amount_eur);
          const yearValue = Number(record.billing_year);
          const key = record.distribution_key;
          if (
            typeof record.id !== "string" ||
            typeof record.property_id !== "string" ||
            typeof record.category !== "string" ||
            !Number.isFinite(amountEur) ||
            !Number.isInteger(yearValue) ||
            (key !== "flaeche" && key !== "personen" && key !== "einheiten")
          ) {
            return [];
          }
          return [{
            id: record.id,
            propertyId: record.property_id,
            year: yearValue,
            category: record.category,
            amountCents: Math.round(amountEur * 100),
            key: key as KeyType,
            receipts: typeof record.receipt_path === "string" && record.receipt_path
              ? [record.receipt_path.split("/").at(-1) ?? record.receipt_path]
              : [],
          }];
        });

        if (!cancelled) {
          replaceCostsForProperty(propertyId, costs);
          setCostsLoaded(true);
        }
      } catch {
        // The existing local state remains available if Supabase is temporarily unreachable.
      }
    }

    void loadCosts();
    return () => {
      cancelled = true;
    };
  }, [propertyId]);

  const property = state.properties.find((candidate) => candidate.id === propertyId);

  if (!property) {
    return (
      <EmptyState title="Objekt nicht gefunden">
        <Link href="/app" className={buttonQuiet}>
          Zur Übersicht
        </Link>
      </EmptyState>
    );
  }

  const locked = isFinalized(state, propertyId, year);
  const finalizedAny = state.finalized.some((record) => record.propertyId === propertyId);
  const units = unitsLoaded ? state.units.filter((unit) => unit.propertyId === propertyId) : [];
  const unitIds = new Set(units.map((unit) => unit.id));
  const tenanciesInYear = (tenanciesLoaded ? state.tenancies : []).filter(
    (tenancy) => unitIds.has(tenancy.unitId) && activeDays(tenancy, year) > 0,
  );
  const costs = costsLoaded
    ? state.costs.filter((cost) => cost.propertyId === propertyId && cost.year === year)
    : [];
  const address = [property.street, [property.zip, property.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0">
          <Link href="/app" className={`${buttonQuiet} min-h-0 text-sm`}>
            Zur Übersicht
          </Link>
          <h1 className="mt-4 font-sans text-[clamp(2.25rem,4vw,3.25rem)] font-black leading-none tracking-[-0.03em]">
            {property.name}
          </h1>
          <p className="mt-3 text-base text-ink-muted">{address || "Keine Adresse hinterlegt"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {locked ? <Pill tone="done">Abgerechnet</Pill> : null}
          <Link href={`/app/objekte/${propertyId}/${year}/abrechnung`} className={buttonPrimary}>
            Abrechnung {year}
          </Link>
        </div>
      </div>

      <nav aria-label="Abrechnungsjahr" className="flex flex-wrap gap-3 text-sm font-semibold">
        {[year, ...otherYears].map((candidate) => (
          <Link
            key={candidate}
            href={`/app/objekte/${propertyId}/${candidate}`}
            aria-current={candidate === year ? "page" : undefined}
            className={
              candidate === year
                ? "border border-ink bg-ink px-3 py-1 text-paper"
                : "border border-ink/30 px-3 py-1 hover:border-ink"
            }
          >
            {candidate}
          </Link>
        ))}
      </nav>

      <UnitsPanel propertyId={propertyId} units={units} state={state} />
      <TenanciesPanel units={units} tenancies={tenanciesInYear} year={year} locked={finalizedAny} />
      <CostsPanel propertyId={propertyId} year={year} costs={costs} locked={locked} />
    </div>
  );
}

function useFormError() {
  const [error, setError] = useState<string | null>(null);
  function run(action: () => void) {
    try {
      action();
      setError(null);
      return true;
    } catch (caught) {
      setError(caught instanceof DomainError ? caught.message : "Das konnte nicht gespeichert werden.");
      return false;
    }
  }
  async function runAsync(action: () => Promise<void>) {
    try {
      await action();
      setError(null);
      return true;
    } catch (caught) {
      setError(caught instanceof DomainError || caught instanceof Error ? caught.message : "Das konnte nicht gespeichert werden.");
      return false;
    }
  }
  return { error, run, runAsync };
}

function UnitsPanel({
  propertyId,
  units,
  state,
}: {
  propertyId: string;
  units: AppState["units"];
  state: AppState;
}) {
  const { error, runAsync } = useFormError();
  const totalHundredths = units.reduce((sum, unit) => sum + unit.areaHundredths, 0);
  const finalizedAny = state.finalized.some((record) => record.propertyId === propertyId);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const saved = await runAsync(async () => {
      const response = await fetch(`/api/properties/${propertyId}/units`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: String(data.get("label") ?? ""),
          areaM2: String(data.get("area") ?? "").replace(",", "."),
        }),
      });

      if (!response.ok) {
        let message = "Die Einheit konnte nicht gespeichert werden.";
        try {
          const body = (await response.json()) as { detail?: unknown };
          if (typeof body.detail === "string") message = body.detail;
        } catch {
          // Keep the generic message when the response is not JSON.
        }
        throw new Error(message);
      }

      const created = (await response.json()) as {
        id?: unknown;
        property_id?: unknown;
        label?: unknown;
        area_m2?: unknown;
      };
      if (
        typeof created.id !== "string" ||
        typeof created.property_id !== "string" ||
        typeof created.label !== "string" ||
        (typeof created.area_m2 !== "number" && typeof created.area_m2 !== "string")
      ) {
        throw new Error("Die API hat eine ungültige Einheit zurückgegeben.");
      }

      const areaM2 = Number(created.area_m2);
      if (!Number.isFinite(areaM2) || areaM2 <= 0) {
        throw new Error("Die API hat eine ungültige Wohnfläche zurückgegeben.");
      }

      upsertUnit({
        id: created.id,
        propertyId: created.property_id,
        label: created.label,
        areaHundredths: Math.round(areaM2 * 100),
      });
    });
    if (saved) form.reset();
  }

  return (
    <Panel>
      <SectionHeading note={units.length ? `Gesamtfläche ${formatM2(totalHundredths)}` : undefined}>Einheiten</SectionHeading>
      {units.length === 0 ? (
        <p className="mb-6 text-base text-ink-muted">Noch keine Einheit. Die Wohnfläche ist der Nenner für den Flächenschlüssel.</p>
      ) : (
        <ul className="mb-8 divide-y divide-dashed divide-rule">
          {units.map((unit) => (
            <li key={unit.id} className="flex items-baseline justify-between gap-6 py-3">
              <span className="font-semibold">{unit.label}</span>
              <span className="font-mono tabular-nums">{formatM2(unit.areaHundredths)}</span>
            </li>
          ))}
        </ul>
      )}

      {finalizedAny ? (
        <p className="text-sm text-ink-muted">Einheiten sind gesperrt, weil eine Abrechnung dieses Objekts abgeschlossen ist.</p>
      ) : (
        <form onSubmit={onSubmit} className="grid gap-5 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
          <div>
            <label htmlFor="unit-label" className={fieldLabel}>Bezeichnung</label>
            <input id="unit-label" name="label" required placeholder="z. B. EG links" className={fieldText} />
          </div>
          <div>
            <label htmlFor="unit-area" className={fieldLabel}>Wohnfläche in m²</label>
            <input id="unit-area" name="area" required inputMode="decimal" placeholder="62,5" className={fieldInput} />
          </div>
          <button type="submit" className={buttonPrimary}>Einheit hinzufügen</button>
          {error ? <div className="sm:col-span-3"><ErrorText>{error}</ErrorText></div> : null}
        </form>
      )}
    </Panel>
  );
}

function TenanciesPanel({
  units,
  tenancies,
  year,
  locked,
}: {
  units: AppState["units"];
  tenancies: AppState["tenancies"];
  year: number;
  locked: boolean;
}) {
  const { error, runAsync } = useFormError();
  const unitLabel = new Map(units.map((unit) => [unit.id, unit.label]));

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const saved = await runAsync(async () => {
      const response = await fetch(`/api/properties/${units[0]?.propertyId ?? ""}/tenancies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unitId: String(data.get("unit") ?? ""),
          tenantName: String(data.get("tenant") ?? ""),
          startDate: String(data.get("from") ?? ""),
          endDate: String(data.get("to") ?? "") || null,
          persons: String(data.get("persons") ?? ""),
          monthlyPrepaymentEur: String(data.get("prepayment") ?? "").replace(",", "."),
        }),
      });

      const result = (await response.json().catch(() => null)) as Record<string, unknown> | null;
      if (!response.ok) {
        throw new Error(typeof result?.detail === "string" ? result.detail : "Das Mietverhältnis konnte nicht gespeichert werden.");
      }
      if (!result || typeof result.id !== "string" || typeof result.unit_id !== "string") {
        throw new Error("Die API hat ein ungültiges Mietverhältnis zurückgegeben.");
      }

      const prepayment = Number(result.monthly_prepayment_eur);
      const persons = Number(result.persons);
      if (!Number.isFinite(prepayment) || !Number.isInteger(persons)) {
        throw new Error("Die API hat ungültige Mietverhältnis-Daten zurückgegeben.");
      }

      upsertTenancy({
        id: result.id,
        unitId: result.unit_id,
        tenant: String(result.tenant_name ?? ""),
        from: String(result.start_date ?? ""),
        to: result.end_date ? String(result.end_date) : null,
        persons,
        prepaymentCents: Math.round(prepayment * 100),
      });
    });
    if (saved) form.reset();
  }

  return (
    <Panel>
      <SectionHeading note={`Mietverhältnisse, die ${year} bestehen`}>Mietverhältnisse</SectionHeading>
      {units.length === 0 ? (
        <p className="text-base text-ink-muted">Lege zuerst eine Einheit an.</p>
      ) : (
        <>
          {tenancies.length === 0 ? (
            <p className="mb-8 text-base text-ink-muted">Kein Mietverhältnis in {year}. Leerstand wird in der Abrechnung ausgewiesen.</p>
          ) : (
            <ul className="mb-8 divide-y divide-dashed divide-rule">
              {tenancies.map((tenancy) => (
                <li key={tenancy.id} className="grid gap-2 py-4 sm:grid-cols-[10rem_1fr_auto] sm:items-baseline sm:gap-6">
                  <span className="font-semibold">{unitLabel.get(tenancy.unitId) ?? "–"}</span>
                  <span>
                    {tenancy.tenant}
                    <span className="block text-sm text-ink-muted">
                      {formatDateDe(tenancy.from)} – {tenancy.to ? formatDateDe(tenancy.to) : "laufend"} · {tenancy.persons} Person{tenancy.persons === 1 ? "" : "en"}
                    </span>
                  </span>
                  <span className="font-mono text-sm tabular-nums">{formatEur(tenancy.prepaymentCents)} / Monat</span>
                </li>
              ))}
            </ul>
          )}

          {locked ? (
            <p className="text-sm text-ink-muted">Mietverhältnisse sind gesperrt, weil eine Abrechnung dieses Objekts abgeschlossen ist.</p>
          ) : (
            <form onSubmit={onSubmit} className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="tenancy-unit" className={fieldLabel}>Einheit</label>
                <select id="tenancy-unit" name="unit" required className={selectClass} defaultValue={units[0]?.id}>
                  {units.map((unit) => (
                    <option key={unit.id} value={unit.id}>{unit.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="tenancy-tenant" className={fieldLabel}>Mietpartei</label>
                <input id="tenancy-tenant" name="tenant" required placeholder="Name oder Bezeichnung" className={fieldText} />
              </div>
              <div>
                <label htmlFor="tenancy-from" className={fieldLabel}>Einzug</label>
                <input id="tenancy-from" name="from" type="date" required className={fieldText} />
              </div>
              <div>
                <label htmlFor="tenancy-to" className={fieldLabel}>Auszug (leer = laufend)</label>
                <input id="tenancy-to" name="to" type="date" className={fieldText} />
              </div>
              <div>
                <label htmlFor="tenancy-persons" className={fieldLabel}>Personen</label>
                <input id="tenancy-persons" name="persons" type="number" min={1} step={1} required defaultValue={1} className={fieldInput} />
              </div>
              <div>
                <label htmlFor="tenancy-prepayment" className={fieldLabel}>Vorauszahlung pro Monat in €</label>
                <input id="tenancy-prepayment" name="prepayment" inputMode="decimal" required placeholder="180,00" className={fieldInput} />
              </div>
              <div className="sm:col-span-2 space-y-4">
                {error ? <ErrorText>{error}</ErrorText> : null}
                <button type="submit" className={buttonPrimary}>Mietverhältnis speichern</button>
              </div>
            </form>
          )}
        </>
      )}
    </Panel>
  );
}

const keyOptions = (Object.keys(KEY_LABELS) as KeyType[]).map((key) => ({ key, label: KEY_LABELS[key] }));

function CostsPanel({
  propertyId,
  year,
  costs,
  locked,
}: {
  propertyId: string;
  year: number;
  costs: AppState["costs"];
  locked: boolean;
}) {
  const { error, runAsync } = useFormError();
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [openingReceiptId, setOpeningReceiptId] = useState<string | null>(null);
  const [receiptOpenError, setReceiptOpenError] = useState<string | null>(null);
  const [zipDownloading, setZipDownloading] = useState(false);
  const [zipError, setZipError] = useState<string | null>(null);

  async function onDelete(costId: string) {
    const response = await fetch(`/api/properties/${propertyId}/costs/${costId}`, { method: "DELETE" });
    const result = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!response.ok) {
      throw new Error(typeof result?.detail === "string" ? result.detail : "Die Kostenposition konnte nicht gelöscht werden.");
    }
    deleteCost(costId);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const saved = await runAsync(async () => {
      const response = await fetch(`/api/properties/${propertyId}/costs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billingYear: year,
          category: String(data.get("category") ?? COST_CATEGORIES[0]),
          amountEur: String(data.get("amount") ?? "").replace(",", "."),
          distributionKey: String(data.get("key") ?? "flaeche"),
        }),
      });

      const result = (await response.json().catch(() => null)) as Record<string, unknown> | null;
      if (!response.ok) {
        throw new Error(typeof result?.detail === "string" ? result.detail : "Die Kostenposition konnte nicht gespeichert werden.");
      }
      if (!result || typeof result.id !== "string" || typeof result.property_id !== "string") {
        throw new Error("Die API hat eine ungültige Kostenposition zurückgegeben.");
      }

      const amountEur = Number(result.amount_eur);
      const billingYear = Number(result.billing_year);
      const key = result.distribution_key;
      if (!Number.isFinite(amountEur) || !Number.isInteger(billingYear) || (key !== "flaeche" && key !== "personen" && key !== "einheiten")) {
        throw new Error("Die API hat ungültige Kostendaten zurückgegeben.");
      }

      upsertCost({
        id: result.id,
        propertyId: result.property_id,
        year: billingYear,
        category: String(result.category ?? ""),
        amountCents: Math.round(amountEur * 100),
        key,
        receipts: [],
      });
    });
    if (saved) form.reset();
  }

  async function onReceipt(event: FormEvent<HTMLFormElement>, cost: AppState["costs"][number]) {
    event.preventDefault();
    const form = event.currentTarget;
    const response = await fetch(`/api/properties/${propertyId}/costs/${cost.id}/receipt`, {
      method: "POST",
      body: new FormData(form),
    });
    const result = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!response.ok) {
      setReceiptError(typeof result?.detail === "string" ? result.detail : "Der Beleg konnte nicht gespeichert werden.");
      return;
    }
    if (typeof result?.fileName !== "string") {
      setReceiptError("Die API hat keinen gültigen Beleg zurückgegeben.");
      return;
    }

    upsertCost({ ...cost, receipts: [result.fileName] });
    setReceiptError(null);
    form.reset();
  }

  async function onOpenReceipt(cost: AppState["costs"][number]) {
    setOpeningReceiptId(cost.id);
    setReceiptOpenError(null);
    try {
      const response = await fetch(`/api/properties/${propertyId}/costs/${cost.id}/receipt`);
      const result = (await response.json().catch(() => null)) as Record<string, unknown> | null;
      if (!response.ok || typeof result?.url !== "string") {
        throw new Error(typeof result?.detail === "string" ? result.detail : "Der Beleg konnte nicht geöffnet werden.");
      }
      window.open(result.url, "_blank", "noopener,noreferrer");
    } catch (caught) {
      setReceiptOpenError(caught instanceof Error ? caught.message : "Der Beleg konnte nicht geöffnet werden.");
    } finally {
      setOpeningReceiptId(null);
    }
  }

  async function onDownloadArchive() {
    setZipDownloading(true);
    setZipError(null);
    try {
      const response = await fetch(`/api/properties/${propertyId}/receipts/zip?year=${year}`);
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as Record<string, unknown> | null;
        throw new Error(typeof result?.detail === "string" ? result.detail : "Das Belegarchiv konnte nicht erstellt werden.");
      }

      const archive = await response.blob();
      const url = URL.createObjectURL(archive);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Belegarchiv-${year}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (caught) {
      setZipError(caught instanceof Error ? caught.message : "Das Belegarchiv konnte nicht erstellt werden.");
    } finally {
      setZipDownloading(false);
    }
  }

  return (
    <Panel>
      <SectionHeading note={`Kostenpositionen ${year}`}>Kosten und Belege</SectionHeading>

      {costs.some((cost) => cost.receipts.length > 0) ? (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-dashed border-rule pb-5">
          <p className="text-sm text-ink-muted">Alle archivierten Belege dieses Jahres gesammelt herunterladen.</p>
          <button type="button" onClick={() => void onDownloadArchive()} disabled={zipDownloading} className={buttonQuiet}>
            {zipDownloading ? "ZIP wird erstellt …" : "Belegarchiv als ZIP laden"}
          </button>
        </div>
      ) : null}

      {costs.length === 0 ? (
        <EmptyState title={`Noch keine Kosten für ${year}`}>
          Erfasse eine Kostenposition mit Betrag und Verteilungsschlüssel. Die Formel-Karte erscheint in der Abrechnung.
        </EmptyState>
      ) : (
        <ul className="mb-8 divide-y divide-dashed divide-rule">
          {costs.map((cost) => (
            <li key={cost.id} className="py-5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
                <div>
                  <p className="font-sans text-lg font-bold">{cost.category}</p>
                  <p className="text-sm text-ink-muted">Schlüssel: {KEY_LABELS[cost.key]}</p>
                </div>
                <div className="flex items-center gap-5">
                  <span className="font-mono text-lg font-semibold tabular-nums">{formatEur(cost.amountCents)}</span>
                  {locked ? null : (
                    <button
                      type="button"
                      className={`${buttonQuiet} min-h-0 text-sm text-stamp-deep`}
                      onClick={() => void runAsync(() => onDelete(cost.id))}
                    >
                      Löschen
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4 space-y-3 border-l-2 border-rule pl-4">
                <p className="text-sm font-semibold">
                  Belege <span className="font-mono">({cost.receipts.length})</span>
                </p>
                {cost.receipts.length === 0 ? (
                  <p className="text-sm text-stamp-deep">Noch kein Beleg. Ohne Beleg fehlt der Nachweis für diese Position.</p>
                ) : (
                  <ul className="space-y-1 text-sm text-ink-muted">
                    {cost.receipts.map((receipt, index) => (
                      <li key={`${receipt}-${index}`} className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span>{receipt}</span>
                        <button
                          type="button"
                          className={`${buttonQuiet} min-h-0 text-sm`}
                          onClick={() => void onOpenReceipt(cost)}
                          disabled={openingReceiptId === cost.id}
                        >
                          {openingReceiptId === cost.id ? "Wird geöffnet …" : "Beleg öffnen"}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {locked ? null : (
                  <form onSubmit={(event) => void onReceipt(event, cost)} className="flex flex-wrap items-end gap-3">
                    <div className="min-w-0 flex-1">
                      <label htmlFor={`receipt-${cost.id}`} className="sr-only">Belegname für {cost.category}</label>
                      <input
                        id={`receipt-${cost.id}`}
                        name="receipt"
                        type="file"
                        required
                        className={fieldText}
                        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                      />
                    </div>
                    <button type="submit" className={`${buttonQuiet} min-h-11`}>Beleg hochladen</button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {receiptError ? <div className="mb-6"><ErrorText>{receiptError}</ErrorText></div> : null}
      {receiptOpenError ? <div className="mb-6"><ErrorText>{receiptOpenError}</ErrorText></div> : null}
      {zipError ? <div className="mb-6"><ErrorText>{zipError}</ErrorText></div> : null}

      {locked ? (
        <p className="text-sm text-ink-muted">Kosten sind gesperrt, weil die Abrechnung {year} abgeschlossen ist.</p>
      ) : (
        <form onSubmit={onSubmit} className="grid gap-5 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
          <div>
            <label htmlFor="cost-category" className={fieldLabel}>Kostenart</label>
            <select id="cost-category" name="category" className={selectClass} defaultValue={COST_CATEGORIES[0]}>
              {COST_CATEGORIES.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="cost-amount" className={fieldLabel}>Betrag in € (Jahr)</label>
            <input id="cost-amount" name="amount" inputMode="decimal" required placeholder="1.200,00" className={fieldInput} />
          </div>
          <div>
            <label htmlFor="cost-key" className={fieldLabel}>Verteilungsschlüssel</label>
            <select id="cost-key" name="key" className={selectClass} defaultValue="flaeche">
              {keyOptions.map((option) => (
                <option key={option.key} value={option.key}>{option.label}</option>
              ))}
            </select>
          </div>
          <button type="submit" className={buttonPrimary}>Kosten speichern</button>
          {error ? <div className="sm:col-span-4"><ErrorText>{error}</ErrorText></div> : null}
        </form>
      )}
    </Panel>
  );
}
