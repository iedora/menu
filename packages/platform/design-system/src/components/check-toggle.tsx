import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "../lib/cn";

type CheckboxProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "checked"
> & {
  /** Controlled checked state. Renders the filled box when true. */
  checked?: boolean;
  children: ReactNode;
  className?: string;
  /** Validation message. When set, the box reads cinnabar + `aria-invalid`. */
  error?: string;
};

/**
 * Iedora Manual § VI.4 — checkbox.
 * 16px box, ink fills when on, serif label.
 *
 * The actual <input type="checkbox"> is visually hidden but kept in the DOM
 * for accessibility + form submission. Toggle the `checked` prop from the
 * parent. Pass `error` to surface a validation message (e.g. "Accept the
 * terms to continue") — it renders with `role="alert"` and is tied to the
 * input via `aria-describedby` / `aria-invalid`.
 */
export function Checkbox({
  checked = false,
  children,
  className,
  error,
  ...rest
}: CheckboxProps) {
  const auto = useId();
  const msgId = `${rest.id ?? rest.name ?? auto}-msg`;
  const control = (
    <label
      className={cn(
        "ds-check",
        checked && "ds-check--on",
        error && "ds-check--error",
        // When there's no wrapper, the label carries the caller's className.
        !error && className,
      )}
    >
      <span className="ds-check__box" aria-hidden="true">
        <span className="ds-check__tick" />
      </span>
      <input
        {...rest}
        type="checkbox"
        checked={checked}
        aria-invalid={error ? true : rest["aria-invalid"]}
        aria-describedby={error ? msgId : rest["aria-describedby"]}
        className="ds-check__input"
      />
      <span>{children}</span>
    </label>
  );
  // The bare <label> is the common case — only grow a wrapper + message node
  // when there's actually an error to announce.
  if (!error) return control;
  return (
    <span className={cn("ds-check-field", className)}>
      {control}
      <p id={msgId} role="alert" data-test-id="field-error" className="ds-field__error">
        {error}
      </p>
    </span>
  );
}

type ToggleProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "checked"
> & {
  checked?: boolean;
  children: ReactNode;
  className?: string;
  /** Validation message. When set, the track reads cinnabar + `aria-invalid`. */
  error?: string;
};

/**
 * Iedora Manual § VI.4 — toggle.
 * 36×18 track, 12px knob. Ink fills when on; the knob inverts paper.
 */
export function Toggle({
  checked = false,
  children,
  className,
  error,
  ...rest
}: ToggleProps) {
  const auto = useId();
  const msgId = `${rest.id ?? rest.name ?? auto}-msg`;
  const control = (
    <label
      className={cn(
        "ds-toggle",
        checked && "ds-toggle--on",
        error && "ds-toggle--error",
        !error && className,
      )}
    >
      <span className="ds-toggle__track" aria-hidden="true">
        <span className="ds-toggle__knob" />
      </span>
      <input
        {...rest}
        type="checkbox"
        role="switch"
        checked={checked}
        aria-invalid={error ? true : rest["aria-invalid"]}
        aria-describedby={error ? msgId : rest["aria-describedby"]}
        className="ds-toggle__input"
      />
      <span>{children}</span>
    </label>
  );
  if (!error) return control;
  return (
    <span className={cn("ds-toggle-field", className)}>
      {control}
      <p id={msgId} role="alert" data-test-id="field-error" className="ds-field__error">
        {error}
      </p>
    </span>
  );
}
