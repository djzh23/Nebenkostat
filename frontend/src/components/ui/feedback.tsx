import type { ReactNode } from "react";

type PillTone = "ok" | "warn" | "done" | "neutral";

const pillTone: Record<PillTone, string> = {
  ok: "border-ink text-ink",
  warn: "border-stamp text-stamp-deep",
  done: "border-ink bg-ink text-paper",
  neutral: "border-rule text-ink-muted",
};

export function Pill({ tone, children }: { tone: PillTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap border px-2.5 py-0.5 font-mono text-xs font-semibold uppercase tracking-wider ${pillTone[tone]}`}
    >
      {children}
    </span>
  );
}

export function Notice({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="border-l-2 border-stamp bg-paper px-4 py-3 text-sm leading-relaxed text-ink">
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

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="border border-dashed border-ink/40 px-6 py-12 text-center">
      <p className="font-sans text-xl font-bold">{title}</p>
      {children ? <div className="mx-auto mt-3 max-w-md text-base leading-relaxed text-ink-muted">{children}</div> : null}
    </div>
  );
}
