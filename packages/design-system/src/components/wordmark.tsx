import { cn } from "../lib/cn";

type WordmarkProps = {
  word?: string;
  variant?: "display" | "inline";
  className?: string;
  ariaLabel?: string;
};

/**
 * Iedora wordmark. Each glyph (and the final cinnabar dot) is its own
 * `<span class="ds-wordmark__letter">` so consumers can stagger a
 * letter-by-letter reveal animation. Toggle the `ds-wordmark--reveal`
 * class on the parent to play it — Astro / Next layouts typically do
 * this in a small init script after first paint:
 *
 *     document.querySelectorAll('.ds-wordmark').forEach(w => {
 *       w.classList.add('ds-wordmark--reveal');
 *     });
 *
 * The `d` glyph is intentionally bolder; the dot is cinnabar.
 */
export function Wordmark({
  word = "iedora",
  variant = "display",
  className,
  ariaLabel,
}: WordmarkProps) {
  const letters = word.split("");
  return (
    <span
      className={cn(
        "ds-wordmark",
        variant === "display" ? "ds-wordmark--display" : "ds-wordmark--inline",
        className,
      )}
      role="img"
      aria-label={ariaLabel ?? `${word}.`}
    >
      {letters.map((ch, i) => (
        <span
          key={`${ch}-${i}`}
          className={cn(
            "ds-wordmark__letter",
            ch === "d" && "ds-wordmark__d",
          )}
          style={{ ["--ds-wordmark-letter-i" as string]: String(i) }}
          aria-hidden="true"
        >
          {ch}
        </span>
      ))}
      <span
        className="ds-wordmark__letter ds-wordmark__dot"
        style={{ ["--ds-wordmark-letter-i" as string]: String(letters.length) }}
        aria-hidden="true"
      >
        .
      </span>
    </span>
  );
}
