import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkFinalizedStatement } from "@/lib/supabase/statement-lock";

type RouteContext = { params: Promise<{ propertyId: string }> };

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

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

  const { data: units, error: unitsError } = await supabase
    .from("units")
    .select("id")
    .eq("property_id", propertyId);
  if (unitsError) {
    console.error("Einheiten für Mietverhältnisse konnten nicht geladen werden.", unitsError);
    return NextResponse.json({ detail: "Die Mietverhältnisse konnten nicht geladen werden." }, { status: 502 });
  }

  const unitIds = (units ?? []).map((unit) => unit.id);
  if (unitIds.length === 0) return NextResponse.json([]);

  const { data: tenancies, error } = await supabase
    .from("tenancies")
    .select("id, unit_id, tenant_name, persons, monthly_prepayment_eur, start_date, end_date")
    .in("unit_id", unitIds)
    .order("start_date", { ascending: true });
  if (error) {
    console.error("Mietverhältnisse konnten nicht aus Supabase geladen werden.", error);
    return NextResponse.json({ detail: "Die Mietverhältnisse konnten nicht geladen werden." }, { status: 502 });
  }

  return NextResponse.json(tenancies ?? []);
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

  const lock = await checkFinalizedStatement(supabase, propertyId);
  if (lock.error) {
    console.error("Abschlussstatus konnte vor dem Anlegen des Mietverhältnisses nicht geprüft werden.", lock.error);
    return NextResponse.json({ detail: "Das Mietverhältnis konnte nicht geprüft werden." }, { status: 502 });
  }
  if (lock.locked) {
    return NextResponse.json(
      { detail: "Eine Abrechnung dieses Objekts ist abgeschlossen. Änderungen an Mietverhältnissen sind gesperrt." },
      { status: 409 },
    );
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
  const unitId = typeof record.unitId === "string" ? record.unitId.trim() : "";
  const tenantName = typeof record.tenantName === "string" ? record.tenantName.trim() : "";
  const persons = typeof record.persons === "number" ? record.persons : Number(record.persons);
  const monthlyPrepaymentEur =
    typeof record.monthlyPrepaymentEur === "number"
      ? record.monthlyPrepaymentEur
      : Number(record.monthlyPrepaymentEur);
  const startDate = record.startDate;
  const endDate = record.endDate ? record.endDate : null;

  if (!/^[0-9a-f-]{36}$/i.test(unitId)) {
    return NextResponse.json({ detail: "Ungültige Einheiten-ID." }, { status: 400 });
  }
  if (!tenantName || tenantName.length > 160) {
    return NextResponse.json(
      { detail: "Bitte einen Namen mit 1 bis 160 Zeichen angeben." },
      { status: 400 },
    );
  }
  if (!Number.isInteger(persons) || persons < 1 || persons > 100) {
    return NextResponse.json({ detail: "Die Personenzahl muss zwischen 1 und 100 liegen." }, { status: 400 });
  }
  if (!Number.isFinite(monthlyPrepaymentEur) || monthlyPrepaymentEur < 0 || monthlyPrepaymentEur > 1_000_000) {
    return NextResponse.json({ detail: "Die monatliche Vorauszahlung ist ungültig." }, { status: 400 });
  }
  if (!isIsoDate(startDate) || (endDate !== null && !isIsoDate(endDate))) {
    return NextResponse.json({ detail: "Bitte gültige Ein- und Auszugsdaten angeben." }, { status: 400 });
  }
  if (endDate !== null && endDate < startDate) {
    return NextResponse.json({ detail: "Das Auszugsdatum liegt vor dem Einzugsdatum." }, { status: 400 });
  }

  const { data: unit } = await supabase
    .from("units")
    .select("id, property_id")
    .eq("id", unitId)
    .eq("property_id", propertyId)
    .maybeSingle();

  if (!unit) {
    return NextResponse.json({ detail: "Einheit nicht gefunden." }, { status: 404 });
  }

  const { data: existingTenancies, error: existingError } = await supabase
    .from("tenancies")
    .select("start_date, end_date")
    .eq("unit_id", unitId);

  if (existingError) {
    console.error("Bestehende Mietverhältnisse konnten nicht gelesen werden.", existingError);
    return NextResponse.json({ detail: "Das Mietverhältnis konnte nicht geprüft werden." }, { status: 502 });
  }

  const overlaps = (existingTenancies ?? []).some((existing) => {
    const existingEnd = existing.end_date ?? "9999-12-31";
    const candidateEnd = endDate ?? "9999-12-31";
    return startDate <= existingEnd && existing.start_date <= candidateEnd;
  });

  if (overlaps) {
    return NextResponse.json(
      { detail: "Dieses Mietverhältnis überschneidet sich mit einem bestehenden auf derselben Einheit." },
      { status: 409 },
    );
  }

  const { data: tenancy, error } = await supabase
    .from("tenancies")
    .insert({
      unit_id: unitId,
      user_id: user.id,
      tenant_name: tenantName,
      persons,
      monthly_prepayment_eur: monthlyPrepaymentEur,
      start_date: startDate,
      end_date: endDate,
    })
    .select("id, unit_id, tenant_name, persons, monthly_prepayment_eur, start_date, end_date")
    .single();

  if (error || !tenancy) {
    console.error("Mietverhältnis konnte in Supabase nicht angelegt werden.", error);
    return NextResponse.json(
      { detail: "Das Mietverhältnis konnte nicht gespeichert werden." },
      { status: 502 },
    );
  }

  return NextResponse.json(tenancy, { status: 201 });
}
