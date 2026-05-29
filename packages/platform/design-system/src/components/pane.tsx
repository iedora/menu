import type {
  HTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "../lib/cn";

type PaneGridProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function PaneGrid({ className, children, ...rest }: PaneGridProps) {
  return (
    <div className={cn("ds-pane-grid", className)} {...rest}>
      {children}
    </div>
  );
}

type PaneProps = LabelHTMLAttributes<HTMLLabelElement> & {
  full?: boolean;
  children: ReactNode;
};

export function Pane({ full, className, children, ...rest }: PaneProps) {
  return (
    <label
      className={cn("ds-pane", full && "ds-pane--full", className)}
      {...rest}
    >
      {children}
    </label>
  );
}

type PaneLabelProps = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode;
  hint?: ReactNode;
};

export function PaneLabel({ children, hint, className, ...rest }: PaneLabelProps) {
  return (
    <span className={cn("ds-pane__label", className)} {...rest}>
      <span>{children}</span>
      {hint ? <span className="ds-pane__label-hint">{hint}</span> : null}
    </span>
  );
}

export function EditorialInput({
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={cn("ds-input", className)} />;
}

export function EditorialTextarea({
  className,
  rows = 3,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...rest} rows={rows} className={cn("ds-textarea", className)} />;
}
