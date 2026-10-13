import { NextResponse } from "next/server";
import { settleYear } from "@/lib/domain/settlement";
import type { AppState } from "@/lib/domain/types";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ propertyId: string; year: string }> };

function validUuid(value: string) {
  return /^[0-9a-f-]{36}$/i.test(value);
}

export async function GET(_request: Request, context: RouteContext) {
  const { propertyId, year: yearParam } = await context.params;
  const year = Number(yearParam);
  if (!validUuid(propertyId) || !Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ detail: "Ungültige Abrechnungsdaten." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ detail: "Nicht angemeldet." }, { status: 401 });
  }

  const { data: statement, error } = await supabase
    .from("statements")
    .select("id, property_id, billing_year, status, result, pdf_path, finalized_at")
    .eq("property_id", propertyId)
    .eq("billing_year", year)
    .maybeSingle();

  if (error) {
    console.error("Abrechnung konnte nicht aus Supabase geladen werden.", error);
    return NextResponse.json({ detail: "Die Abrechnung konnte nicht geladen werden." }, { status: 502 });
  }
  if (!statement) {
    return NextResponse.json({ detail: "Abrechnung nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json(statement);
}

export async function POST(_request: Request, context: RouteContext) {
  const { propertyId, year: yearParam } = await context.params;
  const year = Number(yearParam);
  if (!validUuid(propertyId) || !Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ detail: "Ungültige Abrechnungsdaten." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ detail: "Nicht angemeldet." }, { status: 401 });
  }

  const { data: existing } = await supabase
    .from("statements")
    .select("id, status, finalized_at")
    .eq("property_id", propertyId)
    .eq("billing_year", year)
    .maybeSingle();

  if (existing?.status === "finalized") {
    return NextResponse.json(existing);
  }

  const { data: property, error: propertyError } = await supabase
    .from("properties")
    .select("id, name, street, zip, city")
    .eq("id", propertyId)
    .maybeSingle();
  if (propertyError) {
    console.error("Objekt konnte für die serverseitige Abrechnung nicht geladen werden.", propertyError);
    return NextResponse.json({ detail: "Das Objekt konnte nicht geladen werden." }, { status: 502 });
  }
  if (!property) {
    return NextResponse.json({ detail: "Objekt nicht gefunden." }, { status: 404 });
  }

  const { data: databaseUnits, error: unitsError } = await supabase
    .from("units")
    .select("id, property_id, label, area_m2")
    .eq("property_id", propertyId)
    .order("created_at", { ascending: true });
  if (unitsError) {
    console.error("Einheiten konnten für die serverseitige Abrechnung nicht geladen werden.", unitsError);
    return NextResponse.json({ detail: "Die Einheiten konnten nicht geladen werden." }, { status: 502 });
  }
  if (!databaseUnits || databaseUnits.length === 0) {
    return NextResponse.json({ detail: "Für dieses Objekt ist noch keine Einheit angelegt." }, { status: 409 });
  }

  const unitIds = databaseUnits.map((unit) => unit.id);
  const { data: databaseTenancies, error: tenanciesError } = await supabase
    .from("tenancies")
    .select("id, unit_id, tenant_name, persons, monthly_prepayment_eur, start_date, end_date")
    .in("unit_id", unitIds)
    .order("start_date", { ascending: true });
  if (tenanciesError) {
    console.error("Mietverhältnisse konnten für die serverseitige Abrechnung nicht geladen werden.", tenanciesError);
    return NextResponse.json({ detail: "Die Mietverhältnisse konnten nicht geladen werden." }, { status: 502 });
  }

  const { data: databaseCosts, error: costsError } = await supabase
    .from("cost_items")
    .select("id, property_id, billing_year, category, amount_eur, distribution_key, receipt_path")
    .eq("property_id", propertyId)
    .eq("billing_year", year)
    .order("created_at", { ascending: true });
  if (costsError) {
    console.error("Kosten konnten für die serverseitige Abrechnung nicht geladen werden.", costsError);
    return NextResponse.json({ detail: "Die Kosten konnten nicht geladen werden." }, { status: 502 });
  }
  if (!databaseCosts || databaseCosts.length === 0) {
    return NextResponse.json({ detail: `Für ${year} sind noch keine Kosten angelegt.` }, { status: 409 });
  }

  const state: AppState = {
    properties: [{
      id: property.id,
      name: property.name,
      street: property.street ?? "",
      zip: property.zip ?? "",
      city: property.city ?? "",
    }],
    units: databaseUnits.map((unit) => ({
      id: unit.id,
      propertyId: unit.property_id,
      label: unit.label,
      areaHundredths: Math.round(Number(unit.area_m2) * 100),
    })),
    tenancies: (databaseTenancies ?? []).map((tenancy) => ({
      id: tenancy.id,
      unitId: tenancy.unit_id,
      tenant: tenancy.tenant_name,
      from: tenancy.start_date,
      to: tenancy.end_date,
      persons: tenancy.persons,
      prepaymentCents: Math.round(Number(tenancy.monthly_prepayment_eur) * 100),
    })),
    costs: databaseCosts.map((cost) => ({
      id: cost.id,
      propertyId: cost.property_id,
      year: cost.billing_year,
      category: cost.category,
      amountCents: Math.round(Number(cost.amount_eur) * 100),
      key: cost.distribution_key,
      receipts: cost.receipt_path ? [cost.receipt_path] : [],
    })),
    finalized: [],
  };

  let result: ReturnType<typeof settleYear>;
  try {
    result = settleYear(state, propertyId, year);
  } catch (error) {
    console.error("Abrechnung konnte aus den Supabase-Daten nicht berechnet werden.", error);
    return NextResponse.json(
      { detail: "Die Abrechnung kann mit den vorhandenen Einheiten, Mietverhältnissen und Kosten nicht berechnet werden." },
      { status: 409 },
    );
  }

  const { data: statement, error } = await supabase
    .from("statements")
    .upsert(
      {
        property_id: propertyId,
        user_id: user.id,
        billing_year: year,
        status: "finalized",
        result,
        finalized_at: new Date().toISOString(),
      },
      { onConflict: "property_id,billing_year" },
    )
    .select("id, property_id, billing_year, status, result, pdf_path, finalized_at")
    .single();

  if (error || !statement) {
    console.error("Abrechnung konnte in Supabase nicht abgeschlossen werden.", error);
    return NextResponse.json({ detail: "Die Abrechnung konnte nicht archiviert werden." }, { status: 502 });
  }

  return NextResponse.json(statement, { status: 201 });
}
