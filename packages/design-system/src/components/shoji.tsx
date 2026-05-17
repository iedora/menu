import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";

type ShojiProps = HTMLAttributes<HTMLDivElement> & {
  /** When `true`, applies the `--sent` modifier so the receipt is shown
   * over the form (form fades to 25% opacity). Host JS toggles this. */
  sent?: boolean;
  /** Form markup — typically a `<PaneGrid>` of `<Pane>`s. */
  form: ReactNode;
  /** Receipt overlay shown when sent. Use `<ShojiReceipt>` for the legacy look. */
  receipt: ReactNode;
};

/**
 * Editorial 3-pane contact form. Wraps the form + receipt in a single
 * `.ds-shoji` so the host can crossfade between them by toggling the
 * `--sent` class.
 */
export function Shoji({
  sent,
  form,
  receipt,
  className,
  ...rest
}: ShojiProps) {
  return (
    <div
      className={cn("ds-shoji", sent && "ds-shoji--sent", className)}
      {...rest}
    >
      <div className="ds-shoji__inner">{form}</div>
      <div className="ds-shoji__receipt" aria-live="polite">
        {receipt}
      </div>
    </div>
  );
}

type ReceiptProps = {
  seal?: ReactNode;
  title?: ReactNode;
  children?: ReactNode;
};

/**
 * Receipt overlay for the Shoji. The cinnabar "i" seal + a short, calm
 * confirmation. `aria-live="polite"` lives on the parent so SR users
 * hear the receipt the moment it shows.
 */
export function ShojiReceipt({
  seal = "i",
  title = "Received, gently.",
  children = (
    <>Your message is inside the house. We will read it when the morning is quiet, and answer in kind.</>
  ),
}: ReceiptProps) {
  return (
    <div className="ds-shoji__receipt-inner">
      <div className="ds-shoji__seal" aria-hidden="true">
        {seal}
      </div>
      <h4 className="ds-shoji__title">{title}</h4>
      <p className="ds-shoji__body">{children}</p>
    </div>
  );
}
