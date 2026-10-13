"use client";

import { FormEvent, useState } from "react";

import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setMessage(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
    });

    if (error) {
      setStatus("error");
      const isNetworkError =
        error.name === "AuthRetryableFetchError" ||
        error.message.toLowerCase().includes("fetch failed");
      setMessage(
        isNetworkError
          ? "Supabase ist gerade nicht erreichbar. Bitte prüfe Internetverbindung, VPN oder DNS."
          : "Der Login-Link konnte nicht verschickt werden. Bitte prüfe die E-Mail-Adresse.",
      );
      return;
    }

    setStatus("sent");
    setMessage("Der Login-Link ist unterwegs. Prüfe dein Postfach.");
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-5">
      <div>
        <label htmlFor="email" className="mb-2 block text-sm font-semibold">
          E-Mail-Adresse
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="min-h-12 w-full border border-rule bg-paper px-4 text-base outline-none focus:border-ink focus:ring-2 focus:ring-ink focus:ring-offset-2 focus:ring-offset-paper"
        />
      </div>
      <button
        type="submit"
        disabled={status === "loading" || status === "sent"}
        className="min-h-12 w-full bg-stamp px-6 font-semibold text-paper transition-colors hover:bg-stamp-deep disabled:cursor-wait disabled:opacity-60"
      >
        {status === "loading" ? "Wird verschickt …" : status === "sent" ? "Link verschickt" : "Login-Link senden"}
      </button>
      {message ? (
        <p role={status === "error" ? "alert" : "status"} className="text-sm text-ink-muted">
          {message}
        </p>
      ) : null}
    </form>
  );
}
