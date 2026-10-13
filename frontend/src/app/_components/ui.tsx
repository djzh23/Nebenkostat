import type { ReactNode } from "react";

// Shared classes for the app surface. Same receipt world as the landing page,
// tuned for scanning: labels above fields, dashed rules between rows, one stamp accent.

export const buttonPrimary =
  "inline-flex min-h-11 items-center justify-center bg-stamp px-5 text-base font-semibold text-paper transition-colors duration-200 hover:bg-stamp-deep active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50";

export const buttonSecondary =
  "inline-flex min-h-11 items-center justify-center border border-ink px-5 text-base font-semibold text-ink transition-colors duration-200 hover:bg-ink hover:text-paper disabled:cursor-not-allowed disabled:opacity-50";

export const buttonQuiet =
  "inline-flex min-h-11 items-center text-base font-semibold text-ink underline decoration-ink/40 decoration-2 underline-offset-[6px] transition-colors duration-200 hover:decoration-stamp";

export const fieldLabel = "mb-1.5 block text-sm font-semibold text-ink";

export const fieldInput =
  "min-h-11 w-full border border-ink/40 bg-paper px-3 font-mono text-base tabular-nums text-ink placeholder:font-sans placeholder:text-ink-muted/70 focus-visible:border-ink";

export const fieldText =
  "min-h-11 w-full border border-ink/40 bg-paper px-3 font-sans text-base text-ink placeholder:text-ink-muted/70 focus-visible:border-ink";

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`receipt px-5 py-7 sm:px-8 sm:py-8 ${className}`}>{children}</section>;
}

export function SectionHeading({ children, note }: { children: ReactNode; note?: string }) {
  return (
    <div className="mb-6 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-ink pb-3">
      <h2 className="font-sans text-2xl font-extrabold tracking-tight">{children}</h2>
      {note ? <p className="text-sm text-ink-muted">{note}</p> : null}
    </div>
  );
}

type Tone = "ok" | "warn" | "done" | "neutral";

const toneClass: Record<Tone, string> = {
  ok: "border-ink text-ink",
  warn: "border-stamp text-stamp-deep",
  done: "border-ink bg-ink text-paper",
  neutral: "border-rule text-ink-muted",
};

export function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap border px-2.5 py-0.5 font-mono text-xs font-semibold uppercase tracking-wider ${toneClass[tone]}`}>
      {children}
    </span>
  );
}

export function Notice({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="border-l-2 border-stamp bg-paper px-4 py-3 text-sm text-ink">
      {children}
    </p>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="text-sm font-semibold text-stamp-deep">
      {children}
    </p>
  );
}

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border border-dashed border-ink/40 px-6 py-10 text-center">
      <p className="font-sans text-xl font-bold">{title}</p>
      <div className="mx-auto mt-3 max-w-md text-base text-ink-muted">{children}</div>
    </div>
  );
}

export function formatDateDe(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}
