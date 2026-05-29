import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";

type BadgeVariant = "default" | "live" | "ink" | "accent" | "ghost";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
  children: ReactNode;
};

function variantClass(variant: BadgeVariant | undefined) {
  switch (variant) {
    case "live":
      return "ds-badge--live";
    case "ink":
      return "ds-badge--ink";
    case "accent":
      return "ds-badge--accent";
    case "ghost":
      return "ds-badge--ghost";
    default:
      return "";
  }
}

/**
 * Iedora Manual § VI.2. Capsule, mono, tiny. Variants: default (hairline),
 * live (cinnabar dot), ink (fill), accent (cinnabar fill), ghost (dashed).
 */
export function Badge({ variant, className, children, ...rest }: BadgeProps) {
  return (
    <span
      {...rest}
      className={cn("ds-badge", variantClass(variant), className)}
    >
      {children}
    </span>
  );
}
