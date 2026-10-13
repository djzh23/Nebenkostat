import { createStatementPdf, type StatementPdfResult } from "@/lib/pdf/statement-pdf";

const sampleResult: StatementPdfResult = {
  year: 2026,
  totalCostCents: 120000,
  totalVacancyCents: 78667,
  costs: [
    {
      category: "Wasser",
      amountCents: 120000,
      rule: "Wohnfläche: Kosten × Wohnfläche ÷ Gesamtfläche × Zeitanteil",
      allocatedCents: 41333,
      vacancyCents: 78667,
      shares: [
        {
          tenancyId: "muster-tenancy",
          cents: 41333,
          formula: "1.200,00 € × 62 m² ÷ 180 m² = 413,33 €",
        },
      ],
    },
  ],
  tenancies: [
    {
      id: "muster-tenancy",
      unitLabel: "Wohnung EG links",
      tenant: "Muster-Mieter",
      days: 365,
      months: 12,
      costCents: 41333,
      prepaidCents: 0,
      balanceCents: 41333,
    },
  ],
};

export async function GET() {
  const pdf = await createStatementPdf(
    {
      name: "MUSTEROBJEKT – NICHT ECHT",
      street: "Musterstraße 1",
      zip: "50667",
      city: "Köln",
    },
    sampleResult,
    "2026-10-12T00:00:00.000Z",
  );
  const body = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer;

  return new Response(body, {
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
      "Content-Disposition": 'inline; filename="Nebenkostat-Beispielabrechnung.pdf"',
      "Content-Type": "application/pdf",
    },
  });
}
