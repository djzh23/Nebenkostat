import type { ReactNode } from "react";

// Headings: one display style for page titles, one for section titles.
// The section heading sits above a rule so each block reads as a receipt header.

export function PageTitle({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h1 id={id} className="font-sans text-[clamp(2.25rem,4vw,3.5rem)] font-black leading-[0.98] tracking-[-0.035em] text-balance">
      {children}
    </h1>
  );
}

export function SectionTitle({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h2 id={id} className="font-sans text-[clamp(2rem,3.6vw,3.25rem)] font-extrabold leading-[1.02] tracking-[-0.03em] text-balance">
      {children}
    </h2>
  );
}

export function BlockHeading({ children, note }: { children: ReactNode; note?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-ink pb-3">
      <h2 className="font-sans text-2xl font-extrabold tracking-tight">{children}</h2>
      {note ? <p className="text-sm text-ink-muted">{note}</p> : null}
    </div>
  );
}
