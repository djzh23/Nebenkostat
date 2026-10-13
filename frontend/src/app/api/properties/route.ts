import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ detail: "Nicht angemeldet." }, { status: 401 });
  }

  const { data: properties, error } = await supabase
    .from("properties")
    .select("id, name, street, zip, city")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Objekte konnten nicht aus Supabase geladen werden.", error);
    return NextResponse.json({ detail: "Die Objekte konnten nicht geladen werden." }, { status: 502 });
  }

  return NextResponse.json(properties ?? []);
}

export async function POST(request: Request) {
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
  const name = typeof record.name === "string" ? record.name.trim() : "";
  const street = typeof record.street === "string" ? record.street.trim() : "";
  const zip = typeof record.zip === "string" ? record.zip.trim() : "";
  const city = typeof record.city === "string" ? record.city.trim() : "";

  if (!name || name.length > 120) {
    return NextResponse.json(
      { detail: "Bitte einen Namen mit 1 bis 120 Zeichen angeben." },
      { status: 400 },
    );
  }

  if (zip.length > 20) {
    return NextResponse.json(
      { detail: "Die Postleitzahl darf höchstens 20 Zeichen enthalten." },
      { status: 400 },
    );
  }

  const { data: property, error } = await supabase
    .from("properties")
    .insert({
      user_id: user.id,
      name,
      street: street || null,
      zip: zip || null,
      city: city || null,
    })
    .select("id, name, street, zip, city")
    .single();

  if (error || !property) {
    console.error("Objekt konnte in Supabase nicht angelegt werden.", error);
    return NextResponse.json(
      { detail: "Das Objekt konnte nicht gespeichert werden." },
      { status: 502 },
    );
  }

  return NextResponse.json(property, { status: 201 });
}
