import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";

type VisuallyHiddenProps = HTMLAttributes<HTMLSpanElement> & {
  as?: "span" | "div";
  children: ReactNode;
};

/**
 * Visually hides content while leaving it readable to screen readers.
 * Uses the standard `clip: rect(0,0,0,0)` pattern. Pair with `aria-hidden="true"`
 * on any *decorative* duplicate that the SR-only copy is paraphrasing.
 */
export function VisuallyHidden({
  as = "span",
  className,
  children,
  ...rest
}: VisuallyHiddenProps) {
  const Cmp = as;
  return (
    <Cmp className={cn("ds-sr-only", className)} {...rest}>
      {children}
    </Cmp>
  );
}
