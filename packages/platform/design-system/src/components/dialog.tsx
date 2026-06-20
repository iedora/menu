"use client";

import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { Dialog as RadixDialog } from "radix-ui";
import { cn } from "../lib/cn";

/**
 * Iedora Manual § VI.6 — Modal dialog.
 *
 * Radix-backed compositional API. Renders into a portal, traps focus, restores
 * focus on close, dismisses on overlay click / Escape. Animation is CSS-only:
 * `data-state="open|closed"` drives the fade.
 *
 *   <Dialog>
 *     <DialogTrigger asChild>
 *       <Button>Open</Button>
 *     </DialogTrigger>
 *     <DialogContent>
 *       <DialogHeader>
 *         <DialogTitle>Confirm</DialogTitle>
 *         <DialogDescription>This action cannot be undone.</DialogDescription>
 *       </DialogHeader>
 *       <DialogFooter>
 *         <DialogClose asChild>
 *           <Button variant="ghost">Cancel</Button>
 *         </DialogClose>
 *         <Button variant="solid" arrow>Send</Button>
 *       </DialogFooter>
 *     </DialogContent>
 *   </Dialog>
 *
 * `asChild` (Radix idiom) lets you pass any Button / Link / custom element
 * as the trigger or close target — Radix merges its props onto your child.
 */

export const Dialog = RadixDialog.Root;
export const DialogTrigger = RadixDialog.Trigger;
export const DialogClose = RadixDialog.Close;
export const DialogPortal = RadixDialog.Portal;

type ContentProps = ComponentPropsWithoutRef<typeof RadixDialog.Content> & {
  /** Mono uppercase eyebrow above the title (e.g. "Dialog · Confirm"). */
  eyebrow?: ReactNode;
  /** Render a close button in the top-right. Default true. */
  showClose?: boolean;
  /** Override the close button label. Default "Close ×". */
  closeLabel?: ReactNode;
  /**
   * Mobile presentation. `"sheet"` (default) makes the dialog fill the
   * viewport from the bottom on phones (full-screen bottom-sheet) and
   * collapses back to the centered modal on `sm+`. `"modal"` keeps the
   * centered modal at every size — only for tiny confirms; anything
   * with a form field belongs in a sheet.
   */
  mobile?: "sheet" | "modal";
  /** Wide content (preview trees, tables): widen the desktop max-w. */
  size?: "md" | "lg" | "xl";
};

export function DialogContent({
  eyebrow,
  showClose = true,
  closeLabel = "close ×",
  mobile = "sheet",
  size = "md",
  className,
  children,
  ...rest
}: ContentProps) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="ds-dialog__scrim" />
      <RadixDialog.Content
        {...rest}
        className={cn(
          "ds-dialog",
          mobile === "sheet" && "ds-dialog--sheet",
          size === "lg" && "ds-dialog--lg",
          size === "xl" && "ds-dialog--xl",
          className,
        )}
      >
        {eyebrow || showClose ? (
          <div className="ds-dialog__top">
            <span>{eyebrow}</span>
            {showClose ? (
              <RadixDialog.Close className="ds-dialog__close" aria-label="Close">
                {closeLabel}
              </RadixDialog.Close>
            ) : null}
          </div>
        ) : null}
        {children}
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}

type DialogTitleProps = ComponentPropsWithoutRef<typeof RadixDialog.Title>;
export function DialogTitle({ className, ...rest }: DialogTitleProps) {
  return (
    <RadixDialog.Title
      {...rest}
      className={cn("ds-dialog__title", className)}
    />
  );
}

type DialogDescriptionProps = ComponentPropsWithoutRef<
  typeof RadixDialog.Description
>;
export function DialogDescription({
  className,
  ...rest
}: DialogDescriptionProps) {
  return (
    <RadixDialog.Description
      {...rest}
      className={cn("ds-dialog__body", className)}
    />
  );
}

type DivProps = ComponentPropsWithoutRef<"div">;

/** Title + description block. CSS-only wrapper; supplies spacing. */
export function DialogHeader({ className, ...rest }: DivProps) {
  return <div {...rest} className={cn("ds-dialog__header", className)} />;
}

/** Right-aligned action row. */
export function DialogFooter({ className, ...rest }: DivProps) {
  return <div {...rest} className={cn("ds-dialog__actions", className)} />;
}

/* Backwards-compatible alias for the previous static API.
 * `DialogBody` is the same as the new `DialogDescription`. */
export const DialogBody = DialogDescription;
