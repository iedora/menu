import type { Metadata } from "next"

export const metadata: Metadata = { title: "Tutor" }

// Placeholder landing for the tutor surface — proves host→surface routing
// (tutor.iedora.com → /tutor) and the tutor design tokens end-to-end. Replaced
// by the migrated tutor marketing/app pages in the next Phase-2 step.
export default function TutorSurfaceIndex() {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
      <span className="rounded-full bg-primary/10 px-3 py-1 font-mono text-xs uppercase tracking-wider text-primary">
        tutor surface
      </span>
      <h1 className="text-3xl font-semibold tracking-tight">Tutor is moving in</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Routing + the shared design system are wired. The tutor app folds into this surface next.
      </p>
    </main>
  )
}
