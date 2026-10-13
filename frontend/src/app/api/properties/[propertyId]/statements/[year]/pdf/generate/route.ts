import { NextResponse } from "next/server";
import { createStatementPdf, normalizeStatementResult } from "@/lib/pdf/statement-pdf";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ propertyId: string; year: string }> };

export async function POST(_request: Request, context: RouteContext) {
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
    .select("id, status, pdf_path, result, finalized_at")
    .eq("property_id", propertyId)
    .eq("billing_year", year)
    .maybeSingle();
  if (statementError) {
    console.error("Abrechnung konnte für die PDF-Erzeugung nicht geladen werden.", statementError);
    return NextResponse.json({ detail: "Die Abrechnung konnte nicht geladen werden." }, { status: 502 });
  }
  if (!statement) {
    return NextResponse.json({ detail: "Abrechnung nicht gefunden." }, { status: 404 });
  }
  if (statement.status !== "finalized") {
    return NextResponse.json({ detail: "Nur abgeschlossene Abrechnungen können als PDF archiviert werden." }, { status: 409 });
  }
  if (statement.pdf_path) {
    return NextResponse.json({ pdfPath: statement.pdf_path, created: false });
  }
  if (typeof statement.finalized_at !== "string") {
    return NextResponse.json({ detail: "Der Abschlusszeitpunkt der Abrechnung fehlt." }, { status: 409 });
  }

  const result = normalizeStatementResult(statement.result);
  if (!result || result.year !== year) {
    return NextResponse.json({ detail: "Das eingefrorene Abrechnungsergebnis ist ungültig." }, { status: 409 });
  }

  const { data: property, error: propertyError } = await supabase
    .from("properties")
    .select("name, street, zip, city")
    .eq("id", propertyId)
    .maybeSingle();
  if (propertyError) {
    console.error("Objekt konnte für die PDF-Erzeugung nicht geladen werden.", propertyError);
    return NextResponse.json({ detail: "Das Objekt konnte nicht geladen werden." }, { status: 502 });
  }
  if (!property) {
    return NextResponse.json({ detail: "Objekt nicht gefunden." }, { status: 404 });
  }

  let pdf: Uint8Array;
  try {
    pdf = await createStatementPdf(property, result, statement.finalized_at);
  } catch (error) {
    console.error("PDF konnte nicht erzeugt werden.", error);
    return NextResponse.json({ detail: "Das PDF konnte nicht erzeugt werden." }, { status: 502 });
  }

  const path = `${user.id}/${propertyId}/${year}/${crypto.randomUUID()}-Abrechnung-${year}.pdf`;
  const { error: uploadError } = await supabase.storage.from("statements").upload(path, pdf, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (uploadError) {
    console.error("Automatisch erzeugtes PDF konnte nicht archiviert werden.", uploadError);
    return NextResponse.json({ detail: "Das erzeugte PDF konnte nicht archiviert werden." }, { status: 502 });
  }

  const { error: updateError } = await supabase
    .from("statements")
    .update({ pdf_path: path })
    .eq("id", statement.id)
    .is("pdf_path", null);
  if (updateError) {
    await supabase.storage.from("statements").remove([path]);
    console.error("Automatisch erzeugtes PDF konnte nicht verknüpft werden.", updateError);
    return NextResponse.json({ detail: "Das erzeugte PDF konnte nicht archiviert werden." }, { status: 502 });
  }

  return NextResponse.json({ pdfPath: path, created: true }, { status: 201 });
}
