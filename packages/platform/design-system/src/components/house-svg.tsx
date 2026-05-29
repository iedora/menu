/**
 * A drawn-by-scroll house. Each segment carries `data-len`, `data-start`,
 * `data-end` attributes that the host init script reads on every scroll
 * frame to map the section's progress (`--p`) into a `--local` (0..1)
 * per-segment, which CSS uses to animate `stroke-dashoffset` (lines) or
 * `opacity` (text + the door knob).
 *
 * Markup is identical to the legacy `<svg class="house-svg">` so the JS
 * choreography ports 1:1. Decorative — `aria-hidden`.
 */
export function HouseSvg({ className }: { className?: string }) {
  return (
    <svg
      className={["ds-house-svg", className].filter(Boolean).join(" ")}
      viewBox="0 0 320 280"
      aria-hidden="true"
    >
      {/* ground */}
      <line
        className="ds-house-svg__draw"
        x1="20" y1="240" x2="300" y2="240"
        data-len="280" data-start="0" data-end="0.10"
      />
      {/* left wall */}
      <line
        className="ds-house-svg__draw"
        x1="60" y1="240" x2="60" y2="120"
        data-len="120" data-start="0.10" data-end="0.25"
      />
      {/* right wall */}
      <line
        className="ds-house-svg__draw"
        x1="260" y1="240" x2="260" y2="120"
        data-len="120" data-start="0.10" data-end="0.25"
      />
      {/* floor cap */}
      <line
        className="ds-house-svg__draw"
        x1="60" y1="240" x2="260" y2="240"
        data-len="200" data-start="0.18" data-end="0.30"
      />
      {/* roof left */}
      <line
        className="ds-house-svg__draw"
        x1="60" y1="120" x2="160" y2="40"
        data-len="128" data-start="0.30" data-end="0.50"
      />
      {/* roof right */}
      <line
        className="ds-house-svg__draw"
        x1="260" y1="120" x2="160" y2="40"
        data-len="128" data-start="0.30" data-end="0.50"
      />
      {/* door */}
      <polyline
        className="ds-house-svg__draw"
        points="140,240 140,180 180,180 180,240"
        data-len="180" data-start="0.55" data-end="0.72"
      />
      {/* window left */}
      <polyline
        className="ds-house-svg__draw"
        points="80,170 110,170 110,200 80,200 80,170"
        data-len="120" data-start="0.60" data-end="0.78"
      />
      {/* window right */}
      <polyline
        className="ds-house-svg__draw"
        points="210,170 240,170 240,200 210,200 210,170"
        data-len="120" data-start="0.60" data-end="0.78"
      />
      {/* chimney */}
      <polyline
        className="ds-house-svg__draw"
        points="220,72 220,42 240,42 240,98"
        data-len="116" data-start="0.45" data-end="0.62"
      />
      {/* door knob (cinnabar dot) */}
      <circle
        className="ds-house-svg__fade ds-house-svg__accent"
        cx="172" cy="212" r="2.5"
        fill="currentColor"
        stroke="none"
        data-start="0.85" data-end="1.0"
      />
      {/* "iedora" stamp under the eave */}
      <text
        className="ds-house-svg__fade"
        x="160" y="270"
        textAnchor="middle"
        fontFamily="JetBrains Mono, monospace"
        fontSize="9"
        letterSpacing="2"
        fill="rgba(26,24,21,0.45)"
        data-start="0.78" data-end="0.98"
      >
        IEDORA · MMXXVI
      </text>
    </svg>
  );
}
