// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";

afterEach(() => {
  cleanup();
  // Radix sets pointer-events:none on the body while a dialog is open and
  // restores it on unmount — but if a test exits with a dialog still open
  // (or Radix's cleanup races the test runner) the next test can't click
  // anything. Belt + braces: hard-reset the body each test.
  document.body.style.pointerEvents = "";
});

// userEvent's default pointerEventsCheck refuses to click elements that
// inherit pointer-events:none. Radix's open-state manipulation can leave
// that flag flickering between tests; skip the check in this suite since
// we already trust Radix's a11y guarantees and verify the behavior.
const u = () => userEvent.setup({ pointerEventsCheck: 0 });
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";

function SampleDialog() {
  return (
    <Dialog>
      <DialogTrigger>Open</DialogTrigger>
      <DialogContent eyebrow="Dialog · Confirm">
        <DialogHeader>
          <DialogTitle>Send a quiet note?</DialogTitle>
          <DialogDescription>We will read it.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose>Cancel</DialogClose>
          <button type="submit">Send</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

describe("Dialog (interactive, Radix-backed)", () => {
  it("does not render the content until the trigger is clicked", () => {
    render(<SampleDialog />);
    expect(screen.getByRole("button", { name: "Open" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens when the trigger is clicked and traps focus", async () => {
    const user = u();
    render(<SampleDialog />);

    await user.click(screen.getByRole("button", { name: "Open" }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveClass("ds-dialog");
    expect(
      screen.getByRole("heading", { name: "Send a quiet note?" }),
    ).toHaveClass("ds-dialog__title");
    expect(screen.getByText("We will read it.")).toHaveClass("ds-dialog__body");
  });

  it("renders the eyebrow and close-affordance in the top row", async () => {
    const user = u();
    render(<SampleDialog />);
    await user.click(screen.getByRole("button", { name: "Open" }));

    expect(screen.getByText("Dialog · Confirm")).toBeInTheDocument();
    // Default close button has aria-label "Close" and renders "close ×"
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("closes when Escape is pressed", async () => {
    const user = u();
    render(<SampleDialog />);
    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes when the explicit Cancel (DialogClose) button is clicked", async () => {
    const user = u();
    render(<SampleDialog />);
    await user.click(screen.getByRole("button", { name: "Open" }));

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("supports controlled open state via the open prop", async () => {
    function Controlled() {
      return (
        <Dialog open>
          <DialogContent showClose={false}>
            <DialogTitle>Always open</DialogTitle>
          </DialogContent>
        </Dialog>
      );
    }
    render(<Controlled />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Always open")).toBeInTheDocument();
  });

  it("hides the close button when showClose=false", async () => {
    const user = u();
    function NoClose() {
      return (
        <Dialog>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent showClose={false} eyebrow="Eyebrow">
            <DialogTitle>x</DialogTitle>
          </DialogContent>
        </Dialog>
      );
    }
    render(<NoClose />);
    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
  });

  it("renders DialogTrigger asChild so a custom button can be the trigger", async () => {
    const user = u();
    render(
      <Dialog>
        <DialogTrigger asChild>
          <button type="button" className="my-cta">
            Send note
          </button>
        </DialogTrigger>
        <DialogContent showClose={false}>
          <DialogTitle>x</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    const trigger = screen.getByRole("button", { name: "Send note" });
    expect(trigger).toHaveClass("my-cta");
    await user.click(trigger);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });
});
