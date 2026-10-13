import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "quiet" | "danger";
export type ButtonSize = "md" | "sm";

const base =
  "inline-flex items-center justify-center font-semibold transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-stamp text-paper hover:bg-stamp-deep active:translate-y-px",
  secondary: "border border-ink text-ink hover:bg-ink hover:text-paper",
  quiet: "text-ink underline decoration-ink/40 decoration-2 underline-offset-[6px] hover:decoration-stamp",
  danger: "text-stamp-deep underline decoration-stamp/50 decoration-2 underline-offset-[6px] hover:decoration-stamp-deep",
};

const sizes: Record<ButtonSize, string> = {
  md: "min-h-11 px-5 text-base",
  sm: "min-h-9 px-3 text-sm",
};

function buttonClass(variant: ButtonVariant, size: ButtonSize, className?: string) {
  return [base, variants[variant], sizes[size], className].filter(Boolean).join(" ");
}

type CommonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: CommonProps & ComponentProps<"button">) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  ...props
}: CommonProps & { href: string }) {
  return <Link href={href} className={buttonClass(variant, size, className)} {...props} />;
}
