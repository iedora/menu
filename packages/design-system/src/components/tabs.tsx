import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";

type TabsProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

type TabProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Active tab gets the inverted ink fill. */
  active?: boolean;
  children: ReactNode;
};

/**
 * Iedora Manual § VI.9. Hairline-framed strip of mono uppercase tabs.
 * The active tab is inverted to ink-on-paper.
 *
 * The component is presentational — wire your own active state (router,
 * useState, etc.) and toggle the `active` prop on each <Tab>.
 */
export function Tabs({ className, children, ...rest }: TabsProps) {
  return (
    <div
      {...rest}
      role="tablist"
      className={cn("ds-tabs", className)}
    >
      {children}
    </div>
  );
}

export function Tab({ active, className, children, type, ...rest }: TabProps) {
  return (
    <button
      {...rest}
      type={type ?? "button"}
      role="tab"
      aria-selected={active ? "true" : "false"}
      className={cn("ds-tabs__tab", active && "ds-tabs__tab--on", className)}
    >
      {children}
    </button>
  );
}
