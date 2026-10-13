import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkFinalizedStatement } from "@/lib/supabase/statement-lock";

type RouteContext = { params: Promise<{ propertyId: string }> };
const distributionKeys = new Set(["flaeche", "personen", "einheiten"]);

export async function GET(_request: Request, context: RouteContext) {
  const { propertyId } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(propertyId)) {
    return NextResponse.json({ detail: "Ungültige Objekt-ID." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ detail: "Nicht angemeldet." }, { status: 401 });
  }

  const { data: costs, error } = await supabase
    .from("cost_items")
    .select("id, property_id, billing_year, category, amount_eur, distribution_key, receipt_path")
    .eq("property_id", propertyId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Kosten konnten nicht aus Supabase geladen werden.", error);
    return NextResponse.json({ detail: "Die Kosten konnten nicht geladen werden." }, { status: 502 });
  }

  return NextResponse.json(costs ?? []);
}

export async function POST(request: Request, context: RouteContext) {
  const { propertyId } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(propertyId)) {
    return NextResponse.json({ detail: "Ungültige Objekt-ID." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ detail: "Nicht angemeldet." }, { status: 401 });
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ detail: "Ungültige Eingabe." }, { status: 400 });
  }

  if (!input || typeof input !== "object") {
    return NextResponse.json({ detail: "Ungültige Eingabe." }, { status: 400 });
  }

  const record = input as Record<string, unknown>;
  const billingYear = typeof record.billingYear === "number" ? record.billingYear : Number(record.billingYear);
  const category = typeof record.category === "string" ? record.category.trim() : "";
  const amountEur = typeof record.amountEur === "number" ? record.amountEur : Number(record.amountEur);
  const distributionKey = typeof record.distributionKey === "string" ? record.distributionKey : "";

  if (!Number.isInteger(billingYear) || billingYear < 2000 || billingYear > 2100) {
    return NextResponse.json({ detail: "Das Abrechnungsjahr ist ungültig." }, { status: 400 });
  }
  if (!category || category.length > 160) {
    return NextResponse.json({ detail: "Bitte eine Kostenart angeben." }, { status: 400 });
  }
  if (!Number.isFinite(amountEur) || amountEur <= 0 || amountEur > 100_000_000) {
    return NextResponse.json({ detail: "Der Betrag muss größer als 0 € sein." }, { status: 400 });
  }
  if (!distributionKeys.has(distributionKey)) {
    return NextResponse.json({ detail: "Der Verteilungsschlüssel ist ungültig." }, { status: 400 });
  }

  const lock = await checkFinalizedStatement(supabase, propertyId, billingYear);
  if (lock.error) {
    console.error("Abschlussstatus konnte vor dem Speichern der Kosten nicht geprüft werden.", lock.error);
    return NextResponse.json({ detail: "Die Kostenposition konnte nicht geprüft werden." }, { status: 502 });
  }
  if (lock.locked) {
    return NextResponse.json(
      { detail: `Die Abrechnung ${billingYear} ist abgeschlossen. Änderungen sind gesperrt.` },
      { status: 409 },
    );
  }

  const { data: property } = await supabase
    .from("properties")
    .select("id")
    .eq("id", propertyId)
    .maybeSingle();

  if (!property) {
    return NextResponse.json({ detail: "Objekt nicht gefunden." }, { status: 404 });
  }

  const { data: cost, error } = await supabase
    .from("cost_items")
    .insert({
      property_id: propertyId,
      user_id: user.id,
      billing_year: billingYear,
      category,
      amount_eur: amountEur,
      distribution_key: distributionKey,
    })
    .select("id, property_id, billing_year, category, amount_eur, distribution_key, receipt_path")
    .single();

  if (error || !cost) {
    console.error("Kostenposition konnte in Supabase nicht angelegt werden.", error);
    return NextResponse.json({ detail: "Die Kostenposition konnte nicht gespeichert werden." }, { status: 502 });
  }

  return NextResponse.json(cost, { status: 201 });
}
