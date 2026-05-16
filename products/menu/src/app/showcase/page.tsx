import Link from "next/link";
import {
  EditorialInput,
  EditorialTextarea,
  Lintel,
  MetaStrip,
  Pane,
  PaneGrid,
  PaneLabel,
  SendButton,
  Statement,
  Wordmark,
} from "@iedora/design-system";

const palette = [
  { name: "paper", token: "--ds-paper", hex: "#EFE8DA" },
  { name: "paper-2", token: "--ds-paper-2", hex: "#E7DFCF" },
  { name: "ink", token: "--ds-ink", hex: "#1A1815" },
  { name: "ink-70", token: "--ds-ink-70", hex: "70% ink" },
  { name: "ink-40", token: "--ds-ink-40", hex: "40% ink" },
  { name: "ink-22", token: "--ds-ink-22", hex: "22% ink" },
  { name: "ink-14", token: "--ds-ink-14", hex: "14% ink" },
  { name: "cinnabar", token: "--ds-cinnabar", hex: "#B83A26" },
];

export default function ShowcasePage() {
  return (
    <div className="ds-root ds-root--washed" style={{ minHeight: "100vh" }}>
      <div style={{ width: "min(1320px, 100%)", margin: "0 auto", padding: "36px 56px 96px", position: "relative", zIndex: 1 }}>
        <MetaStrip
          left={
            <>
              <span>MMXXVI</span>
              <span>Iedora · Design system</span>
            </>
          }
          center={<span>Showcase</span>}
          right={<Link href="/">Back to menu</Link>}
        />

        {/* ── Wordmark ─────────────────────────────────────────────── */}
        <Section index="01" name="Wordmark" note="Letter-by-letter Fraunces; the dot is cinnabar.">
          <div style={{ padding: "48px 0 24px" }}>
            <Wordmark variant="display" />
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 32, paddingBottom: 24, borderTop: "1px solid var(--ds-ink-14)", paddingTop: 24 }}>
            <Wordmark variant="inline" />
            <span style={{ fontFamily: "var(--ds-mono)", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--ds-ink-40)" }}>
              variant=&quot;inline&quot; — top-of-form bar
            </span>
          </div>
        </Section>

        {/* ── Statement ────────────────────────────────────────────── */}
        <Section index="02" name="Statement" note="Italic Fraunces tagline; wrap a word in <em> to upright it.">
          <div style={{ padding: "32px 0", maxWidth: 560 }}>
            <Statement>
              A quiet house for <em>digital craftsmanship</em>. A roof over independent <em>works</em>, made slowly, kept carefully.
            </Statement>
          </div>
        </Section>

        {/* ── Lintel + form ────────────────────────────────────────── */}
        <Section index="03" name="Lintel + Pane grid" note="Editorial form. No outer chrome — hairline rules carry the structure.">
          <div style={{ padding: "24px 0 8px" }}>
            <Lintel
              end={
                <span style={{ fontFamily: "var(--ds-mono)", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--ds-ink-55)" }}>
                  Contact
                </span>
              }
            />
            <form>
              <PaneGrid>
                <Pane>
                  <PaneLabel>Name</PaneLabel>
                  <EditorialInput type="text" name="name" placeholder="—" />
                </Pane>
                <Pane>
                  <PaneLabel hint={<>signed</>}>From</PaneLabel>
                  <EditorialInput type="email" name="email" placeholder="you@—" />
                </Pane>
                <Pane full>
                  <PaneLabel>Message</PaneLabel>
                  <EditorialTextarea name="message" rows={3} placeholder="Take your time. We read everything." />
                </Pane>
              </PaneGrid>
              <div style={{ display: "flex", justifyContent: "flex-end", padding: "14px 22px 0" }}>
                <SendButton type="button">Send</SendButton>
              </div>
            </form>
          </div>
        </Section>

        {/* ── Palette ──────────────────────────────────────────────── */}
        <Section index="04" name="Palette" note="Paper and ink, with one accent.">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 1, background: "var(--ds-ink-14)", border: "1px solid var(--ds-ink-14)", marginTop: 24 }}>
            {palette.map((c) => (
              <div key={c.name} style={{ background: "var(--ds-paper)", padding: 18 }}>
                <div
                  aria-hidden
                  style={{
                    height: 56,
                    background: `var(${c.token})`,
                    border: c.name.startsWith("ink-1") || c.name.startsWith("ink-2") || c.name === "ink-08"
                      ? "1px dashed var(--ds-ink-22)"
                      : "0",
                  }}
                />
                <div style={{ paddingTop: 12 }}>
                  <div style={{ fontFamily: "var(--ds-mono)", fontSize: 10, letterSpacing: "0.20em", textTransform: "uppercase", color: "var(--ds-ink-55)" }}>
                    {c.name}
                  </div>
                  <div style={{ fontFamily: "var(--ds-serif)", fontStyle: "italic", fontSize: 14, color: "var(--ds-ink-70)", marginTop: 2 }}>
                    {c.hex}
                  </div>
                  <div style={{ fontFamily: "var(--ds-mono)", fontSize: 10, color: "var(--ds-ink-40)", marginTop: 2 }}>
                    {c.token}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Typography ───────────────────────────────────────────── */}
        <Section index="05" name="Typography" note="Fraunces (variable, opsz 144 at display) + JetBrains Mono.">
          <div style={{ borderTop: "1px solid var(--ds-ink-14)", paddingTop: 32, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48 }}>
            <div>
              <div className="ds-key">Serif · display</div>
              <p style={{ fontFamily: "var(--ds-serif)", fontWeight: 300, fontVariationSettings: '"opsz" 144', fontSize: 64, lineHeight: 0.9, letterSpacing: "-0.025em", margin: "8px 0 0" }}>
                Made slowly,<br />kept carefully.
              </p>
            </div>
            <div>
              <div className="ds-key">Serif · italic</div>
              <p style={{ fontFamily: "var(--ds-serif)", fontStyle: "italic", fontWeight: 300, fontSize: 21, lineHeight: 1.4, color: "var(--ds-ink-70)", margin: "8px 0 0" }}>
                A quiet house for digital craftsmanship.
              </p>
              <div className="ds-key" style={{ marginTop: 32 }}>Mono · caps</div>
              <p style={{ fontFamily: "var(--ds-mono)", fontSize: 11, letterSpacing: "0.20em", textTransform: "uppercase", color: "var(--ds-ink-55)", margin: "8px 0 0" }}>
                MMXXVI · Oporto · Lisboa
              </p>
            </div>
          </div>
        </Section>

        {/* ── Send button states ───────────────────────────────────── */}
        <Section index="06" name="SendButton" note="Hover swaps to cinnabar; arrow nudges 3px.">
          <div style={{ display: "flex", gap: 24, padding: "32px 0", alignItems: "center" }}>
            <SendButton type="button">Send</SendButton>
            <SendButton type="button">Continue</SendButton>
            <SendButton type="button" disabled>Disabled</SendButton>
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({
  index,
  name,
  note,
  children,
}: {
  index: string;
  name: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ paddingTop: 64 }}>
      <header
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr auto",
          alignItems: "baseline",
          gap: 24,
          paddingBottom: 14,
          borderBottom: "1px solid var(--ds-ink-22)",
        }}
      >
        <span
          style={{
            fontFamily: "var(--ds-mono)",
            fontSize: 11,
            letterSpacing: "0.20em",
            color: "var(--ds-ink-40)",
          }}
        >
          {index}
        </span>
        <h2
          style={{
            margin: 0,
            fontFamily: "var(--ds-serif)",
            fontWeight: 300,
            fontVariationSettings: '"opsz" 144',
            fontSize: 36,
            letterSpacing: "-0.02em",
            color: "var(--ds-ink)",
          }}
        >
          {name}
        </h2>
        {note ? (
          <span
            style={{
              fontFamily: "var(--ds-serif)",
              fontStyle: "italic",
              fontSize: 13,
              color: "var(--ds-ink-55)",
              maxWidth: 360,
              textAlign: "right",
            }}
          >
            {note}
          </span>
        ) : (
          <span aria-hidden />
        )}
      </header>
      {children}
    </section>
  );
}
