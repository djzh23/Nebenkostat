const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function getSupabaseConfig() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Supabase ist nicht konfiguriert. Setze NEXT_PUBLIC_SUPABASE_URL und NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (oder NEXT_PUBLIC_SUPABASE_ANON_KEY).",
    );
  }

  return { url: supabaseUrl, key: supabaseKey };
}
