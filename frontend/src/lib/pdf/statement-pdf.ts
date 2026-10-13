import { formatEur } from "@/lib/allocation";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

type PdfCost = {
  category: string;
  amountCents: number;
  rule: string;
  allocatedCents: number;
  vacancyCents: number;
  shares: Array<{ tenancyId: string; cents: number; formula: string }>;
};

type PdfTenancy = {
  id: string;
  unitLabel: string;
  tenant: string;
  days: number;
  months: number;
  costCents: number;
  prepaidCents: number;
  balanceCents: number;
};

export type StatementPdfResult = {
  year: number;
  totalCostCents: number;
  totalVacancyCents: number;
  costs: PdfCost[];
  tenancies: PdfTenancy[];
};

export type StatementPdfProperty = {
  name: string;
  street: string | null;
  zip: string | null;
  city: string | null;
};

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown, maxLength: number): string | null {
  return typeof value === "string" && value.length <= maxLength ? value : null;
}

function cents(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && Math.abs(value) <= 1_000_000_000_000 ? value : null;
}

function positiveInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 1_000_000 ? value : null;
}

export function normalizeStatementResult(value: unknown): StatementPdfResult | null {
  if (!isRecord(value)) return null;
  const year = positiveInteger(value.year);
  const totalCostCents = cents(value.totalCostCents);
  const totalVacancyCents = cents(value.totalVacancyCents);
  if (year === null || year < 2000 || year > 2100 || totalCostCents === null || totalVacancyCents === null) return null;
  if (!Array.isArray(value.costs) || !Array.isArray(value.tenancies)) return null;

  const costs: PdfCost[] = [];
  for (const item of value.costs) {
    if (!isRecord(item) || !isRecord(item.cost) || !Array.isArray(item.shares)) return null;
    const category = text(item.cost.category, 160);
    const amountCents = cents(item.cost.amountCents);
    const rule = text(item.rule, 500);
    const allocatedCents = cents(item.allocatedCents);
    const vacancyCents = cents(item.vacancyCents);
    if (category === null || amountCents === null || rule === null || allocatedCents === null || vacancyCents === null) return null;

    const shares: PdfCost["shares"] = [];
    for (const share of item.shares) {
      if (!isRecord(share)) return null;
      const tenancyId = text(share.tenancyId, 100);
      const shareCents = cents(share.cents);
      const formula = text(share.formula, 500);
      if (tenancyId === null || shareCents === null || formula === null) return null;
      shares.push({ tenancyId, cents: shareCents, formula });
    }
    costs.push({ category, amountCents, rule, allocatedCents, vacancyCents, shares });
  }

  const tenancies: PdfTenancy[] = [];
  for (const item of value.tenancies) {
    if (!isRecord(item) || !isRecord(item.tenancy) || !isRecord(item.unit)) return null;
    const id = text(item.tenancy.id, 100);
    const unitLabel = text(item.unit.label, 120);
    const tenant = text(item.tenancy.tenant, 160);
    const days = positiveInteger(item.days);
    const months = positiveInteger(item.months);
    const costCents = cents(item.costCents);
    const prepaidCents = cents(item.prepaidCents);
    const balanceCents = cents(item.balanceCents);
    if (id === null || unitLabel === null || tenant === null || days === null || months === null || costCents === null || prepaidCents === null || balanceCents === null) {
      return null;
    }
    tenancies.push({ id, unitLabel, tenant, days, months, costCents, prepaidCents, balanceCents });
  }

  return { year, totalCostCents, totalVacancyCents, costs, tenancies };
}

function wrap(textValue: string, font: PDFFont, size: number, width: number): string[] {
  const words = textValue.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(candidate, size) > width) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function dateDe(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value.slice(0, 10) : date.toLocaleDateString("de-DE");
}

export async function createStatementPdf(
  property: StatementPdfProperty,
  result: StatementPdfResult,
  finalizedAt: string,
): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const mono = await document.embedFont(StandardFonts.Courier);
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 48;
  const contentWidth = pageWidth - margin * 2;
  const ink = rgb(0.08, 0.09, 0.1);
  const muted = rgb(0.29, 0.31, 0.34);
  const stamp = rgb(0.78, 0.2, 0.16);
  let page!: PDFPage;
  let y = pageHeight - margin;

  function newPage() {
    page = document.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;
  }

  function ensureSpace(height: number) {
    if (y - height < margin) newPage();
  }

  function line(textValue: string, font: PDFFont = regular, size = 10, color = ink, gap = 14) {
    const lines = wrap(textValue, font, size, contentWidth);
    ensureSpace(lines.length * gap);
    for (const wrappedLine of lines) {
      page.drawText(wrappedLine, { x: margin, y, size, font, color });
      y -= gap;
    }
  }

  function heading(textValue: string, size = 14) {
    ensureSpace(size + 18);
    page.drawText(textValue, { x: margin, y, size, font: bold, color: ink });
    y -= size + 8;
  }

  function rule() {
    ensureSpace(10);
    page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.7, color: ink });
    y -= 12;
  }

  newPage();
  page.drawText(`Nebenkostenabrechnung ${result.year}`, { x: margin, y, size: 24, font: bold, color: ink });
  y -= 34;
  line(property.name, bold, 13, ink, 18);
  const address = [property.street, [property.zip, property.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  if (address) line(address, regular, 10, muted);
  line(`Abgeschlossen am ${dateDe(finalizedAt)}`, mono, 9, muted, 12);
  y -= 6;
  rule();

  heading("Ergebnis", 16);
  line(`Gesamtkosten: ${formatEur(result.totalCostCents)}`, mono, 11, ink, 16);
  line(`Leerstand (Vermieter): ${formatEur(result.totalVacancyCents)}`, mono, 11, ink, 16);
  line(`Mietparteien: ${result.tenancies.length}`, mono, 11, ink, 16);
  y -= 8;

  heading("Kosten und Umlage", 16);
  const tenancyById = new Map(result.tenancies.map((tenancy) => [tenancy.id, tenancy]));
  for (const settlement of result.costs) {
    heading(settlement.category, 13);
    line(`Gesamt: ${formatEur(settlement.amountCents)} · ${settlement.rule}`, regular, 9, muted, 12);
    for (const share of settlement.shares) {
      const tenancy = tenancyById.get(share.tenancyId);
      const recipient = tenancy ? `${tenancy.unitLabel} – ${tenancy.tenant}` : "Mietpartei";
      line(`${recipient}: ${formatEur(share.cents)}`, bold, 9, ink, 12);
      line(`Rechenweg: ${share.formula}`, mono, 7.5, muted, 10);
    }
    line(`Leerstand: ${formatEur(settlement.vacancyCents)}`, mono, 8, stamp, 12);
    y -= 5;
  }

  heading("Saldo je Mietpartei", 16);
  for (const tenancy of result.tenancies) {
    line(`${tenancy.unitLabel} – ${tenancy.tenant}`, bold, 10, ink, 13);
    line(`Kosten ${formatEur(tenancy.costCents)} · Vorauszahlung ${formatEur(tenancy.prepaidCents)} · Saldo ${formatEur(tenancy.balanceCents)}`, mono, 8, muted, 11);
  }

  y -= 10;
  rule();
  line("Erstellt mit Unterstützung der App. Prüfung durch den Vermieter bzw. eine Fachberatung erforderlich.", regular, 8, muted, 11);
  return document.save();
}
