"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatEur } from "@/lib/allocation";
import { DomainError, finalizeYear, isFinalized, useAppState } from "@/lib/domain/store";
import { settleYear } from "@/lib/domain/settlement";
import { KEY_LABELS } from "@/lib/domain/types";
import {
  buttonPrimary,
  buttonQuiet,
  buttonSecondary,
  EmptyState,
  ErrorText,
  fieldLabel,
  fieldText,
  formatDateDe,
  Notice,
  Panel,
  Pill,
  SectionHeading,
} from "../../_components/ui";

const DISCLAIMER =
  "Erstellt mit Unterstützung der App. Prüfung durch den Vermieter bzw. eine Fachberatung erforderlich.";

function balanceLabel(cents: number): { text: string; tone: "warn" | "ok" | "neutral" } {
  if (cents > 0) return { text: "Nachzahlung", tone: "warn" };
  if (cents < 0) return { text: "Guthaben", tone: "ok" };
  return { text: "ausgeglichen", tone: "neutral" };
}

export function SettlementView({ propertyId, year }: { propertyId: string; year: number }) {
  const state = useAppState();
  const property = state.properties.find((candidate) => candidate.id === propertyId);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfUploaded, setPdfUploaded] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [openingPdf, setOpeningPdf] = useState(false);
  const [pdfDownloadError, setPdfDownloadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function syncStatement() {
      const response = await fetch(`/api/properties/${propertyId}/statements/${year}`);
      if (cancelled) return;

      if (response.ok) {
        const statement = (await response.json().catch(() => null)) as Record<string, unknown> | null;
        if (statement?.pdf_path) setPdfUploaded(true);
        if (!isFinalized(state, propertyId, year)) finalizeYear(propertyId, year);
        return;
      }

      if (response.status === 404 && isFinalized(state, propertyId, year)) {
        await fetch(`/api/properties/${propertyId}/statements/${year}`, {
          method: "POST",
        });
      }
    }

    void syncStatement().catch(() => {
      // The local draft/finalized state remains usable if Supabase is temporarily unavailable.
    });
    return () => {
      cancelled = true;
    };
  }, [propertyId, year, state]);

  if (!property) {
    return (
      <EmptyState title="Objekt nicht gefunden">
        <Link href="/app" className={buttonQuiet}>Zur Übersicht</Link>
      </EmptyState>
    );
  }

  const finalized = isFinalized(state, propertyId, year);
  const finalizedRecord = state.finalized.find((record) => record.propertyId === propertyId && record.year === year);
  const result = settleYear(state, propertyId, year);
  const unitLabel = new Map(state.units.map((unit) => [unit.id, unit.label]));
  const tenancyById = new Map(state.tenancies.map((tenancy) => [tenancy.id, tenancy]));
  const back = `/app/objekte/${propertyId}/${year}`;

  if (result.costs.length === 0) {
    return (
      <div className="space-y-8">
        <Link href={back} className={`${buttonQuiet} min-h-0 text-sm`}>Zurück zum Objekt</Link>
        <EmptyState title={`Keine Kosten für ${year}`}>
          Erfasse zuerst Kostenpositionen. Die Abrechnung entsteht aus den Kosten und den Mietverhältnissen.
        </EmptyState>
      </div>
    );
  }

  async function onFinalize() {
    try {
      const response = await fetch(`/api/properties/${propertyId}/statements/${year}`, {
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
      if (!response.ok) {
        throw new Error(typeof payload?.detail === "string" ? payload.detail : "Die Abrechnung konnte nicht archiviert werden.");
      }
      finalizeYear(propertyId, year);
      await generatePdf();
      setConfirming(false);
      setError(null);
    } catch (caught) {
      setError(caught instanceof DomainError ? caught.message : "Die Abrechnung konnte nicht abgeschlossen werden.");
    }
  }

  async function generatePdf(): Promise<boolean> {
    setPdfGenerating(true);
    setPdfError(null);
    try {
      const response = await fetch(`/api/properties/${propertyId}/statements/${year}/pdf/generate`, { method: "POST" });
      const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
      if (!response.ok) {
        setPdfError(typeof payload?.detail === "string" ? payload.detail : "Das PDF konnte nicht automatisch archiviert werden.");
        return false;
      }
      setPdfUploaded(true);
      return true;
    } catch {
      setPdfError("Das PDF konnte nicht automatisch archiviert werden. Du kannst es manuell hochladen.");
      return false;
    } finally {
      setPdfGenerating(false);
    }
  }

  async function onPdfUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const response = await fetch(`/api/properties/${propertyId}/statements/${year}/pdf`, {
      method: "POST",
      body: new FormData(form),
    });
    const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!response.ok) {
      setPdfError(typeof payload?.detail === "string" ? payload.detail : "Das PDF konnte nicht archiviert werden.");
      return;
    }
    setPdfUploaded(true);
    setPdfError(null);
    form.reset();
  }

  async function onOpenPdf() {
    setOpeningPdf(true);
    setPdfDownloadError(null);
    try {
      const response = await fetch(`/api/properties/${propertyId}/statements/${year}/pdf`);
      const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
      if (!response.ok || typeof payload?.url !== "string") {
        throw new Error(typeof payload?.detail === "string" ? payload.detail : "Das PDF konnte nicht geöffnet werden.");
      }
      window.open(payload.url, "_blank", "noopener,noreferrer");
    } catch (caught) {
      setPdfDownloadError(caught instanceof Error ? caught.message : "Das PDF konnte nicht geöffnet werden.");
    } finally {
      setOpeningPdf(false);
    }
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0">
          <Link href={back} className={`${buttonQuiet} min-h-0 text-sm`}>Zurück zum Objekt</Link>
          <h1 className="mt-4 font-sans text-[clamp(2.25rem,4vw,3.25rem)] font-black leading-none tracking-[-0.03em]">
            Abrechnung {year}
          </h1>
          <p className="mt-3 text-base text-ink-muted">{property.name}</p>
        </div>
        <div className="flex flex-wrap items-center gap-4" data-no-print>
          {finalized ? <Pill tone="done">Abgeschlossen</Pill> : <Pill tone="neutral">Entwurf</Pill>}
          <button type="button" onClick={() => window.print()} className={buttonSecondary}>
            Als PDF drucken
          </button>
        </div>
      </div>

      {finalized && finalizedRecord ? (
        <Notice>
          Abgeschlossen am {new Date(finalizedRecord.finalizedAt).toLocaleDateString("de-DE")}. Die Berechnung ist
          unveränderlich und bleibt im Archiv einsehbar.
        </Notice>
      ) : null}

      {finalized ? (
        <Panel>
          <SectionHeading note="Privater Supabase-Storage">PDF-Archiv</SectionHeading>
          {pdfUploaded ? (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-ink-muted">Das PDF ist privat archiviert. Der Öffnungslink ist 60 Sekunden gültig.</p>
              <button type="button" onClick={() => void onOpenPdf()} disabled={openingPdf} className={buttonQuiet}>
                {openingPdf ? "PDF wird geöffnet …" : "PDF öffnen"}
              </button>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-dashed border-rule pb-5">
                <p className="max-w-xl text-sm text-ink-muted">PDF direkt aus dem eingefrorenen Abrechnungsergebnis erzeugen und archivieren.</p>
                <button type="button" onClick={() => void generatePdf()} disabled={pdfGenerating} className={buttonQuiet}>
                  {pdfGenerating ? "PDF wird erzeugt …" : "PDF erzeugen und archivieren"}
                </button>
              </div>
              <form onSubmit={(event) => void onPdfUpload(event)} className="mt-5 flex flex-wrap items-end gap-4">
                <div className="min-w-0 flex-1">
                  <label htmlFor="statement-pdf" className={fieldLabel}>Oder vorhandenes PDF auswählen</label>
                  <input id="statement-pdf" name="pdf" type="file" required accept="application/pdf,.pdf" className={fieldText} />
                </div>
                <button type="submit" className={buttonQuiet}>PDF manuell archivieren</button>
              </form>
            </>
          )}
          {pdfError ? <div className="mt-4"><ErrorText>{pdfError}</ErrorText></div> : null}
          {pdfDownloadError ? <div className="mt-4"><ErrorText>{pdfDownloadError}</ErrorText></div> : null}
        </Panel>
      ) : null}

      <Panel>
        <SectionHeading>Ergebnis</SectionHeading>
        <dl className="grid gap-6 sm:grid-cols-3">
          <div>
            <dt className="text-sm text-ink-muted">Gesamtkosten</dt>
            <dd className="mt-1 font-mono text-2xl font-semibold tabular-nums">{formatEur(result.totalCostCents)}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-muted">Leerstand (Vermieter)</dt>
            <dd className="mt-1 font-mono text-2xl font-semibold tabular-nums">{formatEur(result.totalVacancyCents)}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-muted">Mietparteien</dt>
            <dd className="mt-1 font-mono text-2xl font-semibold tabular-nums">{result.tenancies.length}</dd>
          </div>
        </dl>
      </Panel>

      <section aria-labelledby="formeln" className="space-y-6">
        <h2 id="formeln" className="font-sans text-2xl font-extrabold tracking-tight">
          Formel-Karten je Kostenposition
        </h2>
        {result.costs.map((settlement) => (
          <details key={settlement.cost.id} className="receipt group px-5 py-6 sm:px-8" open>
            <summary className="flex cursor-pointer list-none flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
              <span>
                <span className="font-sans text-xl font-bold">{settlement.cost.category}</span>
                <span className="ml-3 text-sm text-ink-muted">{KEY_LABELS[settlement.cost.key]}</span>
              </span>
              <span className="font-mono text-lg font-semibold tabular-nums">{formatEur(settlement.cost.amountCents)}</span>
            </summary>

            <p className="mt-4 border-l-2 border-stamp pl-4 text-sm leading-relaxed text-ink-muted">{settlement.rule}</p>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[32rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-ink font-mono text-xs uppercase tracking-wider text-ink-muted">
                    <th scope="col" className="py-2 pr-4 font-semibold">Mietpartei</th>
                    <th scope="col" className="py-2 pr-4 font-semibold">Rechenweg</th>
                    <th scope="col" className="py-2 text-right font-semibold">Anteil</th>
                  </tr>
                </thead>
                <tbody>
                  {settlement.shares.map((share) => {
                    const tenancy = tenancyById.get(share.tenancyId);
                    return (
                      <tr key={share.tenancyId} className="border-b border-dashed border-rule align-top">
                        <td className="py-3 pr-4">
                          <span className="font-semibold">{tenancy ? unitLabel.get(tenancy.unitId) : "–"}</span>
                          <span className="block text-ink-muted">{tenancy?.tenant ?? ""}</span>
                        </td>
                        <td className="py-3 pr-4 font-mono text-xs leading-relaxed text-ink-muted">{share.formula}</td>
                        <td className="py-3 text-right font-mono font-semibold tabular-nums">{formatEur(share.cents)}</td>
                      </tr>
                    );
                  })}
                  <tr className="font-semibold">
                    <td className="py-3 pr-4" colSpan={2}>Leerstand (Vermieter)</td>
                    <td className="py-3 text-right font-mono tabular-nums">{formatEur(settlement.vacancyCents)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </details>
        ))}
      </section>

      <Panel>
        <SectionHeading note="Kosten minus Vorauszahlungen">Saldo je Mietpartei</SectionHeading>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead>
              <tr className="border-b border-ink font-mono text-xs uppercase tracking-wider text-ink-muted">
                <th scope="col" className="py-2 pr-4 font-semibold">Einheit</th>
                <th scope="col" className="py-2 pr-4 font-semibold">Mietpartei</th>
                <th scope="col" className="py-2 pr-4 text-right font-semibold">Tage</th>
                <th scope="col" className="py-2 pr-4 text-right font-semibold">Kosten</th>
                <th scope="col" className="py-2 pr-4 text-right font-semibold">Vorauszahlung</th>
                <th scope="col" className="py-2 text-right font-semibold">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {result.tenancies.map((row) => {
                const balance = balanceLabel(row.balanceCents);
                return (
                  <tr key={row.tenancy.id} className="border-b border-dashed border-rule">
                    <td className="py-3 pr-4 font-semibold">{row.unit.label}</td>
                    <td className="py-3 pr-4">
                      {row.tenancy.tenant}
                      <span className="block text-xs text-ink-muted">
                        {formatDateDe(row.tenancy.from)} – {row.tenancy.to ? formatDateDe(row.tenancy.to) : "laufend"}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right font-mono tabular-nums">{row.days}</td>
                    <td className="py-3 pr-4 text-right font-mono tabular-nums">{formatEur(row.costCents)}</td>
                    <td className="py-3 pr-4 text-right font-mono tabular-nums">
                      {formatEur(row.prepaidCents)}
                      <span className="block text-xs text-ink-muted">{row.months} Monate</span>
                    </td>
                    <td className="py-3 text-right">
                      <span className="font-mono font-semibold tabular-nums">{formatEur(Math.abs(row.balanceCents))}</span>
                      <span className="block">
                        <Pill tone={balance.tone}>{balance.text}</Pill>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel>
        <p className="border-l-2 border-ink pl-4 text-sm leading-relaxed">
          Auf jeder PDF-Abrechnung steht: „{DISCLAIMER}“
        </p>
        {finalized ? null : (
          <div className="mt-8 flex flex-wrap items-center gap-5" data-no-print>
            {confirming ? (
              <>
                <p className="max-w-xl text-sm font-semibold text-stamp-deep">
                  Nach dem Abschließen ist die Berechnung unveränderlich. Kosten, Einheiten und Mietverhältnisse für {year} sind dann gesperrt.
                </p>
                <button type="button" onClick={onFinalize} className={buttonPrimary}>
                  Jetzt abschließen
                </button>
                <button type="button" onClick={() => setConfirming(false)} className={buttonQuiet}>
                  Abbrechen
                </button>
              </>
            ) : (
              <button type="button" onClick={() => setConfirming(true)} className={buttonPrimary}>
                Abrechnung abschließen
              </button>
            )}
            {error ? <ErrorText>{error}</ErrorText> : null}
          </div>
        )}
      </Panel>
    </div>
  );
}
