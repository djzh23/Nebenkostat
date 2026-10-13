import type { ComponentProps, ReactNode } from "react";

// Form controls share one visual language: square, paper-coloured, ink border.
// Numbers use the mono face so amounts line up when they are typed and read back.

const control = "min-h-11 w-full border border-ink/40 bg-paper px-3 text-base text-ink placeholder:text-ink-muted/70 focus-visible:border-ink";

export function Input({ mono = false, className = "", ...props }: ComponentProps<"input"> & { mono?: boolean }) {
  return <input className={`${control} ${mono ? "font-mono tabular-nums" : "font-sans"} ${className}`.trim()} {...props} />;
}

export function Select({ className = "", ...props }: ComponentProps<"select">) {
  return <select className={`${control} cursor-pointer font-sans ${className}`.trim()} {...props} />;
}

export function Field({
  label,
  htmlFor,
  error,
  children,
  className = "",
}: {
  label: ReactNode;
  htmlFor: string;
  error?: string | null;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className}`.trim()}>
      <label htmlFor={htmlFor} className="text-sm font-semibold text-ink">
        {label}
      </label>
      {children}
      {error ? <p className="text-sm font-medium text-stamp-deep">{error}</p> : null}
    </div>
  );
}
