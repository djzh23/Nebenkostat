import { ReceiptCalculator } from "./_components/receipt-calculator";
import { CalculatorCta } from "./_components/calculator-cta";
import { ButtonLink } from "@/components/ui/button";
import { Receipt } from "@/components/ui/receipt";
import { Container, Section, SplitSection } from "@/components/ui/layout";
import { PageTitle, SectionTitle } from "@/components/ui/heading";

const problemRows = [
  ["Belege in Ordnern, Fotos auf dem Handy", "Belegarchiv pro Objekt und Jahr"],
  ["Formeln in Zellen, schwer nachzuprüfen", "Formel-Karte mit jedem Rechenschritt"],
  ["Zeitanteile bei Mieterwechsel von Hand", "Zeitanteil je Mietverhältnis berechnet"],
  ["Tabelle, die man erklären muss", "PDF-Abrechnung mit Prüfhinweis"],
] as const;

const steps = [
  ["Objekt anlegen", "Name ist Pflicht, Adresse optional."],
  ["Einheiten anlegen", "Bezeichnung und Wohnfläche in m²."],
  ["Kosten erfassen", "Kostenart, Betrag und Verteilungsschlüssel."],
] as const;

const keys = [
  ["Flächenschlüssel", "Kosten × Wohnfläche ÷ Gesamtfläche × Zeitanteil"],
  ["Personenschlüssel", "Kosten × Personen-Tage ÷ Summe aller Personen-Tage"],
  ["Einheitenschlüssel", "Kosten ÷ Anzahl Einheiten × Zeitanteil"],
] as const;

const freeFeatures = [
  "1 Objekt mit bis zu 5 Wohneinheiten",
  "Kostenpositionen und Belege unbegrenzt",
  "Abrechnung berechnen und als PDF exportieren",
  "Belegarchiv als ZIP exportieren",
];

const proFeatures = ["Unbegrenzte Objekte und Wohneinheiten", "Alles aus dem kostenlosen Tarif"];

const disclaimer = "Erstellt mit Unterstützung der App. Prüfung durch den Vermieter bzw. eine Fachberatung erforderlich.";

export default function Home() {
  return (
    <>
      <header className="border-b border-ink/10">
        <Container className="flex items-center justify-between gap-6 py-5">
          <a href="#top" className="font-sans text-lg font-black tracking-tight">
            Nebenkostat
          </a>
          <nav aria-label="Hauptnavigation" className="hidden items-center gap-8 text-sm font-medium md:flex">
            <a href="#ablauf" className="underline-offset-4 hover:underline">So funktioniert’s</a>
            <a href="#preise" className="underline-offset-4 hover:underline">Preise</a>
            <a href="#rechtshinweis" className="underline-offset-4 hover:underline">Rechtshinweis</a>
          </nav>
          <div className="flex items-center gap-4">
            <ButtonLink href="/login" size="sm">
              Kostenlos starten
            </ButtonLink>
          </div>
        </Container>
      </header>

      <main id="top">
        <Container className="grid gap-14 pt-12 pb-20 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:pt-20 lg:pb-28">
          <div className="min-w-0 max-w-2xl">
            <PageTitle>Deine Abrechnung. Jede Zeile nachrechenbar.</PageTitle>
            <p className="mt-7 max-w-xl text-lg leading-relaxed text-ink-muted md:text-xl">
              Für Privatvermieter mit 2 bis 5 Wohneinheiten: Kosten nach Fläche verteilen, Belege pro Objekt archivieren
              und die Abrechnung als PDF exportieren.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-5">
              <CalculatorCta className="md:min-w-56">
                Erste Umlage rechnen
              </CalculatorCta>
              <ButtonLink href="#ablauf" variant="quiet">
                So funktioniert’s
              </ButtonLink>
            </div>
            <p className="mt-6 text-sm text-ink-muted">Kostenlos bis 1 Objekt mit 5 Einheiten.</p>
          </div>

          <div id="rechner" className="flex justify-center scroll-mt-8 lg:justify-end">
            <ReceiptCalculator />
          </div>
        </Container>

        <Section divided>
          <Container>
            <SplitSection
              heading={<SectionTitle>Eine Abrechnung ist nur so gut wie ihre Belege und ihre Nachrechenbarkeit.</SectionTitle>}
            >
              <Receipt padding="md">
                <div className="grid grid-cols-2 gap-6 border-b border-ink pb-3 font-mono text-xs font-semibold uppercase tracking-widest text-ink-muted">
                  <span>Excel heute</span>
                  <span className="text-ink">Nebenkostat</span>
                </div>
                <ul>
                  {problemRows.map(([before, after]) => (
                    <li key={before} className="grid grid-cols-2 gap-6 border-b border-dashed border-rule py-4 text-base">
                      <span className="text-ink-muted">{before}</span>
                      <span className="font-medium">{after}</span>
                    </li>
                  ))}
                </ul>
              </Receipt>
            </SplitSection>
          </Container>
        </Section>

        <Section id="ablauf" divided>
          <Container>
            <SplitSection heading={<SectionTitle>Drei Eingaben bis zur ersten Formel.</SectionTitle>}>
              <Receipt padding="md">
                <ol>
                  {steps.map(([title, detail], index) => (
                    <li key={title} className="grid grid-cols-[3rem_1fr] gap-4 border-b border-dashed border-rule py-5">
                      <span className="font-mono text-2xl font-semibold tabular-nums text-stamp">{index + 1}</span>
                      <span className="min-w-0">
                        <span className="block font-sans text-xl font-bold">{title}</span>
                        <span className="mt-1 block text-ink-muted">{detail}</span>
                      </span>
                    </li>
                  ))}
                </ol>
                <p className="mt-6 font-medium">Danach erscheint die Formel-Karte sofort, mit jedem Rechenschritt.</p>
              </Receipt>
            </SplitSection>
          </Container>
        </Section>

        <Section divided>
          <Container>
            <SplitSection
              heading={
                <>
                  <SectionTitle>Drei Verteilungen, jede mit Rechenweg.</SectionTitle>
                  <p className="mt-6 max-w-md text-lg leading-relaxed text-ink-muted">
                    Der Nenner bleibt fix, damit Leerstand sichtbar bleibt. Was nicht zugeordnet ist, steht als eigene Zeile
                    auf der Abrechnung.
                  </p>
                </>
              }
            >
              <Receipt padding="md">
                <dl>
                  {keys.map(([key, formula]) => (
                    <div key={key} className="border-b border-dashed border-rule py-5 last:border-b-0">
                      <dt className="font-sans text-lg font-bold">{key}</dt>
                      <dd className="mt-2 font-mono text-sm leading-relaxed tabular-nums text-ink-muted">{formula}</dd>
                    </div>
                  ))}
                </dl>
              </Receipt>
            </SplitSection>
          </Container>
        </Section>

        <Section id="preise" divided>
          <Container>
            <SectionTitle>Ein kostenloser Start. Export bleibt in jedem Tarif frei.</SectionTitle>
            <div className="mt-14 grid gap-8 md:grid-cols-2">
              <Receipt padding="lg" className="flex flex-col">
                <p className="font-sans text-lg font-bold">Free</p>
                <p className="mt-3 font-mono text-5xl font-semibold tabular-nums tracking-tight">0 €</p>
                <ul className="mt-8 flex-1 space-y-3 border-t border-dashed border-rule pt-6 text-base">
                  {freeFeatures.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
                <ButtonLink href="/beispiel-pdf" className="mt-10 w-full md:w-auto">
                  Beispiel-PDF ansehen
                </ButtonLink>
              </Receipt>

              <Receipt padding="lg" tone="outline" className="flex flex-col">
                <p className="font-sans text-lg font-bold">Pro</p>
                <p className="mt-3 font-mono text-5xl font-semibold tabular-nums tracking-tight text-stamp">2 €</p>
                <p className="mt-2 text-base text-ink-muted">pro Einheit und Jahr, mindestens 19 € im Jahr</p>
                <ul className="mt-8 flex-1 space-y-3 border-t border-dashed border-rule pt-6 text-base">
                  {proFeatures.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
                <p className="mt-10 text-sm text-ink-muted">Pro-Tarif wird später ergänzt.</p>
              </Receipt>
            </div>
            <p className="mt-8 max-w-2xl text-sm leading-relaxed text-ink-muted">
              Der Pro-Preis ist ein Vorschlag und wird im Test mit ersten Vermietern geprüft. Bestehende Daten bleiben bei
              jedem Tarif zugänglich. Nichts wird gelöscht.
            </p>
          </Container>
        </Section>

        <Section id="rechtshinweis" divided>
          <Container>
            <SplitSection heading={<SectionTitle>Nebenkostat rechnet und archiviert. Die Prüfung bleibt bei dir.</SectionTitle>}>
              <div className="space-y-5 text-lg leading-relaxed text-ink-muted">
                <p>Das Tool ersetzt keine Rechtsberatung. Jede PDF-Abrechnung trägt diesen Hinweis:</p>
                <p className="border-l-2 border-stamp pl-5 font-medium text-ink">„{disclaimer}“</p>
                <p>Die Abrechnungsfrist zeigt die App als Orientierung. Sie ist keine Rechtsauskunft.</p>
              </div>
            </SplitSection>
          </Container>
        </Section>

        <Section divided>
          <Container>
            <Receipt padding="lg" className="flex flex-col gap-10 md:flex-row md:items-end md:justify-between">
              <div className="min-w-0">
                <SectionTitle>Verstehe den Ablauf in drei Eingaben.</SectionTitle>
                <p className="mt-5 text-lg text-ink-muted">Vom Objekt bis zur Formel-Karte, ohne Umwege.</p>
              </div>
              <ButtonLink href="#ablauf" className="w-full md:w-auto">
                So funktioniert’s
              </ButtonLink>
            </Receipt>
          </Container>
        </Section>
      </main>

      <footer className="border-t border-ink/20">
        <Container className="flex flex-col gap-3 py-10 text-sm text-ink-muted md:flex-row md:items-center md:justify-between">
          <p className="font-sans font-bold text-ink">Nebenkostat</p>
          <p>Impressum und Datenschutzerklärung werden vor der Veröffentlichung ergänzt.</p>
        </Container>
      </footer>
    </>
  );
}
