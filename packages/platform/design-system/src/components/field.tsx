import {
  useId,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type LabelHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
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

type FieldErrorProps = HTMLAttributes<HTMLParagraphElement> & {
  children: ReactNode;
};

type FieldInputProps = InputHTMLAttributes<HTMLInputElement> & {
  /** Render as a framed compact chip — sized to match `<Combobox>`. */
  compact?: boolean;
  /** Mark the control invalid: cinnabar underline + `aria-invalid`. */
  error?: boolean;
};
type FieldTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  /** Render as a framed compact chip — sized to match `<Combobox>`. */
  compact?: boolean;
  /** Mark the control invalid: cinnabar underline + `aria-invalid`. */
  error?: boolean;
};
type FieldSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  /** Render as a framed compact chip — sized to match `<Combobox>`. */
  compact?: boolean;
  /** Mark the control invalid: cinnabar underline + `aria-invalid`. */
  error?: boolean;
  children: ReactNode;
};

/**
 * Iedora Manual § VI.4. A label, a bare input with an underline, and a hint.
 * Wrap an input + textarea + select. Use `error` to swap the underline to
 * cinnabar.
 *
 * Two ways to use this kit:
 *
 *   1. Low-level composition (full control over the markup):
 *        <Field error={!!err}>
 *          <FieldLabel htmlFor="email">Email</FieldLabel>
 *          <FieldInput id="email" name="email" error={!!err}
 *            aria-describedby={err ? "email-err" : undefined} />
 *          <FieldError id="email-err">{err}</FieldError>
 *        </Field>
 *
 *   2. Composed wrappers ({@link TextField} / {@link TextareaField} /
 *      {@link SelectField}) — label + control + message in one element with
 *      the `id` / `aria-invalid` / `aria-describedby` wiring done for you.
 *      Reach for these by default; drop to the primitives only when a layout
 *      needs to interleave other nodes.
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
 * Validation message under a control. Carries `role="alert"` so a screen
 * reader announces it the moment it appears, and `data-test-id="field-error"`
 * so tests can assert on it without coupling to copy. Pair its `id` with the
 * control's `aria-describedby`.
 */
export function FieldError({ className, children, ...rest }: FieldErrorProps) {
  return (
    <p
      {...rest}
      role="alert"
      data-test-id="field-error"
      className={cn("ds-field__error", className)}
    >
      {children}
    </p>
  );
}

/**
 * Underline-only input. Editorial serif body, cinnabar focus on its own. Pass
 * `error` to stamp the invalid underline and set `aria-invalid` — the screen
 * reader then ties it to the `<FieldError>` you point at with
 * `aria-describedby`.
 *
 * Carries `ds-input` so it renders correctly when used outside a <Field>
 * (e.g. inline in a dashboard cell). Inside a Field, `.ds-field input` also
 * matches — both rules share the same declarations.
 */
export function FieldInput({
  className,
  compact,
  error,
  ...rest
}: FieldInputProps) {
  return (
    <input
      {...rest}
      aria-invalid={error || rest["aria-invalid"]}
      className={cn(
        "ds-input",
        compact && "ds-input--compact",
        error && "ds-input--error",
        className,
      )}
    />
  );
}

export function FieldTextarea({
  className,
  compact,
  error,
  ...rest
}: FieldTextareaProps) {
  return (
    <textarea
      {...rest}
      aria-invalid={error || rest["aria-invalid"]}
      className={cn(
        "ds-textarea",
        compact && "ds-textarea--compact",
        error && "ds-textarea--error",
        className,
      )}
    />
  );
}

/**
 * Same underline / framed-chip vocabulary as `FieldInput` for a native
 * `<select>`. Explicit `background-color` / `color` on the host so
 * Windows dark mode doesn't fall back to white-on-white. The
 * `dropdown-arrow` glyph is painted via CSS background — no extra DOM.
 */
export function FieldSelect({
  className,
  compact,
  error,
  children,
  ...rest
}: FieldSelectProps) {
  return (
    <select
      {...rest}
      aria-invalid={error || rest["aria-invalid"]}
      className={cn(
        "ds-select",
        compact && "ds-select--compact",
        error && "ds-select--error",
        className,
      )}
    >
      {children}
    </select>
  );
}

// ── Composed, fully-wired fields ────────────────────────────────────────────
// Label + control + message in one element. They own the `id` (via `useId`,
// SSR-safe), set `aria-invalid` when `error` is present, and point the
// control's `aria-describedby` at whichever message is showing (error wins
// over hint). Use these by default — the wiring that keeps a control and its
// validation message associated for assistive tech lives in exactly one place.

type ComposedBase = {
  label: ReactNode;
  /** Validation message. When set, the control reads as invalid. */
  error?: string;
  /** Advisory helper text shown when there is no error. */
  hint?: ReactNode;
};

/**
 * Resolves the field id (caller-supplied → `name` → generated) and the
 * message id, and returns the props every composed field shares.
 */
function useFieldWiring(
  id: string | undefined,
  name: string | undefined,
  error?: string,
  hint?: ReactNode,
) {
  const auto = useId();
  const fieldId = id ?? name ?? auto;
  const msgId = `${fieldId}-msg`;
  const describedBy = error || hint ? msgId : undefined;
  return { fieldId, msgId, describedBy, invalid: error ? true : undefined };
}

type TextFieldProps = ComposedBase &
  Omit<FieldInputProps, "error"> & { id?: string };

export function TextField({
  label,
  error,
  hint,
  id,
  className,
  compact,
  ...rest
}: TextFieldProps) {
  const { fieldId, msgId, describedBy, invalid } = useFieldWiring(
    id,
    rest.name,
    error,
    hint,
  );
  return (
    <Field error={!!error} className={className}>
      <FieldLabel htmlFor={fieldId}>{label}</FieldLabel>
      {/* `{...rest}` FIRST so the wired a11y props below always win — a
          caller can't accidentally clobber the error association. */}
      <FieldInput
        {...rest}
        id={fieldId}
        compact={compact}
        error={!!error}
        aria-invalid={invalid}
        aria-describedby={describedBy}
      />
      {error ? (
        <FieldError id={msgId}>{error}</FieldError>
      ) : hint ? (
        <FieldHint id={msgId}>{hint}</FieldHint>
      ) : null}
    </Field>
  );
}

type TextareaFieldProps = ComposedBase &
  Omit<FieldTextareaProps, "error"> & { id?: string };

export function TextareaField({
  label,
  error,
  hint,
  id,
  className,
  compact,
  ...rest
}: TextareaFieldProps) {
  const { fieldId, msgId, describedBy, invalid } = useFieldWiring(
    id,
    rest.name,
    error,
    hint,
  );
  return (
    <Field error={!!error} className={className}>
      <FieldLabel htmlFor={fieldId}>{label}</FieldLabel>
      <FieldTextarea
        {...rest}
        id={fieldId}
        compact={compact}
        error={!!error}
        aria-invalid={invalid}
        aria-describedby={describedBy}
      />
      {error ? (
        <FieldError id={msgId}>{error}</FieldError>
      ) : hint ? (
        <FieldHint id={msgId}>{hint}</FieldHint>
      ) : null}
    </Field>
  );
}

type SelectFieldProps = ComposedBase &
  Omit<FieldSelectProps, "error"> & { id?: string };

export function SelectField({
  label,
  error,
  hint,
  id,
  className,
  compact,
  children,
  ...rest
}: SelectFieldProps) {
  const { fieldId, msgId, describedBy, invalid } = useFieldWiring(
    id,
    rest.name,
    error,
    hint,
  );
  return (
    <Field error={!!error} className={className}>
      <FieldLabel htmlFor={fieldId}>{label}</FieldLabel>
      <FieldSelect
        {...rest}
        id={fieldId}
        compact={compact}
        error={!!error}
        aria-invalid={invalid}
        aria-describedby={describedBy}
      >
        {children}
      </FieldSelect>
      {error ? (
        <FieldError id={msgId}>{error}</FieldError>
      ) : hint ? (
        <FieldHint id={msgId}>{hint}</FieldHint>
      ) : null}
    </Field>
  );
}
