import { cn } from "../lib/cn";

type KeyMarkProps = {
  className?: string;
  ariaLabel?: string;
};

/**
 * Editorial security mark — a small skeleton key that turns a quiet
 * quarter on idle. Sits beside the iedora wordmark on the brand surfaces
 * (house intro, auth) to read as "identity, attended."
 *
 * SSR-only: the animation is CSS @keyframes on the SVG root, so this
 * composes inside Astro templates without a `client:*` directive and
 * also renders correctly inside a React tree. Honors
 * `prefers-reduced-motion` (pauses to its resting horizontal position).
 *
 * Size scales off the `--ds-key-mark-size` custom property (default
 * 28px wide / 14px tall). Color follows `currentColor` from the parent.
 */
export function KeyMark({ className, ariaLabel = "Key" }: KeyMarkProps) {
  return (
    <svg
      className={cn("ds-key-mark", className)}
      role="img"
      aria-label={ariaLabel}
      viewBox="0 0 24 12"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle
        cx="5"
        cy="6"
        r="3.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <line
        x1="8.2"
        y1="6"
        x2="22"
        y2="6"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <line
        x1="18"
        y1="6"
        x2="18"
        y2="9.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <line
        x1="21"
        y1="6"
        x2="21"
        y2="9"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}
