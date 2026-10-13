import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkFinalizedStatement } from "@/lib/supabase/statement-lock";

type RouteContext = { params: Promise<{ propertyId: string; costId: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
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
    .select("id, billing_year")
    .eq("id", costId)
    .eq("property_id", propertyId)
    .maybeSingle();

  if (!cost) {
    return NextResponse.json({ detail: "Kostenposition nicht gefunden." }, { status: 404 });
  }

  const lock = await checkFinalizedStatement(supabase, propertyId, cost.billing_year);
  if (lock.error) {
    console.error("Abschlussstatus konnte vor dem Löschen der Kosten nicht geprüft werden.", lock.error);
    return NextResponse.json({ detail: "Die Kostenposition konnte nicht geprüft werden." }, { status: 502 });
  }
  if (lock.locked) {
    return NextResponse.json(
      { detail: `Die Abrechnung ${cost.billing_year} ist abgeschlossen. Änderungen sind gesperrt.` },
      { status: 409 },
    );
  }

  const { error } = await supabase
    .from("cost_items")
    .delete()
    .eq("id", costId)
    .eq("property_id", propertyId);

  if (error) {
    console.error("Kostenposition konnte in Supabase nicht gelöscht werden.", error);
    return NextResponse.json({ detail: "Die Kostenposition konnte nicht gelöscht werden." }, { status: 502 });
  }

  return new NextResponse(null, { status: 204 });
}
