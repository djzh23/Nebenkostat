import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkFinalizedStatement } from "@/lib/supabase/statement-lock";

type RouteContext = { params: Promise<{ propertyId: string; costId: string }> };
const allowedTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);
const maxFileSize = 10 * 1024 * 1024;
const signedUrlLifetimeSeconds = 60;

function safeFileName(name: string) {
  const normalized = name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]/g, "-");
  return normalized.replace(/-+/g, "-").replace(/^-|-$/g, "") || "beleg";
}

export async function GET(_request: Request, context: RouteContext) {
  const { propertyId, costId } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(propertyId) || !/^[0-9a-f-]{36}$/i.test(costId)) {
    return NextResponse.json({ detail: "Ungültige ID." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ detail: "Nicht angemeldet." }, { status: 401 });
  }

  const { data: cost, error: costError } = await supabase
    .from("cost_items")
    .select("receipt_path")
    .eq("id", costId)
    .eq("property_id", propertyId)
    .maybeSingle();

  if (costError) {
    console.error("Kostenposition konnte zum Öffnen des Belegs nicht geladen werden.", costError);
    return NextResponse.json({ detail: "Der Beleg konnte nicht geladen werden." }, { status: 502 });
  }
  if (!cost) {
    return NextResponse.json({ detail: "Kostenposition nicht gefunden." }, { status: 404 });
  }
  if (!cost.receipt_path) {
    return NextResponse.json({ detail: "Für diese Kostenposition ist kein Beleg archiviert." }, { status: 404 });
  }

  const { data, error: signedUrlError } = await supabase.storage
    .from("receipts")
    .createSignedUrl(cost.receipt_path, signedUrlLifetimeSeconds);
  if (signedUrlError || !data?.signedUrl) {
    console.error("Signierte URL für Beleg konnte nicht erstellt werden.", signedUrlError);
    return NextResponse.json({ detail: "Der Beleg konnte nicht geöffnet werden." }, { status: 502 });
  }

  return NextResponse.json({ url: data.signedUrl, expiresIn: signedUrlLifetimeSeconds });
}

export async function POST(request: Request, context: RouteContext) {
  const { propertyId, costId } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(propertyId) || !/^[0-9a-f-]{36}$/i.test(costId)) {
    return NextResponse.json({ detail: "Ungültige ID." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ detail: "Nicht angemeldet." }, { status: 401 });
  }

  const { data: cost } = await supabase
    .from("cost_items")
    .select("id, receipt_path, billing_year")
    .eq("id", costId)
    .eq("property_id", propertyId)
    .maybeSingle();

  if (!cost) {
    return NextResponse.json({ detail: "Kostenposition nicht gefunden." }, { status: 404 });
  }

  const lock = await checkFinalizedStatement(supabase, propertyId, cost.billing_year);
  if (lock.error) {
    console.error("Abschlussstatus konnte vor dem Beleg-Upload nicht geprüft werden.", lock.error);
    return NextResponse.json({ detail: "Der Beleg konnte nicht geprüft werden." }, { status: 502 });
  }
  if (lock.locked) {
    return NextResponse.json(
      { detail: `Die Abrechnung ${cost.billing_year} ist abgeschlossen. Belege können nicht mehr geändert werden.` },
      { status: 409 },
    );
  }
  if (cost.receipt_path) {
    return NextResponse.json({ detail: "Für diese Kostenposition ist bereits ein Beleg gespeichert." }, { status: 409 });
  }

  const formData = await request.formData();
  const value = formData.get("receipt");
  if (!(value instanceof File) || value.size === 0) {
    return NextResponse.json({ detail: "Bitte eine Belegdatei auswählen." }, { status: 400 });
  }
  if (!allowedTypes.has(value.type)) {
    return NextResponse.json({ detail: "Erlaubt sind PDF-, JPG- und PNG-Dateien." }, { status: 400 });
  }
  if (value.size > maxFileSize) {
    return NextResponse.json({ detail: "Die Belegdatei darf höchstens 10 MB groß sein." }, { status: 400 });
  }

  const fileName = safeFileName(value.name);
  const path = `${user.id}/${propertyId}/${costId}/${crypto.randomUUID()}-${fileName}`;
  const { error: uploadError } = await supabase.storage.from("receipts").upload(path, value, {
    contentType: value.type,
    upsert: false,
  });

  if (uploadError) {
    console.error("Beleg konnte nicht in Supabase Storage hochgeladen werden.", uploadError);
    return NextResponse.json({ detail: "Der Beleg konnte nicht hochgeladen werden." }, { status: 502 });
  }

  const { error: updateError } = await supabase
    .from("cost_items")
    .update({ receipt_path: path })
    .eq("id", costId)
    .eq("property_id", propertyId);

  if (updateError) {
    await supabase.storage.from("receipts").remove([path]);
    console.error("Belegpfad konnte nicht an der Kostenposition gespeichert werden.", updateError);
    return NextResponse.json({ detail: "Der Beleg konnte nicht verknüpft werden." }, { status: 502 });
  }

  return NextResponse.json({ receiptPath: path, fileName }, { status: 201 });
}
