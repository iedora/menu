import type { HTMLAttributes } from "react";
import { cn } from "../lib/cn";

/**
 * Renders the fixed page-progress rail. The fill width is driven by the
 * CSS variable `--ds-pageprog-progress` (0..1) on the inner element; an
 * inline init script in the host page sets it from `window.scrollY` /
 * `document.documentElement.scrollHeight` on every scroll frame.
 *
 *   <PageProgress />
 *
 * The init script the host needs is tiny — see `BaseLayout.astro` for an
 * example. The component itself ships zero JS.
 */
export function PageProgress({
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("ds-pageprog", className)} aria-hidden="true" {...rest}>
      <div className="ds-pageprog__fill" />
    </div>
  );
}
