import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  BarChart3,
  Check,
  ConciergeBell,
  ImageIcon,
  Languages,
  Pencil,
  Play,
  QrCode,
  Star,
} from "lucide-react";
import { Button } from "@iedora/design-system";
import { signInUrl, signUpUrl } from "@iedora/product-menu/shared/auth-urls";
import { LangSwitch } from "./lang-switch";

/**
 * iedora menu marketing landing — a faithful build of the Pencil landing
 * (`iedora.pen` → component `dZ0S8`). Source of truth is Pencil; this file
 * mirrors it section for section. Copy comes from the `Landing` i18n
 * namespace (EN + PT); the EN/PT switch sets the NEXT_LOCALE cookie.
 */

const SIGN_IN_HREF = signInUrl();
const SIGN_UP_HREF = signUpUrl();

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1695094411862-0e047fbddcb1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NDM0ODN8MHwxfHJhbmRvbXx8fHx8fHx8fDE3ODE4MjMzNzF8&ixlib=rb-4.1.0&q=80&w=1080";
const SHOWCASE_IMAGE =
  "https://images.unsplash.com/photo-1744969982170-026d6f817281?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NDM0ODN8MHwxfHJhbmRvbXx8fHx8fHx8fDE3ODE4MjM1NzR8&ixlib=rb-4.1.0&q=80&w=1080";
const AVATAR_IMAGE =
  "https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NDM0ODN8MHwxfHJhbmRvbXx8fHx8fHx8fDE3ODE4MjM2MzZ8&ixlib=rb-4.1.0&q=80&w=1080";

// Icons stay in code; their order matches the Pencil features grid and the
// `Landing.features.items` array (row 1, then row 2).
const FEATURE_ICONS = [QrCode, ImageIcon, Languages, Pencil, BarChart3, ConciergeBell];

type CardCopy = { title: string; body: string };
type PlanCopy = { tier: string; desc: string; price: string; per: string; cta: string; badge?: string; feats: string[] };
type FooterCol = { heading: string; links: string[] };

/** Brand glyphs (lucide dropped its brand icons), 20px, currentColor. */
const SOCIALS: { name: string; path: React.ReactNode }[] = [
  {
    name: "Instagram",
    path: (
      <>
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="12" cy="12" r="4.5" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" />
      </>
    ),
  },
  {
    name: "X",
    path: <path d="M3 3l7.5 9.2L3.3 21H6l5.7-6.7L17 21h4l-7.9-9.7L20.5 3H18l-5.3 6.2L8 3H3z" fill="currentColor" />,
  },
  {
    name: "LinkedIn",
    path: (
      <>
        <rect x="2" y="2" width="20" height="20" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M7 10v7M7 7v.01M11 17v-4a2 2 0 0 1 4 0v4M11 17v-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </>
    ),
  },
  {
    name: "YouTube",
    path: (
      <>
        <rect x="2" y="5" width="20" height="14" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M10 9l5 3-5 3z" fill="currentColor" />
      </>
    ),
  },
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-[var(--cinnabar-soft)] px-3 py-1.5 text-[13px] font-semibold text-[var(--cinnabar)]">
      {children}
    </span>
  );
}

export default async function LandingPage() {
  const t = await getTranslations("Landing");

  const navLinks = [
    { label: t("nav.features"), href: "#features" },
    { label: t("nav.how"), href: "#how" },
    { label: t("nav.pricing"), href: "#pricing" },
    { label: t("nav.stories"), href: "#stories" },
  ];
  const features = t.raw("features.items") as CardCopy[];
  const steps = t.raw("how.steps") as CardCopy[];
  const bullets = t.raw("showcase.bullets") as string[];
  const free = t.raw("pricing.free") as PlanCopy;
  const pro = t.raw("pricing.pro") as PlanCopy;
  const footerCols = t.raw("footer.columns") as FooterCol[];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Nav ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-border bg-[color-mix(in_srgb,var(--paper)_88%,transparent)] backdrop-blur">
        <nav className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-6">
          <Link href="/menu" className="flex items-center gap-2 no-underline">
            <span className="grid size-8 place-items-center rounded-lg bg-primary font-[family-name:var(--display)] text-[18px] font-extrabold text-white">i</span>
            <span className="font-[family-name:var(--display)] text-[21px] font-extrabold tracking-[-0.02em] text-foreground">iedora</span>
          </Link>
          <ul className="ml-auto hidden items-center gap-7 md:flex">
            {navLinks.map((l) => (
              <li key={l.href}>
                <a href={l.href} className="text-[15px] font-medium text-muted-foreground no-underline transition-colors hover:text-foreground">{l.label}</a>
              </li>
            ))}
          </ul>
          <div className="ml-auto flex items-center gap-3 md:ml-6">
            <LangSwitch />
            <Link href={SIGN_IN_HREF} className="text-[15px] font-semibold text-foreground no-underline hover:text-primary">{t("nav.signIn")}</Link>
            <Button as="a" href={SIGN_UP_HREF} variant="primary" size="sm">{t("nav.getStarted")}</Button>
          </div>
        </nav>
      </header>

      <main>
        {/* ── Hero ──────────────────────────────────────────── */}
        <section className="mx-auto flex max-w-6xl flex-col items-center gap-7 px-6 py-16 text-center md:py-20">
          <Eyebrow>{t("hero.eyebrow")}</Eyebrow>
          <h1 className="max-w-4xl text-[40px] leading-[1.05] md:text-[60px]">{t("hero.headline")}</h1>
          <p className="max-w-2xl text-[18px] leading-[1.55] text-muted-foreground">{t("hero.subhead")}</p>
          <div className="flex flex-wrap items-center justify-center gap-3.5">
            <Button as="a" href={SIGN_UP_HREF} variant="primary" size="lg">{t("hero.ctaPrimary")}</Button>
            <Button as="a" href="#how" variant="secondary" size="lg">
              <Play size={16} fill="currentColor" strokeWidth={0} /> {t("hero.ctaSecondary")}
            </Button>
          </div>
          <div className="relative mt-6 h-[320px] w-full overflow-hidden rounded-[28px] sm:h-[440px] md:h-[560px]">
            <Image src={HERO_IMAGE} alt={t("hero.headline")} fill priority sizes="(min-width: 1152px) 1104px, 100vw" className="object-cover" />
          </div>
        </section>

        {/* ── Features ──────────────────────────────────────── */}
        <section id="features" className="mx-auto max-w-6xl px-6 py-16 md:py-24">
          <SectionHead eyebrow={t("features.eyebrow")} title={t("features.title")} sub={t("features.sub")} />
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => {
              const Icon = FEATURE_ICONS[i] ?? QrCode;
              return (
                <div key={f.title} className="flex flex-col gap-3 rounded-[18px] border border-border bg-card p-7">
                  <span className="grid size-11 place-items-center rounded-xl bg-[var(--cinnabar-soft)] text-primary">
                    <Icon size={22} strokeWidth={2} />
                  </span>
                  <h3 className="text-[17px]">{f.title}</h3>
                  <p className="text-[14.5px] leading-[1.55] text-muted-foreground">{f.body}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── How it works ──────────────────────────────────── */}
        <section id="how" className="bg-muted py-16 md:py-24">
          <div className="mx-auto max-w-6xl px-6">
            <SectionHead eyebrow={t("how.eyebrow")} title={t("how.title")} />
            <div className="mt-12 grid gap-8 md:grid-cols-3">
              {steps.map((s, i) => (
                <div key={s.title} className="flex flex-col gap-3 rounded-[18px] border border-border bg-card p-7">
                  <span className="grid size-10 place-items-center rounded-full bg-primary font-[family-name:var(--display)] text-[16px] font-bold text-white">{i + 1}</span>
                  <h3 className="mt-1 text-[18px]">{s.title}</h3>
                  <p className="text-[14.5px] leading-[1.55] text-muted-foreground">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Showcase (image left, text right) ─────────────── */}
        <section id="stories" className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-16 md:grid-cols-2 md:gap-16 md:py-24">
          <div className="relative h-[320px] w-full overflow-hidden rounded-[28px] sm:h-[440px] md:h-[540px]">
            <Image src={SHOWCASE_IMAGE} alt={t("showcase.title")} fill sizes="(min-width: 768px) 540px, 100vw" className="object-cover" />
          </div>
          <div className="flex flex-col items-start gap-5">
            <Eyebrow>{t("showcase.eyebrow")}</Eyebrow>
            <h2 className="text-[34px] leading-[1.1] md:text-[40px]">{t("showcase.title")}</h2>
            <p className="text-[16px] leading-[1.6] text-muted-foreground">{t("showcase.body")}</p>
            <ul className="flex flex-col gap-3.5">
              {bullets.map((b) => (
                <li key={b} className="flex items-center gap-3 text-[15.5px]">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--green-soft)] text-[var(--green)]"><Check size={15} strokeWidth={2.5} /></span>
                  {b}
                </li>
              ))}
            </ul>
            <Button as="a" href={SIGN_UP_HREF} variant="primary">{t("showcase.cta")}</Button>
          </div>
        </section>

        {/* ── Pricing ───────────────────────────────────────── */}
        <section id="pricing" className="bg-muted py-16 md:py-24">
          <div className="mx-auto max-w-6xl px-6">
            <SectionHead eyebrow={t("pricing.eyebrow")} title={t("pricing.title")} sub={t("pricing.sub")} />
            <div className="mx-auto mt-12 grid max-w-3xl gap-6 md:grid-cols-2">
              <PlanCard plan={free} href={SIGN_UP_HREF} />
              <PlanCard plan={pro} href={SIGN_UP_HREF} highlighted />
            </div>
          </div>
        </section>

        {/* ── Testimonial ───────────────────────────────────── */}
        <section className="mx-auto max-w-3xl px-6 py-16 text-center md:py-24">
          <div className="mb-5 flex justify-center gap-1 text-primary">
            {[0, 1, 2, 3, 4].map((i) => <Star key={i} size={20} fill="currentColor" strokeWidth={0} />)}
          </div>
          <blockquote className="font-[family-name:var(--display)] text-[24px] font-semibold leading-[1.35] text-foreground md:text-[30px]">
            {`"${t("testimonial.quote")}"`}
          </blockquote>
          <div className="mt-7 flex items-center justify-center gap-3.5">
            <Image src={AVATAR_IMAGE} alt={t("testimonial.name")} width={52} height={52} className="size-[52px] rounded-full object-cover" />
            <div className="text-left">
              <p className="text-[16px] font-bold text-foreground">{t("testimonial.name")}</p>
              <p className="text-[14px] text-muted-foreground">{t("testimonial.role")}</p>
            </div>
          </div>
        </section>

        {/* ── CTA band ──────────────────────────────────────── */}
        <section className="px-6 pb-20">
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 rounded-[28px] bg-[var(--ink)] px-8 py-16 text-center text-[var(--paper)]">
            <h2 className="text-[32px] leading-[1.1] text-[var(--paper)] md:text-[44px]">{t("cta.title")}</h2>
            <p className="max-w-xl text-[16px] leading-[1.6] text-[var(--paper)]/75">{t("cta.subhead")}</p>
            <div className="flex flex-wrap items-center justify-center gap-3.5">
              <Button as="a" href={SIGN_UP_HREF} variant="primary" size="lg">{t("cta.primary")}</Button>
              <Button as="a" href={SIGN_IN_HREF} variant="ghost" size="lg" className="!text-[var(--paper)] !border-[color-mix(in_srgb,var(--paper)_30%,transparent)]">{t("cta.secondary")}</Button>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="border-t border-border">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-lg bg-primary font-[family-name:var(--display)] text-[15px] font-extrabold text-white">i</span>
              <span className="font-[family-name:var(--display)] text-[18px] font-extrabold text-foreground">iedora</span>
            </div>
            <p className="max-w-xs text-[14px] leading-[1.55] text-muted-foreground">{t("footer.tagline")}</p>
          </div>
          {footerCols.map((col) => (
            <div key={col.heading} className="flex flex-col gap-3">
              <p className="font-[family-name:var(--display)] text-[13px] font-bold tracking-[0.04em] text-foreground">{col.heading}</p>
              {col.links.map((l) => (
                <a key={l} href="#" className="text-[14px] text-muted-foreground no-underline transition-colors hover:text-foreground">{l}</a>
              ))}
            </div>
          ))}
        </div>
        <div className="border-t border-border">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
            <p className="text-[13px] text-muted-foreground">{t("footer.copyright")}</p>
            <div className="flex items-center gap-4 text-muted-foreground">
              {SOCIALS.map((s) => (
                <a key={s.name} href="#" aria-label={s.name} className="transition-colors hover:text-foreground">
                  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">{s.path}</svg>
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function SectionHead({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="max-w-2xl text-[32px] leading-[1.12] md:text-[42px]">{title}</h2>
      {sub ? <p className="max-w-xl text-[16px] leading-[1.55] text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

function PlanCard({
  plan,
  href,
  highlighted = false,
}: {
  plan: PlanCopy;
  href: string;
  highlighted?: boolean;
}) {
  return (
    <div className={`relative flex flex-col gap-5 rounded-[18px] border bg-card p-7 ${highlighted ? "border-2 border-primary shadow-[0_20px_44px_-14px_var(--cinnabar-16)]" : "border-border"}`}>
      {plan.badge ? (
        <span className="absolute -top-3 left-7 rounded-full bg-primary px-3 py-1 text-[12px] font-semibold text-white">{plan.badge}</span>
      ) : null}
      <div>
        <p className="font-[family-name:var(--display)] text-[17px] font-bold text-foreground">{plan.tier}</p>
        <p className="text-[13px] text-muted-foreground">{plan.desc}</p>
      </div>
      <p className="flex items-baseline gap-1">
        <span className="font-[family-name:var(--display)] text-[44px] font-extrabold tracking-[-0.02em] text-foreground">{plan.price}</span>
        <span className="text-[15px] text-muted-foreground">{plan.per}</span>
      </p>
      <Button as="a" href={href} variant={highlighted ? "primary" : "secondary"} className="!w-full !justify-center">{plan.cta}</Button>
      <ul className="flex flex-col gap-2.5">
        {plan.feats.map((f) => (
          <li key={f} className="flex items-center gap-2.5 text-[14.5px]">
            <Check size={16} strokeWidth={2.5} className="shrink-0 text-[var(--green)]" />
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}
