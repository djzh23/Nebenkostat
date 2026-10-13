"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { upsertProperty } from "@/lib/domain/store";
import { buttonPrimary, buttonQuiet, ErrorText, fieldInput, fieldLabel, fieldText, Panel, SectionHeading } from "../../_components/ui";
import { settlementYear } from "@/lib/domain/settlement";
import Link from "next/link";

type CreatedProperty = {
  id: string;
  name: string;
  street: string | null;
  zip: string | null;
  city: string | null;
};

function isCreatedProperty(value: unknown): value is CreatedProperty {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.name === "string" &&
    (typeof record.street === "string" || record.street === null) &&
    (typeof record.zip === "string" || record.zip === null) &&
    (typeof record.city === "string" || record.city === null)
  );
}

async function responseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown; title?: unknown };
    if (typeof body.detail === "string") return body.detail;
    if (typeof body.title === "string") return body.title;
  } catch {
    // The proxy may return a plain-text error for an unavailable backend.
  }
  return "Das Objekt konnte nicht gespeichert werden.";
}

export function PropertyForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    try {
      const response = await fetch("/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(form.get("name") ?? ""),
          street: String(form.get("street") ?? ""),
          zip: String(form.get("zip") ?? ""),
          city: String(form.get("city") ?? ""),
        }),
      });

      if (!response.ok) throw new Error(await responseError(response));
      const created = (await response.json()) as unknown;
      if (!isCreatedProperty(created)) throw new Error("Die API hat ein ungültiges Objekt zurückgegeben.");

      upsertProperty({
        id: created.id,
        name: created.name,
        street: created.street ?? "",
        zip: created.zip ?? "",
        city: created.city ?? "",
      });
      router.push(`/app/objekte/${created.id}/${settlementYear()}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Das Objekt konnte nicht angelegt werden.");
      setPending(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <Link href="/app" className={`${buttonQuiet} min-h-0 text-sm`}>
          Zur Übersicht
        </Link>
        <h1 className="mt-4 font-sans text-[clamp(2.25rem,4vw,3.25rem)] font-black leading-none tracking-[-0.03em]">
          Objekt anlegen
        </h1>
        <p className="mt-3 max-w-xl text-base text-ink-muted">
          Nur der Name ist Pflicht. Einheiten, Mietverhältnisse und Kosten erfasst du im nächsten Schritt.
        </p>
      </div>

      <Panel className="max-w-2xl">
        <SectionHeading>Stammdaten</SectionHeading>
        <form onSubmit={onSubmit} className="grid gap-6 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="name" className={fieldLabel}>
              Name des Objekts <span className="text-stamp-deep">*</span>
            </label>
            <input id="name" name="name" required autoComplete="off" placeholder="z. B. Haus Lindenweg" className={fieldText} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="street" className={fieldLabel}>
              Straße und Hausnummer
            </label>
            <input id="street" name="street" autoComplete="street-address" className={fieldText} />
          </div>
          <div>
            <label htmlFor="zip" className={fieldLabel}>
              PLZ
            </label>
            <input id="zip" name="zip" inputMode="numeric" autoComplete="postal-code" className={fieldInput} />
          </div>
          <div>
            <label htmlFor="city" className={fieldLabel}>
              Ort
            </label>
            <input id="city" name="city" autoComplete="address-level2" className={fieldText} />
          </div>

          <div className="space-y-4 sm:col-span-2">
            {error ? <ErrorText>{error}</ErrorText> : null}
            <button type="submit" disabled={pending} className={buttonPrimary}>
              Objekt anlegen
            </button>
          </div>
        </form>
      </Panel>
    </div>
  );
}
