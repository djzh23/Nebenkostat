import type { ElementType, ReactNode } from "react";

// Layout primitives. The gutter and the vertical rhythm live here, so pages never
// repeat raw container or section padding.

export function Container({ as: Tag = "div", className = "", children }: { as?: ElementType; className?: string; children: ReactNode }) {
  return <Tag className={`mx-auto w-full max-w-6xl px-4 md:px-8 ${className}`.trim()}>{children}</Tag>;
}

export function Section({
  as: Tag = "section",
  id,
  divided = false,
  className = "",
  children,
}: {
  as?: ElementType;
  id?: string;
  divided?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tag id={id} className={`scroll-mt-8 py-20 md:py-28 ${divided ? "border-t border-ink/20" : ""} ${className}`.trim()}>
      {children}
    </Tag>
  );
}

// Two-column section used for "statement plus explanation" layouts on wide screens.
export function SplitSection({ heading, children }: { heading: ReactNode; children: ReactNode }) {
  return (
    <div className="grid min-w-0 grid-cols-1 gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
      <div className="min-w-0">{heading}</div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
