import type { Metadata } from 'next'
import {
  Wordmark, Nav, NavBrand, NavActions,
  Statement, SectionHeader, MetaStrip, HouseSvg,
  Card, CardTitle, CardDesc, CardFoot,
} from '@iedora/design-system'
import { PRODUCTS, productUrl, CONTACT_EMAIL, BRAND_NAME } from '@iedora/brand'

export const metadata: Metadata = {
  title: 'iedora — software house. AI consultancy, workshops & products.',
  description:
    'iedora is a software house. We take on consultancy, run hands-on AI workshops, and build our own products. Menu is live today.',
}

export default function HouseLanding() {
  const menuUrl = productUrl(PRODUCTS.menu)

  return (
    <div className="ds-root ds-root--washed">
      <Nav sticky>
        <NavBrand>
          <Wordmark variant="inline" />
        </NavBrand>
        <NavActions>
          <a href={`mailto:${CONTACT_EMAIL}`} className="ds-btn">
            {CONTACT_EMAIL}
          </a>
        </NavActions>
      </Nav>

      <main className="ds-shell">
        {/* ── Hero ──────────────────────────────────────────── */}
        <header className="ds-hero" data-test-id="house-hero">
          <HouseSvg className="ds-hero__house" />
          <span className="ds-eyebrow">
            <span className="ds-eyebrow__idx">/ 00</span>
            <span>
              <Wordmark variant="inline" />
            </span>
          </span>
          <h1 className="ds-hero__h ds-hero__h--dot">
            We build <em>AI software</em> that ships.
          </h1>
          <Statement>
            iedora is a software house. We take on consultancy, run hands-on AI
            workshops, and build our own products. Menu is live today &mdash; more
            is on the way.
          </Statement>
          <p className="ds-hero__trust" data-test-id="house-trust">
            Consultancy &middot; AI workshops &middot; Product studio.
          </p>
          <div className="ds-hero__ctas">
            <a
              className="ds-btn ds-btn--primary"
              href={`mailto:${CONTACT_EMAIL}`}
              data-test-id="house-cta-project"
            >
              <span>Start a project</span>
              <span className="ds-btn__arrow" aria-hidden="true">
                →
              </span>
            </a>
            <a
              className="ds-btn"
              href={menuUrl}
              rel="noopener"
              data-test-id="house-cta-menu"
            >
              <span>See our product: Menu</span>
            </a>
          </div>
        </header>

        {/* ── Services ──────────────────────────────────────── */}
        <section data-test-id="house-services">
          <SectionHeader title="What we do" hint="Services" />

          <div
            className="grid grid-cols-1 gap-4 sm:grid-cols-3"
            style={{ marginTop: 24 }}
          >
            <Card data-test-id="house-service-consultancy">
              <CardTitle>Consultancy</CardTitle>
              <CardDesc>
                We embed with your team to design and ship real software &mdash;
                architecture, AI integration, and the hard parts in between.
              </CardDesc>
              <CardFoot>Engagements</CardFoot>
            </Card>

            <Card data-test-id="house-service-workshops">
              <CardTitle>AI workshops</CardTitle>
              <CardDesc>
                Hands-on sessions that get your team building with LLMs &mdash;
                prompting, agents, evaluation, and shipping to production.
              </CardDesc>
              <CardFoot>Half-day &amp; multi-day</CardFoot>
            </Card>

            <Card data-test-id="house-service-studio">
              <CardTitle>Product studio</CardTitle>
              <CardDesc>
                We build and run our own products. What we learn shipping them
                goes straight back into the work we do for clients.
              </CardDesc>
              <CardFoot>In-house</CardFoot>
            </Card>
          </div>
        </section>

        {/* ── Products ──────────────────────────────────────── */}
        <section data-test-id="house-products">
          <SectionHeader title="What we build" hint="Products" />

          <div
            className="grid grid-cols-1 gap-4 sm:grid-cols-2"
            style={{ marginTop: 24 }}
          >
            <a
              href={menuUrl}
              className="ds-card no-underline"
              data-test-id="house-product-menu"
            >
              <CardTitle>Menu</CardTitle>
              <CardDesc>
                A drag-and-drop menu builder for restaurants. QR codes,
                publishing, analytics, multi-language. Free for one restaurant.
              </CardDesc>
              <CardFoot>Live &middot; {menuUrl.replace('https://', '')}</CardFoot>
            </a>

            <Card data-test-id="house-product-next">
              <CardTitle>More from the studio</CardTitle>
              <CardDesc>
                Menu is the first product out the door. We are building more
                in-house, and shipping client work in between.
              </CardDesc>
              <CardFoot>Coming soon</CardFoot>
            </Card>
          </div>
        </section>

        {/* ── Contact ───────────────────────────────────────── */}
        <section data-test-id="house-contact">
          <SectionHeader title="Let's build something" hint="Contact" />

          <Statement>
            Whether you need a team to ship software, a workshop for yours, or you
            just want to talk about what we are building, we read every message.
          </Statement>

          <p style={{ marginTop: 24 }}>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="ds-btn ds-btn--primary"
              data-test-id="house-cta-contact-end"
            >
              <span>{CONTACT_EMAIL}</span>
              <span className="ds-btn__arrow" aria-hidden="true">
                →
              </span>
            </a>
          </p>
        </section>
      </main>

      <MetaStrip
        left={<span>&copy; {BRAND_NAME}</span>}
        center={<Wordmark variant="inline" />}
        right={<a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>}
      />
    </div>
  )
}
