"use client";

import { useId, useState, type CSSProperties } from "react";
import { allocateByArea, formatEur, formatM2, parseEuroToCents, parseM2 } from "@/lib/allocation";
import { Receipt } from "@/components/ui/receipt";

const COST_TYPES = ["Wasser", "Müll", "Heizung", "Grundsteuer", "Versicherung"] as const;
type CostType = (typeof COST_TYPES)[number];

// Each line prints in sequence on first render (see `.print-line` in globals.css).
const printDelay = (index: number) => ({ "--i": index }) as CSSProperties;

const row = "print-line flex items-baseline justify-between gap-4 border-b border-dashed border-rule py-3 sm:gap-6";
const rowLabel = "text-ink-muted";
const figureInput = "w-24 bg-transparent text-right font-mono tabular-nums text-ink outline-none sm:w-32";
const unitSuffix = "font-mono text-ink-muted";

const validationMessage = (cost: number | null, unit: number | null, total: number | null) => {
  if (cost === null) return "Betrag eingeben, z. B. 1.200,00";
  if (unit === null) return "Wohnfläche in m² eingeben";
  if (total === null) return "Gesamtfläche in m² eingeben";
  if (unit > total) return "Die Wohnfläche ist größer als die Gesamtfläche.";
  return null;
};

export function ReceiptCalculator() {
  const typeId = useId();
  const costId = useId();
  const unitId = useId();
  const totalId = useId();
  const errorId = useId();

  const [costType, setCostType] = useState<CostType>("Wasser");
  const [cost, setCost] = useState("1.200,00");
  const [unitArea, setUnitArea] = useState("62");
  const [totalArea, setTotalArea] = useState("180");

  const costCents = parseEuroToCents(cost);
  const unitHundredths = parseM2(unitArea);
  const totalHundredths = parseM2(totalArea);
  const error = validationMessage(costCents, unitHundredths, totalHundredths);

  const result =
    error === null && costCents !== null && unitHundredths !== null && totalHundredths !== null
      ? allocateByArea(costCents, unitHundredths, totalHundredths)
      : null;

  return (
    <Receipt as="article" padding="md" className="w-full max-w-[440px]">
      <header className="flex items-start justify-between gap-4 border-b border-ink pb-4">
        <div>
          <p className="text-sm font-semibold tracking-tight">Nebenkostat</p>
          <p className="font-mono text-xs text-ink-muted">Beleg, Umlage</p>
        </div>
        <span className="border-2 border-stamp px-2 py-0.5 font-mono text-xs font-semibold uppercase tracking-widest text-stamp">
          Beispiel
        </span>
      </header>

      <div className="text-sm">
        <div className={row} style={printDelay(0)}>
          <label htmlFor={typeId} className={rowLabel}>Kostenart</label>
          <select
            id={typeId}
            value={costType}
            onChange={(event) => setCostType(event.target.value as CostType)}
            className="max-w-[60%] cursor-pointer bg-transparent text-right font-medium text-ink outline-none"
          >
            {COST_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <div className={row} style={printDelay(1)}>
          <label htmlFor={costId} className={rowLabel}>Betrag gesamt</label>
          <span className="flex items-baseline gap-1">
            <input
              id={costId}
              inputMode="decimal"
              value={cost}
              onChange={(event) => setCost(event.target.value)}
              aria-invalid={costCents === null}
              aria-describedby={error ? errorId : undefined}
              className={figureInput}
            />
            <span aria-hidden className={unitSuffix}>€</span>
          </span>
        </div>

        <div className={row} style={printDelay(2)}>
          <label htmlFor={unitId} className={rowLabel}>Wohnfläche</label>
          <span className="flex items-baseline gap-1">
            <input
              id={unitId}
              inputMode="decimal"
              value={unitArea}
              onChange={(event) => setUnitArea(event.target.value)}
              aria-invalid={unitHundredths === null}
              className={figureInput}
            />
            <span aria-hidden className={unitSuffix}>m²</span>
          </span>
        </div>

        <div className={row} style={printDelay(3)}>
          <label htmlFor={totalId} className={rowLabel}>Gesamtfläche</label>
          <span className="flex items-baseline gap-1">
            <input
              id={totalId}
              inputMode="decimal"
              value={totalArea}
              onChange={(event) => setTotalArea(event.target.value)}
              aria-invalid={totalHundredths === null}
              className={figureInput}
            />
            <span aria-hidden className={unitSuffix}>m²</span>
          </span>
        </div>
      </div>

      <div aria-live="polite" className="mt-6 min-h-36">
        {error ? (
          <p id={errorId} role="alert" className="font-medium text-stamp-deep">
            {error}
          </p>
        ) : result && costCents !== null && unitHundredths !== null && totalHundredths !== null ? (
          <>
            <p className="print-line font-mono text-sm tabular-nums text-ink-muted" style={printDelay(4)}>
              {formatEur(costCents)} × {formatM2(unitHundredths)} ÷ {formatM2(totalHundredths)}
            </p>

            <div className="print-line mt-4 flex items-end justify-between gap-4 border-y-2 border-ink py-4" style={printDelay(5)}>
              <span className="whitespace-nowrap text-lg font-bold">Anteil</span>
              <span className="text-4xl font-extrabold tabular-nums tracking-tight text-stamp">
                {formatEur(result.shareCents)}
              </span>
            </div>

            <div className="print-line flex items-baseline justify-between gap-4 py-3 text-sm" style={printDelay(6)}>
              <span className="text-ink-muted">Übrige Einheiten und Leerstand</span>
              <span className="font-mono tabular-nums">{formatEur(result.restCents)}</span>
            </div>
          </>
        ) : null}
      </div>

      <p className="mt-6 border-t border-dashed border-rule pt-4 text-xs leading-relaxed text-ink-muted">
        Kaufmännisch auf Cent gerundet. Die Rundungsdifferenz geht in die Restzeile, damit die Summe stimmt.
      </p>
    </Receipt>
  );
}
