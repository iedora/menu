import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";

type ButtonVariant = "default" | "solid" | "ghost" | "accent";

type CommonProps = {
  variant?: ButtonVariant;
  arrow?: boolean | ReactNode;
  children?: ReactNode;
  className?: string;
};

type AsButtonProps = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
    as?: "button";
    type?: "button" | "submit" | "reset";
    href?: never;
  };

type AsAnchorProps = CommonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
    as?: "a";
    href: string;
    type?: never;
  };

export type ButtonProps = AsButtonProps | AsAnchorProps;

function variantClass(variant: ButtonVariant | undefined) {
  switch (variant) {
    case "solid":
      return "ds-btn--solid";
    case "ghost":
      return "ds-btn--ghost";
    case "accent":
      return "ds-btn--accent";
    default:
      return "";
  }
}

function isAnchor(props: ButtonProps): props is AsAnchorProps {
  return (props as AsAnchorProps).href !== undefined;
}

/**
 * Iedora button. Mono uppercase label, ink border, square corners. Hover
 * inverts ink and paper. Optional cinnabar arrow on the right.
 *
 * Variants from Iedora Manual § VI.1:
 *   - default — outlined; hover fills with ink
 *   - solid   — ink fill, paper text; hover inverts
 *   - ghost   — borderless; hover draws an underline
 *   - accent  — cinnabar border + text; hover fills with cinnabar
 *
 * Renders as <a> when `href` is provided, otherwise <button>.
 */
export function Button(props: ButtonProps) {
  const variant = props.variant;
  const className = cn("ds-btn", variantClass(variant), props.className);

  const content = (
    <>
      <span>{props.children}</span>
      {props.arrow ? (
        <span className="ds-btn__arrow" aria-hidden="true">
          {props.arrow === true ? "↗" : props.arrow}
        </span>
      ) : null}
    </>
  );

  if (isAnchor(props)) {
    const { variant: _v, arrow: _a, children: _c, className: _cls, as: _as, ...rest } = props;
    return (
      <a {...rest} className={className}>
        {content}
      </a>
    );
  }

  const { variant: _v, arrow: _a, children: _c, className: _cls, as: _as, type, ...rest } = props;
  return (
    <button {...rest} type={type ?? "button"} className={className}>
      {content}
    </button>
  );
}
