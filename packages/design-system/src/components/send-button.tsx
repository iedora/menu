import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";

type SendButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children?: ReactNode;
};

export function SendButton({
  children = "Send",
  className,
  type = "submit",
  ...rest
}: SendButtonProps) {
  return (
    <button type={type} className={cn("ds-send-btn", className)} {...rest}>
      <span>{children}</span>
      <span className="ds-send-btn__arrow" aria-hidden="true">→</span>
    </button>
  );
}
