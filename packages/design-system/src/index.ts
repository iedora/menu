// Iedora Manual — primitives kit.
//
// Component groups are in the order the Manual lists them:
//   §VI.1  Button
//   §VI.2  Badge
//   §VI.3  Card
//   §VI.4  Field · Checkbox · Toggle
//   §VI.5  Table
//   §VI.6  Dialog
//   §VI.7  Toast
//   §VI.8  EmptyState
//   §VI.9  Tabs · Breadcrumb
// Editorial chrome (Wordmark, MetaStrip, Statement, Lintel) sits outside §VI
// but speaks the same vocabulary and ships from this package.

export { Wordmark } from "./components/wordmark";
export { KeyMark } from "./components/key-mark";
export { MetaStrip } from "./components/meta-strip";
export { Statement } from "./components/statement";
export { Lintel } from "./components/lintel";

// Editorial / motion primitives (used by the iedora.com landing page;
// reusable in genkan / menu for any scroll-pinned editorial layout).
export { PageProgress } from "./components/page-progress";
export { ScrollHint } from "./components/scroll-hint";
export {
  ScrollPinned,
  ScrollPinnedHead,
  ScrollPinnedStage,
  ScrollPinnedFoot,
} from "./components/scroll-pinned";
export { Phrases, Phrase } from "./components/phrases";
export { HouseSvg } from "./components/house-svg";
export { Timeline, type TimelineMark } from "./components/timeline";
export { Wave } from "./components/wave";
export { RoomsGrid, type RoomCell } from "./components/rooms-grid";
export { Shoji, ShojiReceipt } from "./components/shoji";
export { VisuallyHidden } from "./components/visually-hidden";
export { Separator } from "./components/separator";

export { Button, type ButtonProps } from "./components/button";
export { Badge } from "./components/badge";
export {
  Card,
  CardIndex,
  CardVisual,
  CardTitle,
  CardDesc,
  CardFoot,
} from "./components/card";
export {
  Field,
  FieldLabel,
  FieldHint,
  FieldInput,
  FieldTextarea,
} from "./components/field";
export { Checkbox, Toggle } from "./components/check-toggle";
export { Table, Th, Td, TableRowNum } from "./components/table";
export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogPortal,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader,
  DialogFooter,
  DialogBody,
  DialogActions,
} from "./components/dialog";
export { Toast, ToastStack } from "./components/toast";
export { EmptyState } from "./components/empty-state";
export { Tabs, Tab } from "./components/tabs";
export {
  Breadcrumb,
  BreadcrumbLink,
  BreadcrumbHere,
} from "./components/breadcrumb";

// Editorial form grid — kept for layouts that want a hairline-bordered
// two-column field grid. New auth-style forms should reach for <Field>.
export {
  Pane,
  PaneGrid,
  PaneLabel,
  EditorialInput,
  EditorialTextarea,
} from "./components/pane";

/** @deprecated Use <Button variant="accent" arrow>. */
export { SendButton } from "./components/send-button";
