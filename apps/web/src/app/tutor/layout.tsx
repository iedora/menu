// The tutor surface. Marks the subtree for per-surface theming (inherits the
// shared tutor base today; override under `[data-surface="tutor"]` in globals.css
// to diverge later). `display:contents` adds no box — custom props still inherit.
//
// Phase 2 of the consolidation fills app/tutor/* with the migrated tutor pages
// (chat, book, lessons, settings, t/[slug], vantage, …) and reconciles auth.
export default function TutorSurfaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-surface="tutor" className="contents">
      {children}
    </div>
  )
}
