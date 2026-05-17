# Component reference

Every primitive exported from `@iedora/design-system`. Grouped by editorial chrome (the iedora "voice") and the Manual § VI primitives (the operational vocabulary).

All imports come from the same barrel:
```ts
import { Button, Field, Dialog, ... } from "@iedora/design-system";
```

---

## Editorial chrome

### `Wordmark`
The "iedora." letterform. Each glyph + cinnabar dot is its own span so consumers can stagger a letter-by-letter reveal.
```tsx
<Wordmark className="ds-wordmark--reveal" />         // animation on
<Wordmark word="menu" variant="inline" className="ds-wordmark--reveal" />
```
Props: `word?` (default `"iedora"`), `variant?: "display" | "inline"`, `className?`, `ariaLabel?`.

### `MetaStrip`
Three-column mono-uppercase row with a hairline rule underneath. The signature top-of-page chrome.
```tsx
<MetaStrip left={<><span>MMXXVI</span><span>Studio</span></>}
           right={<a href="#contact">Contact</a>} />
```

### `Statement`
Italic Fraunces tagline. Wrap a word in `<em>` to upright-it (the iedora emphasis idiom).
```tsx
<Statement>A quiet house for <em>digital craftsmanship</em>.</Statement>
```

### `Lintel`
A top bar for forms — inline wordmark on the left, hairline rule, optional slot on the right.

### `PageProgress`
Fixed cinnabar rail across the top, width driven by `--ds-pageprog-progress` (0..1). Host writes the var from a scroll listener.

### `ScreenLabel`
The "01 IEDORA STUDIO" corner mark that fades in after the first viewport-height of scroll. Toggle `.ds-screen-label--on`.

### `ScrollHint`
Bottom-center "scroll to enter" nub. Hide after first scroll.

### `ScrollPinned` + `ScrollPinnedHead/Stage/Foot`
Full-viewport sticky-pin pattern with a `--p` CSS variable representing 0..1 scroll progress through the section. Used by house's Mission / Slowly / Quietly / Together rooms.

### `Phrases` + `Phrase`
Crossfading phrase stack keyed off `--p` from the enclosing `ScrollPinned`. Five phrases per stack.

### `HouseSvg`
Drawn-line house with `data-len/start/end` segments. Stroke reveal keyed to scroll.

### `Timeline` + `TimelineMark`
Growing horizontal line + named marks. The Begin / Build / Tend / Refine / Keep pattern.

### `Wave`
96-bar deterministic SSR-stable sine-wave SVG. No `Math.random` — same render server + client.

### `RoomsGrid` + `RoomCell`
7-cell roof + 6 rooms layout. Cinnabar fills the lit rooms.

### `Shoji` + `ShojiReceipt`
The slide-open editorial contact form (sound: shoji = a Japanese sliding paper door). Crossfades to a receipt on submit, `aria-live="polite"`.

### `VisuallyHidden`
SR-only text helper. Polymorphic via `as`.
```tsx
<VisuallyHidden as="span">Close menu</VisuallyHidden>
```

---

## Manual § VI primitives

### `Button`
Mono uppercase label, ink border, square corners. Hover inverts ink and paper.
```tsx
<Button variant="solid" arrow>Send</Button>
<Button variant="ghost">Cancel</Button>
<Button variant="accent" arrow>Destination</Button>
<Button href="/works">Read the rooms</Button>   // renders as <a>
```
Props: `variant?: "default" | "solid" | "ghost" | "accent"`, `arrow?: boolean | ReactNode`, `href?` (switches to `<a>`), all `<button>` / `<a>` HTML attributes.
- `default` — outlined; hover fills with ink (the workhorse).
- `solid` — ink fill, paper text.
- `ghost` — borderless; hover underlines.
- `accent` — cinnabar border + text; hover fills with cinnabar.

### `Badge`
Mono uppercase pill — paper or cinnabar.

### `Card` family
```tsx
<Card>
  <CardIndex>01</CardIndex>           {/* optional mono number */}
  <CardVisual>{/* image / svg */}</CardVisual>
  <CardTitle>Title</CardTitle>
  <CardDesc>Short description.</CardDesc>
  <CardFoot><Button>Open</Button></CardFoot>
</Card>
```
No `CardHeader` / `CardContent` wrappers — children sit directly inside `Card`.

### `Field` family
The form pattern. No boxes — labelled inputs with cinnabar focus underline.
```tsx
<Field error={Boolean(error)}>
  <FieldLabel htmlFor="email">Email</FieldLabel>
  <FieldInput id="email" type="email" name="email" />
  <FieldHint>The address you signed up with.</FieldHint>
</Field>
```
`FieldInput` and `FieldTextarea` work standalone too (carry `ds-input` / `ds-textarea` classes).

### `Checkbox` · `Toggle`
Square ink checkbox; sliding mono toggle.

### `Table` family
```tsx
<Table>
  <thead><tr><Th>Item</Th><Th>Qty</Th></tr></thead>
  <tbody>
    <tr><Td><TableRowNum>01</TableRowNum></Td><Td>3</Td></tr>
  </tbody>
</Table>
```
Hairline rules between rows, mono headers, tabular-nums in figures.

### `Dialog` family (Radix-backed)
Focus trap, Escape dismiss, portal, `data-state` animations.
```tsx
<Dialog>
  <DialogTrigger asChild>
    <Button variant="solid">Open</Button>
  </DialogTrigger>
  <DialogContent eyebrow="Dialog · Confirm">
    <DialogHeader>
      <DialogTitle>Send a quiet note?</DialogTitle>
      <DialogDescription>We will read it carefully.</DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
      <Button variant="solid" arrow>Send</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```
Props on `DialogContent`: `eyebrow?: ReactNode`, `showClose?: boolean` (default true), `closeLabel?: ReactNode` (default `"close ×"`), plus everything Radix accepts.
Aliases for the previous static API: `DialogBody === DialogDescription`, `DialogActions === DialogFooter` (kept one release, prefer the new names).

### `Toast` + `ToastStack`
```tsx
<ToastStack>
  <Toast variant="ok" title="Saved">The work was kept.</Toast>
  <Toast variant="warn" title="Stop">This room is being tended.</Toast>
</ToastStack>
```

### `EmptyState`
A blank-screen primitive — Fraunces title, italic body, single action.

### `Tabs` + `Tab`
Mono uppercase tab labels with a cinnabar underline on the active one.

### `Breadcrumb` + `BreadcrumbLink` + `BreadcrumbHere`
Mono caps trail. `BreadcrumbHere` is the non-link current step.

### `Separator` (Radix-backed)
Semantic horizontal/vertical hairline.
```tsx
<Separator />                          // 1px ink-14 horizontal
<Separator orientation="vertical" />   // for inline groups
<Separator decorative={false} />       // role="separator" instead of role="none"
```

---

## Editorial forms (legacy / hairline-grid)

Kept for layouts that pre-date `<Field>`. New auth-style forms should use `Field` + `FieldInput`. Use these only when you want the two-column hairline-bordered grid feel (the house contact form).

### `Pane` · `PaneGrid` · `PaneLabel` · `EditorialInput` · `EditorialTextarea`
```tsx
<PaneGrid>
  <Pane>
    <PaneLabel>Name</PaneLabel>
    <EditorialInput name="name" />
  </Pane>
  <Pane>
    <PaneLabel>From</PaneLabel>
    <EditorialInput name="from" type="email" />
  </Pane>
</PaneGrid>
```

### `SendButton` *(deprecated)*
Use `<Button variant="accent" arrow>` instead. Kept as a one-release alias.

---

## See it live

The menu app's `/showcase` route renders every primitive in this list against the real Next.js runtime. Open it during development to verify styling changes propagate correctly.
