import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";

type ToastVariant = "default" | "ok" | "warn";

type ToastProps = HTMLAttributes<HTMLDivElement> & {
  variant?: ToastVariant;
  title: ReactNode;
  children: ReactNode;
};

function variantClass(variant: ToastVariant | undefined) {
  switch (variant) {
    case "ok":
      return "ds-toast--ok";
    case "warn":
      return "ds-toast--warn";
    default:
      return "";
  }
}

/**
 * Iedora Manual § VI.7. Quiet by default; ink dot = ok; cinnabar dot = warn.
 * Six-second life by convention; the host (your toast manager) owns timing.
 */
export function Toast({ variant, title, className, children, ...rest }: ToastProps) {
  return (
    <div
      {...rest}
      role="status"
      className={cn("ds-toast", variantClass(variant), className)}
    >
      <div className="ds-toast__title">{title}</div>
      <div className="ds-toast__msg">{children}</div>
    </div>
  );
}
