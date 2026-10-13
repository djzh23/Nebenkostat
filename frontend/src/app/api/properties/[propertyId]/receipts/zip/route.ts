import JSZip from "jszip";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ propertyId: string }> };

function safeFilePart(value: string) {
  const normalized = value.normalize("NFKD").replace(/[^a-zA-Z0-9._-]/g, "-");
  return normalized.replace(/-+/g, "-").replace(/^-|-$/g, "") || "Beleg";
}

function originalFileName(path: string) {
  const fileName = path.split("/").at(-1) ?? "Beleg";
  return fileName.replace(/^[0-9a-f-]{36}-/i, "") || "Beleg";
}

export async function GET(request: Request, context: RouteContext) {
  const { propertyId } = await context.params;
  const year = Number(new URL(request.url).searchParams.get("year"));
  if (!/^[0-9a-f-]{36}$/i.test(propertyId) || !Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ detail: "Ungültige Archivdaten." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ detail: "Nicht angemeldet." }, { status: 401 });
  }

  const { data: costs, error: costsError } = await supabase
    .from("cost_items")
    .select("id, category, receipt_path")
    .eq("property_id", propertyId)
    .eq("billing_year", year)
    .not("receipt_path", "is", null)
    .order("created_at", { ascending: true });

  if (costsError) {
    console.error("Belege konnten für das ZIP-Archiv nicht geladen werden.", costsError);
    return NextResponse.json({ detail: "Das Belegarchiv konnte nicht erstellt werden." }, { status: 502 });
  }
  if (!costs || costs.length === 0) {
    return NextResponse.json({ detail: `Für ${year} sind noch keine Belege archiviert.` }, { status: 404 });
  }

  const zip = new JSZip();
  let fileCount = 0;

  for (const cost of costs) {
    if (typeof cost.receipt_path !== "string" || !cost.receipt_path) continue;

    const { data: file, error: downloadError } = await supabase.storage
      .from("receipts")
      .download(cost.receipt_path);
    if (downloadError || !file) {
      console.error("Beleg konnte für das ZIP-Archiv nicht geladen werden.", downloadError);
      return NextResponse.json({ detail: "Das Belegarchiv konnte nicht vollständig erstellt werden." }, { status: 502 });
    }

    fileCount += 1;
    const category = typeof cost.category === "string" ? safeFilePart(cost.category) : "Beleg";
    zip.file(`${String(fileCount).padStart(2, "0")}-${category}-${originalFileName(cost.receipt_path)}`, await file.arrayBuffer());
  }

  if (fileCount === 0) {
    return NextResponse.json({ detail: `Für ${year} sind noch keine Belege archiviert.` }, { status: 404 });
  }

  const archive = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  return new NextResponse(archive as unknown as BodyInit, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="Belegarchiv-${year}.zip"`,
      "Content-Type": "application/zip",
    },
  });
}
