---
name: add-template
description: Use when adding a new menu template (visual layout) to the public menu page. Encodes the open/closed registry pattern — a new template is a self-contained folder under components/menu/templates/, registered once. The renderer, the theme editor, and the public page require zero changes.
---

# add-template

Hard rule #8 from `AGENTS.md`: menu templates are open/closed. The renderer (`components/menu/menu-renderer.tsx`) consumes only the registry — never edit it to add a template.

## Steps

1. **Create the template module** at `components/menu/templates/<id>/` with three files:
   - `<id>-menu.tsx` — the React component, typed as `(props: RenderProps) => JSX.Element`. Style with Tailwind; consume theme via the CSS variables `--menu-primary` and `--menu-secondary` (already injected by `MenuRenderer`). Import `RenderProps` from `../../types` and `formatPrice` from `../../format`.
   - `meta.ts` — `export const meta: TemplateMeta = { id: '<id>', name: '<Display name>', description: '<one-liner>' }`.
   - `index.ts` — `export const template: MenuTemplate = { ...meta, Component: <YourMenu> }`.

2. **Register it** in `components/menu/templates/registry.ts`:
   ```ts
   import { template as foo } from './foo'
   const REGISTRY: Record<TemplateId, MenuTemplate> = { classic, minimal, foo }
   ```

3. **Extend the schema literal** in `lib/db/schema.ts`:
   ```ts
   layout?: 'classic' | 'minimal' | 'foo'
   ```
   This is a TypeScript-only change — `theme` is a `jsonb` column, no migration needed.

4. **Run** `bun run typecheck`. The compiler enforces that `REGISTRY` covers every `TemplateId` literal — a missing entry is a build error.

5. **Add an E2E** under `tests/e2e/specs/settings/` or `public-menu/` exercising the template — at least: pick it in the theme editor, save, render `/r/<slug>`, verify a layout-distinguishing class or attribute.

## What you should NOT need to touch

- `components/menu/menu-renderer.tsx` — uses `getTemplate(theme.layout)`, picks up new entries automatically.
- `lib/menu-themes.ts` — `LAYOUTS` is derived from `TEMPLATE_META`; no edits.
- `app/dashboard/r/[slug]/theme/theme-editor.tsx` — iterates `LAYOUTS` for the picker, no edits.
- `app/r/[slug]/page.tsx` — renders via `MenuRenderer`, no edits.

If you find yourself editing any of those, you're working against the registry — stop and put the new behavior inside the template module instead.

## Style guidance

Templates are pure presentational. They consume `RenderProps` (restaurant + menus + theme) and produce JSX. They should NOT:
- Import from `lib/dal.ts` or `lib/db/` — they don't fetch data.
- Have client-side state — they're rendered server-side and inside the dashboard live preview.
- Hardcode colors — always go through `var(--menu-primary)` / `var(--menu-secondary)`.

A template can grow with sub-components, helpers, and CSS modules inside its own folder — that's why the folder exists.
