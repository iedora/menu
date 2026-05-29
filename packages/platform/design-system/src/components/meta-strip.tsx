import type { ReactNode } from "react";
import { cn } from "../lib/cn";

type MetaStripProps = {
  left?: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
  ariaLabel?: string;
  className?: string;
};

export function MetaStrip({
  left,
  center,
  right,
  ariaLabel = "Meta",
  className,
}: MetaStripProps) {
  return (
    <nav className={cn("ds-meta-strip", className)} aria-label={ariaLabel}>
      <div className="ds-meta-strip__left">{left}</div>
      <div className="ds-meta-strip__center">{center}</div>
      <div className="ds-meta-strip__right">{right}</div>
    </nav>
  );
}
