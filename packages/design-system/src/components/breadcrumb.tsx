import type {
  AnchorHTMLAttributes,
  HTMLAttributes,
  ReactNode,
} from "react";
import { cn } from "../lib/cn";

type BreadcrumbProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
};

type BreadcrumbLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  children: ReactNode;
};

type BreadcrumbHereProps = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode;
};

/**
 * Iedora Manual § VI.9. Mono uppercase trail. Use <BreadcrumbLink> for
 * navigable segments and <BreadcrumbHere> for the current page. The
 * forward-slash separator is rendered automatically between siblings.
 */
export function Breadcrumb({ className, children, ...rest }: BreadcrumbProps) {
  const items = Array.isArray(children) ? children : [children];
  return (
    <nav
      {...rest}
      aria-label={rest["aria-label"] ?? "Breadcrumb"}
      className={cn("ds-breadcrumb", className)}
    >
      {items.map((child, i) => (
        <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
          {i > 0 ? <span className="ds-breadcrumb__sep" aria-hidden="true">/</span> : null}
          {child}
        </span>
      ))}
    </nav>
  );
}

export function BreadcrumbLink({ className, children, ...rest }: BreadcrumbLinkProps) {
  return (
    <a {...rest} className={cn(className)}>
      {children}
    </a>
  );
}

export function BreadcrumbHere({ className, children, ...rest }: BreadcrumbHereProps) {
  return (
    <span
      {...rest}
      aria-current="page"
      className={cn("ds-breadcrumb__here", className)}
    >
      {children}
    </span>
  );
}
