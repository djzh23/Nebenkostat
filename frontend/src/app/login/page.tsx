import type { Metadata } from "next";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Anmelden | Nebenkostat",
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-desk px-4 py-12">
      <section className="receipt w-full max-w-md px-6 py-8 sm:px-9 sm:py-10">
        <p className="mb-8 font-mono text-xs uppercase tracking-[0.16em] text-ink-muted">
          Nebenkostat
        </p>
        <h1 className="font-sans text-3xl font-black tracking-tight sm:text-4xl">
          Deine Abrechnung wartet.
        </h1>
        <p className="mt-4 max-w-sm text-ink-muted">
          Wir schicken dir einen einmaligen Link per E-Mail. Kein Passwort nötig.
        </p>
        <LoginForm />
      </section>
    </main>
  );
}
