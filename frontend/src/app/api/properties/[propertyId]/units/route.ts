import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkFinalizedStatement } from "@/lib/supabase/statement-lock";

type RouteContext = { params: Promise<{ propertyId: string }> };

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

  const { data: units, error } = await supabase
    .from("units")
    .select("id, property_id, label, area_m2")
    .eq("property_id", propertyId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Einheiten konnten nicht aus Supabase geladen werden.", error);
    return NextResponse.json({ detail: "Die Einheiten konnten nicht geladen werden." }, { status: 502 });
  }

  return NextResponse.json(units ?? []);
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
    console.error("Abschlussstatus konnte vor dem Anlegen der Einheit nicht geprüft werden.", lock.error);
    return NextResponse.json({ detail: "Die Einheit konnte nicht geprüft werden." }, { status: 502 });
  }
  if (lock.locked) {
    return NextResponse.json(
      { detail: "Eine Abrechnung dieses Objekts ist abgeschlossen. Änderungen an Einheiten sind gesperrt." },
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
  const label = typeof record.label === "string" ? record.label.trim() : "";
  const areaM2 = typeof record.areaM2 === "number" ? record.areaM2 : Number(record.areaM2);

  if (!label || label.length > 120) {
    return NextResponse.json(
      { detail: "Bitte eine Bezeichnung mit 1 bis 120 Zeichen angeben." },
      { status: 400 },
    );
  }

  if (!Number.isFinite(areaM2) || areaM2 <= 0 || areaM2 > 1_000_000) {
    return NextResponse.json(
      { detail: "Die Wohnfläche muss größer als 0 und plausibel sein." },
      { status: 400 },
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

  const { data: unit, error } = await supabase
    .from("units")
    .insert({ property_id: propertyId, user_id: user.id, label, area_m2: areaM2 })
    .select("id, property_id, label, area_m2")
    .single();

  if (error || !unit) {
    console.error("Einheit konnte in Supabase nicht angelegt werden.", error);
    return NextResponse.json(
      { detail: "Die Einheit konnte nicht gespeichert werden." },
      { status: 502 },
    );
  }

  return NextResponse.json(unit, { status: 201 });
}
