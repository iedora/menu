import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";
import { SectionHeader } from "./section-header";

/**
 * Editorial stat primitives for cross-tenant admin surfaces. Lifted
 * out of the menu product so any future surface (house dashboard,
 * standalone tools) can render the same paper / ink / cinnabar
 * snapshot panels described in Iedora Manual § VI.5.
 *
 * Composition:
 *
 *   <StatsPanel
 *     title="Overview"
 *     snapshotAt="2026-05-22T12:00:00Z"
 *     stats={[<Stat label=… value=… />, …]}
 *     histograms={[<Histogram label=… entries=… />, …]}
 *   />
 *
 * `<Stat tone="warn">` paints the number cinnabar when non-zero so
 * the "stale" / "no-MFA" counters stand out without an extra row.
 */

/** Section header strip — title + optional snapshot timestamp, right-aligned. */
export function StatsHeader({
  title,
  snapshotAt,
}: {
  title: ReactNode;
  /** ISO timestamp (server-rendered). Displayed as `snapshot @ HH:mm:ssZ`. */
  snapshotAt?: string;
}) {
  return (
    <SectionHeader
      title={title}
      hint={snapshotAt ? `snapshot @ ${snapshotAt.slice(11, 19)}Z` : undefined}
    />
  );
}

type StatProps = HTMLAttributes<HTMLDivElement> & {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  /** `warn` paints the number cinnabar when the value is non-zero. */
  tone?: "normal" | "warn";
};

export function Stat({
  label,
  value,
  hint,
  tone = "normal",
  className,
  ...rest
}: StatProps) {
  const warn = tone === "warn" && value !== "0" && value !== 0;
  return (
    <div
      {...rest}
      className={cn("ds-stat", warn && "ds-stat--warn", className)}
    >
      <div className="ds-stat__label">{label}</div>
      <div className="ds-stat__value">{value}</div>
      {hint ? <div className="ds-stat__hint">{hint}</div> : null}
    </div>
  );
}

export type HistogramEntry = { name: string; count: number };

type HistogramProps = HTMLAttributes<HTMLDivElement> & {
  label: ReactNode;
  entries: ReadonlyArray<HistogramEntry>;
  /** Optional leading icon — receives the entry name. */
  renderIcon?: (name: string) => ReactNode;
};

/**
 * Text-based bar chart — `name · bar · count`. Bar widths are
 * normalised against the total so they're visually comparable. Renders
 * a "No data" placeholder when empty so the slot keeps its shape.
 */
export function Histogram({
  label,
  entries,
  renderIcon,
  className,
  ...rest
}: HistogramProps) {
  const total = entries.reduce((acc, e) => acc + e.count, 0);
  return (
    <div {...rest} className={cn("ds-histogram", className)}>
      <div className="ds-histogram__label">{label}</div>
      {entries.length === 0 ? (
        <div className="ds-histogram__empty">No data.</div>
      ) : (
        <ul className="ds-histogram__rows">
          {entries.map((e) => {
            const pct = total === 0 ? 0 : (e.count / total) * 100;
            return (
              <li key={e.name} className="ds-histogram__row">
                {renderIcon ? (
                  <span className="ds-histogram__icon">{renderIcon(e.name)}</span>
                ) : null}
                <span className="ds-histogram__name">{e.name}</span>
                <span className="ds-histogram__bar">
                  <span
                    aria-hidden
                    className="ds-histogram__fill"
                    style={{ width: `${pct}%` }}
                  />
                </span>
                <span className="ds-histogram__count">{e.count}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

type StatsPanelProps = HTMLAttributes<HTMLElement> & {
  title: ReactNode;
  snapshotAt?: string;
  stats: ReadonlyArray<ReactNode>;
  histograms?: ReadonlyArray<ReactNode>;
};

export function StatsPanel({
  title,
  snapshotAt,
  stats,
  histograms,
  className,
  ...rest
}: StatsPanelProps) {
  return (
    <section {...rest} className={cn("ds-stats-panel", className)}>
      <StatsHeader title={title} snapshotAt={snapshotAt} />
      <div className="ds-stats-panel__grid">{stats}</div>
      {histograms && histograms.length > 0 ? (
        <div className="ds-stats-panel__histograms">{histograms}</div>
      ) : null}
    </section>
  );
}
