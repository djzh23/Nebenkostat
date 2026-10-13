"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function signOut() {
    setIsSigningOut(true);
    await createClient().auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={isSigningOut}
      className="text-sm font-semibold underline decoration-ink/40 decoration-2 underline-offset-4 hover:decoration-stamp disabled:opacity-60"
    >
      {isSigningOut ? "Abmelden …" : "Abmelden"}
    </button>
  );
}
