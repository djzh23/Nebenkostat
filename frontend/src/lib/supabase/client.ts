"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseConfig } from "./config";

let client: SupabaseClient | undefined;

export function createClient() {
  if (!client) {
    const { url, key } = getSupabaseConfig();
    client = createBrowserClient(url, key);
  }

  return client;
}
