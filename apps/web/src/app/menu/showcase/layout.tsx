import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Design system — showcase",
  description: "Iedora design system primitives, in situ.",
};

/**
 * Showcase renders against the root-level fonts loaded once in
 * `apps/web/src/app/layout.tsx` (Playfair Display + Lora + Geist +
 * Geist Mono). No local font import — single glyph cache across every
 * route + matches what the rest of the app paints.
 */
export default function ShowcaseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
