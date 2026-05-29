import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";

type EmptyStateProps = HTMLAttributes<HTMLDivElement> & {
  /** Mono uppercase eyebrow, e.g. "Forthcoming". */
  label: ReactNode;
  /** Single-line italic serif note. Capped at 28ch by the stylesheet. */
  note?: ReactNode;
  /** Override the centered glyph; defaults to the cinnabar middle dot ·. */
  mark?: ReactNode;
};

/**
 * Iedora Manual § VI.8. Dashed hairline, single dot, label, note. No
 * illustrations, no apologies. The absence is the message.
 */
export function EmptyState({
  label,
  note,
  mark = "·",
  className,
  ...rest
}: EmptyStateProps) {
  return (
    <div {...rest} className={cn("ds-empty", className)}>
      <div className="ds-empty__mark" aria-hidden="true">
        {mark}
      </div>
      <div className="ds-empty__label">{label}</div>
      {note ? <div className="ds-empty__note">{note}</div> : null}
    </div>
  );
}
