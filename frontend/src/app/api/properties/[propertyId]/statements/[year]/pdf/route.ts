import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ propertyId: string; year: string }> };
const maxFileSize = 10 * 1024 * 1024;
const signedUrlLifetimeSeconds = 60;

export async function GET(_request: Request, context: RouteContext) {
  const { propertyId, year: yearParam } = await context.params;
  const year = Number(yearParam);
  if (!/^[0-9a-f-]{36}$/i.test(propertyId) || !Number.isInteger(year) || year < 2000 || year > 2100) {
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

  const { data: statement, error: statementError } = await supabase
    .from("statements")
    .select("pdf_path, status")
    .eq("property_id", propertyId)
    .eq("billing_year", year)
    .maybeSingle();

  if (statementError) {
    console.error("Abrechnung konnte zum Öffnen nicht geladen werden.", statementError);
    return NextResponse.json({ detail: "Das archivierte PDF konnte nicht geladen werden." }, { status: 502 });
  }
  if (!statement) {
    return NextResponse.json({ detail: "Abrechnung nicht gefunden." }, { status: 404 });
  }
  if (statement.status !== "finalized" || !statement.pdf_path) {
    return NextResponse.json({ detail: "Für diese Abrechnung ist noch kein PDF archiviert." }, { status: 404 });
  }

  const { data, error: signedUrlError } = await supabase.storage
    .from("statements")
    .createSignedUrl(statement.pdf_path, signedUrlLifetimeSeconds);
  if (signedUrlError || !data?.signedUrl) {
    console.error("Signierte URL für Abrechnung konnte nicht erstellt werden.", signedUrlError);
    return NextResponse.json({ detail: "Das archivierte PDF konnte nicht geöffnet werden." }, { status: 502 });
  }

  return NextResponse.json({ url: data.signedUrl, expiresIn: signedUrlLifetimeSeconds });
}

export async function POST(request: Request, context: RouteContext) {
  const { propertyId, year: yearParam } = await context.params;
  const year = Number(yearParam);
  if (!/^[0-9a-f-]{36}$/i.test(propertyId) || !Number.isInteger(year) || year < 2000 || year > 2100) {
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

  const { data: statement } = await supabase
    .from("statements")
    .select("id, status, pdf_path")
    .eq("property_id", propertyId)
    .eq("billing_year", year)
    .maybeSingle();

  if (!statement) {
    return NextResponse.json({ detail: "Abrechnung nicht gefunden." }, { status: 404 });
  }
  if (statement.status !== "finalized") {
    return NextResponse.json({ detail: "Nur abgeschlossene Abrechnungen können archiviert werden." }, { status: 409 });
  }
  if (statement.pdf_path) {
    return NextResponse.json({ detail: "Für diese Abrechnung ist bereits ein PDF archiviert." }, { status: 409 });
  }

  const formData = await request.formData();
  const value = formData.get("pdf");
  if (!(value instanceof File) || value.size === 0) {
    return NextResponse.json({ detail: "Bitte eine PDF-Datei auswählen." }, { status: 400 });
  }
  if (value.type !== "application/pdf" && !value.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ detail: "Nur PDF-Dateien sind erlaubt." }, { status: 400 });
  }
  if (value.size > maxFileSize) {
    return NextResponse.json({ detail: "Das PDF darf höchstens 10 MB groß sein." }, { status: 400 });
  }

  const path = `${user.id}/${propertyId}/${year}/${crypto.randomUUID()}-Abrechnung-${year}.pdf`;
  const { error: uploadError } = await supabase.storage.from("statements").upload(path, value, {
    contentType: "application/pdf",
    upsert: false,
  });

  if (uploadError) {
    console.error("Abrechnung konnte nicht in Supabase Storage hochgeladen werden.", uploadError);
    return NextResponse.json({ detail: "Das PDF konnte nicht hochgeladen werden." }, { status: 502 });
  }

  const { error: updateError } = await supabase
    .from("statements")
    .update({ pdf_path: path })
    .eq("id", statement.id);

  if (updateError) {
    await supabase.storage.from("statements").remove([path]);
    console.error("PDF-Pfad konnte nicht an der Abrechnung gespeichert werden.", updateError);
    return NextResponse.json({ detail: "Das PDF konnte nicht verknüpft werden." }, { status: 502 });
  }

  return NextResponse.json({ pdfPath: path }, { status: 201 });
}
