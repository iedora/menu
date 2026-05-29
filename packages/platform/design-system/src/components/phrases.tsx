import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";

type PhrasesProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  /** Center the column (used by the Slowly and Quietly rooms). */
  center?: boolean;
};

/**
 * Stack of editorial sentences. Each `<Phrase>` sits absolutely on top of
 * the next; the host JS computes which phrase is "active" from the section's
 * scroll progress and sets each phrase's `opacity` + `transform` directly.
 * The wrapper carries the `data-phrases` attribute so the init script can
 * find them.
 */
export function Phrases({ children, center, className, ...rest }: PhrasesProps) {
  return (
    <div
      className={cn("ds-phrases", center && "ds-phrases--center", className)}
      data-phrases
      {...rest}
    >
      {children}
    </div>
  );
}

type PhraseProps = HTMLAttributes<HTMLParagraphElement> & {
  children: ReactNode;
};

export function Phrase({ children, className, ...rest }: PhraseProps) {
  return (
    <p className={cn("ds-phrase", className)} {...rest}>
      {children}
    </p>
  );
}
