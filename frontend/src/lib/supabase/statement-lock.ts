import type { createClient } from "./server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export async function checkFinalizedStatement(
  supabase: SupabaseClient,
  propertyId: string,
  billingYear?: number,
) {
  const query = supabase
    .from("statements")
    .select("id")
    .eq("property_id", propertyId)
    .eq("status", "finalized");

  const result = billingYear === undefined
    ? await query.limit(1)
    : await query.eq("billing_year", billingYear).limit(1);

  return {
    locked: (result.data?.length ?? 0) > 0,
    error: result.error,
  };
}
