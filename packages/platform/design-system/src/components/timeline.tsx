import type { HTMLAttributes } from "react";
import { cn } from "../lib/cn";

export type TimelineMark = {
  /** Display label (e.g. "Begin"). */
  label: string;
  /** CSS left position, 0..1 → "5%". */
  left: number;
  /** Progress threshold at which the mark lights up. */
  at: number;
};

type TimelineProps = HTMLAttributes<HTMLDivElement> & {
  marks: TimelineMark[];
};

/**
 * Horizontal time line — a hairline that grows by `--p` (set by the host
 * on this element), with named marks that light when --p ≥ their `at`.
 * Each mark carries a `data-at` so the init script can toggle the
 * `.ds-timeline__mark--on` class without React state.
 */
export function Timeline({ marks, className, ...rest }: TimelineProps) {
  return (
    <div className={cn("ds-timeline", className)} {...rest}>
      <div className="ds-timeline__line">
        <div className="ds-timeline__grow" />
        <div className="ds-timeline__head" />
      </div>
      <div className="ds-timeline__marks">
        {marks.map((m) => (
          <span
            key={m.label}
            className="ds-timeline__mark"
            style={{ left: `${(m.left * 100).toFixed(2)}%` }}
            data-at={m.at}
          >
            {m.label}
          </span>
        ))}
      </div>
    </div>
  );
}
