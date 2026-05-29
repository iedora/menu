import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";

/**
 * A full-viewport scroll-pinned editorial section. The legacy site uses
 * this for the four "rooms" of About (Mission / Slowly / Quietly / Together)
 * and the Works showcase. Each section is a tall `track` containing a
 * `position: sticky` pin; the host runs a small scroll handler that writes
 * the section progress (0..1) to `--p` on the pin so child components can
 * read it via `var(--p)`.
 *
 *   <ScrollPinned data-value="0" data-name="Mission">
 *     <ScrollPinnedHead num="/ 01" name="Mission" right="The roof, first." />
 *     <ScrollPinnedStage>…</ScrollPinnedStage>
 *     <ScrollPinnedFoot leftLabel="Drawing" rightLabel="01 / 04" />
 *   </ScrollPinned>
 */
type ScrollPinnedProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  variant?: string;
};

export function ScrollPinned({
  children,
  variant,
  className,
  ...rest
}: ScrollPinnedProps) {
  return (
    <div className={cn("ds-value", variant, className)} {...rest}>
      <div className="ds-v-track">
        <div className="ds-v-pin">{children}</div>
      </div>
    </div>
  );
}

type HeadProps = HTMLAttributes<HTMLDivElement> & {
  num: ReactNode;
  name: ReactNode;
  right?: ReactNode;
  live?: boolean;
};

export function ScrollPinnedHead({
  num,
  name,
  right,
  live,
  className,
  ...rest
}: HeadProps) {
  return (
    <div className={cn("ds-v-head", className)} {...rest}>
      <span className="ds-v-head__num">{num}</span>
      <span className="ds-v-head__name">{name}</span>
      <span className="ds-v-head__rule" aria-hidden="true" />
      <span className="ds-v-head__right">
        {live ? <span className="ds-v-head__live-dot" aria-hidden="true" /> : null}
        {right}
      </span>
    </div>
  );
}

type StageProps = HTMLAttributes<HTMLDivElement> & { children: ReactNode };

export function ScrollPinnedStage({ children, className, ...rest }: StageProps) {
  return (
    <div className={cn("ds-v-stage", className)} {...rest}>
      {children}
    </div>
  );
}

type FootProps = HTMLAttributes<HTMLDivElement> & {
  leftLabel: ReactNode;
  rightLabel: ReactNode;
};

export function ScrollPinnedFoot({
  leftLabel,
  rightLabel,
  className,
  ...rest
}: FootProps) {
  return (
    <div className={cn("ds-v-foot", className)} {...rest}>
      <span>{leftLabel}</span>
      <div className="ds-v-foot__bar" aria-hidden="true">
        <div className="ds-v-foot__bar-fill" />
        <div className="ds-v-foot__bar-pin" />
      </div>
      <span>{rightLabel}</span>
    </div>
  );
}
