import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";

type ScreenLabelProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  on?: boolean;
};

/**
 * Corner mark fixed at the top-center of the viewport. Hidden by default;
 * the host toggles `.ds-screen-label--on` (or passes `on`) when the user
 * has scrolled past the first viewport (legacy used scrollY > 12vh).
 * Decorative — wrapped in `aria-hidden` because the section heading
 * already carries the same text for SR users.
 */
export function ScreenLabel({
  children,
  on,
  className,
  ...rest
}: ScreenLabelProps) {
  return (
    <div
      className={cn(
        "ds-screen-label",
        on && "ds-screen-label--on",
        className,
      )}
      aria-hidden="true"
      {...rest}
    >
      {children}
    </div>
  );
}
