import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";

type SectionHeaderProps = Omit<HTMLAttributes<HTMLElement>, "title"> & {
  title: ReactNode;
  hint?: ReactNode;
  /** Tag to render the title element. Defaults to "h2". */
  as?: "h2" | "h3" | "h4" | "span" | "div";
};

/**
 * Editorial Section Header component.
 *
 * Designed to elevate overview panels, forms, and registry lists with
 * a refined Serif uppercase title and mono-spaced hints.
 *
 * Consistent with Iedora Manual typography guidelines.
 */
export function SectionHeader({
  title,
  hint,
  as: Tag = "h2",
  className,
  ...rest
}: SectionHeaderProps) {
  return (
    <header {...rest} className={cn("ds-section-header", className)}>
      <Tag className="ds-section-header__title">{title}</Tag>
      {hint && <span className="ds-section-header__hint">{hint}</span>}
    </header>
  );
}
