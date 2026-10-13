import type { ElementType, ReactNode } from "react";

// The receipt is the one recurring surface. Padding comes from a fixed scale so every
// receipt in the product sits on the same rhythm; pick a size, never a raw padding.
export type ReceiptPadding = "sm" | "md" | "lg";
export type ReceiptTone = "paper" | "outline";

const padding: Record<ReceiptPadding, string> = {
  sm: "px-4 py-5 sm:px-5 sm:py-6",
  md: "px-5 py-7 sm:px-8 sm:py-8",
  lg: "px-6 py-9 md:px-10 md:py-10",
};

const tone: Record<ReceiptTone, string> = {
  paper: "receipt",
  outline: "receipt border-2 border-stamp",
};

export function Receipt({
  as: Tag = "div",
  padding: size = "md",
  tone: surface = "paper",
  className = "",
  children,
}: {
  as?: ElementType;
  padding?: ReceiptPadding;
  tone?: ReceiptTone;
  className?: string;
  children: ReactNode;
}) {
  return <Tag className={`${tone[surface]} ${padding[size]} ${className}`.trim()}>{children}</Tag>;
}
