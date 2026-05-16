import { cn } from "../lib/cn";

type WordmarkProps = {
  word?: string;
  variant?: "display" | "inline";
  className?: string;
  ariaLabel?: string;
};

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
          className={ch === "d" ? "ds-wordmark__d" : undefined}
          aria-hidden="true"
        >
          {ch}
        </span>
      ))}
      <span className="ds-wordmark__dot" aria-hidden="true">.</span>
    </span>
  );
}
