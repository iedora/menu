import type { HTMLAttributes } from "react";
import { cn } from "../lib/cn";

type ScrollHintProps = HTMLAttributes<HTMLDivElement> & {
  children?: React.ReactNode;
};

/**
 * Fixed scroll nudge — sits at the bottom of the viewport on the first
 * editorial section. Host JS adds `.ds-scroll-hint--hide` after the user
 * scrolls past ~40px. Decorative — `aria-hidden`.
 */
export function ScrollHint({
  children = "Scroll to enter",
  className,
  ...rest
}: ScrollHintProps) {
  return (
    <div className={cn("ds-scroll-hint", className)} aria-hidden="true" {...rest}>
      <span>{children}</span>
      <span className="ds-scroll-hint__nub" />
    </div>
  );
}
