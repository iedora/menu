import { cn } from "../lib/cn";

/**
 * Deterministic 96-bar sin-wave. Heights are computed once at module load
 * (no Math.random) so the markup is byte-stable across SSR runs. Every
 * 13th bar is rendered in cinnabar. Wave collapses as `--p` rises on the
 * wrapper.
 */
const BAR_COUNT = 96;

function generateHeights(): number[] {
  const heights: number[] = [];
  for (let i = 0; i < BAR_COUNT; i++) {
    const t = i / BAR_COUNT;
    const h =
      0.55 +
      0.4 * Math.sin(t * Math.PI * 9) * 0.5 +
      0.30 * Math.sin(t * Math.PI * 23 + 1.1) +
      0.10 * Math.sin(t * Math.PI * 47 + 0.4) +
      (Math.sin(i * 99.13) * 0.5 + 0.5) * 0.15;
    heights.push(Math.max(0.08, Math.min(1, Math.abs(h))));
  }
  return heights;
}

const HEIGHTS = generateHeights();

export function Wave({ className }: { className?: string }) {
  return (
    <div className={cn("ds-wave", className)} aria-hidden="true">
      {HEIGHTS.map((h, i) => (
        <div
          key={i}
          className={cn("ds-wave__bar", i % 13 === 0 && "ds-wave__bar--accent")}
          style={{ ["--h" as string]: h.toFixed(3) }}
        />
      ))}
    </div>
  );
}
