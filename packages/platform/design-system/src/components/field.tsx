import type {
  HTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "../lib/cn";

type FieldProps = HTMLAttributes<HTMLDivElement> & {
  /** Set true to swap the underline + hint to cinnabar. */
  error?: boolean;
  children: ReactNode;
};

type FieldLabelProps = LabelHTMLAttributes<HTMLLabelElement> & {
  children: ReactNode;
};

type FieldHintProps = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode;
};

type FieldInputProps = InputHTMLAttributes<HTMLInputElement> & {
  /** Render as a framed compact chip — sized to match `<Combobox>`. */
  compact?: boolean;
};
type FieldTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  /** Render as a framed compact chip — sized to match `<Combobox>`. */
  compact?: boolean;
};

/**
 * Iedora Manual § VI.4. A label, a bare input with an underline, and a hint.
 * Wrap an input + textarea + select. Use `error` to swap the underline to
 * cinnabar.
 *
 * Composition:
 *   <Field>
 *     <FieldLabel>Email</FieldLabel>
 *     <FieldInput name="email" type="email" />
 *     <FieldHint>We write back, slowly.</FieldHint>
 *   </Field>
 */
export function Field({ error, className, children, ...rest }: FieldProps) {
  return (
    <div
      {...rest}
      className={cn("ds-field", error && "ds-field--error", className)}
    >
      {children}
    </div>
  );
}

export function FieldLabel({ className, children, ...rest }: FieldLabelProps) {
  return (
    <label {...rest} className={cn("ds-field__label", className)}>
      {children}
    </label>
  );
}

export function FieldHint({ className, children, ...rest }: FieldHintProps) {
  return (
    <span {...rest} className={cn("ds-field__hint", className)}>
      {children}
    </span>
  );
}

/**
 * Underline-only input. Editorial serif body, cinnabar focus on its own
 * (use <Field error> to mark the surrounding state when needed).
 *
 * Carries `ds-input` so it renders correctly when used outside a <Field>
 * (e.g. inline in a dashboard cell). Inside a Field, `.ds-field input` also
 * matches — both rules share the same declarations.
 */
export function FieldInput({ className, compact, ...rest }: FieldInputProps) {
  return (
    <input
      {...rest}
      className={cn("ds-input", compact && "ds-input--compact", className)}
    />
  );
}

export function FieldTextarea({
  className,
  compact,
  ...rest
}: FieldTextareaProps) {
  return (
    <textarea
      {...rest}
      className={cn(
        "ds-textarea",
        compact && "ds-textarea--compact",
        className,
      )}
    />
  );
}
