import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";

type StatementProps = HTMLAttributes<HTMLParagraphElement> & {
  children: ReactNode;
};

export function Statement({ children, className, ...rest }: StatementProps) {
  return (
    <p className={cn("ds-statement", className)} {...rest}>
      {children}
    </p>
  );
}
