import type { ReactNode } from "react";
import { Wordmark } from "./wordmark";
import { cn } from "../lib/cn";

type LintelProps = {
  end?: ReactNode;
  children?: ReactNode;
  className?: string;
};

export function Lintel({ end, children, className }: LintelProps) {
  if (children) {
    return <div className={cn("ds-lintel", className)}>{children}</div>;
  }
  return (
    <div className={cn("ds-lintel", className)}>
      <Wordmark variant="inline" />
      <span className="ds-lintel__rule" aria-hidden="true" />
      {end ?? <span aria-hidden="true" />}
    </div>
  );
}
