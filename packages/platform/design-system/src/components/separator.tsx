import type { ComponentPropsWithoutRef } from "react";
import { Separator as RadixSeparator } from "radix-ui";
import { cn } from "../lib/cn";

type SeparatorProps = ComponentPropsWithoutRef<typeof RadixSeparator.Root>;

/**
 * Iedora hairline separator — 1px ink-14 rule. Radix-backed so it carries
 * the proper `role="separator"` / `role="none"` semantics depending on
 * whether it's decorative (`decorative=true`, the default) or meaningful.
 *
 *   <Separator />                         // horizontal, decorative
 *   <Separator orientation="vertical" />  // for inline groups
 */
export function Separator({
  className,
  decorative = true,
  orientation = "horizontal",
  ...rest
}: SeparatorProps) {
  return (
    <RadixSeparator.Root
      {...rest}
      decorative={decorative}
      orientation={orientation}
      className={cn(
        "ds-separator",
        orientation === "vertical" && "ds-separator--vertical",
        className,
      )}
    />
  );
}
