'use client'

import { useTranslations } from 'next-intl'
import {
  DashboardPage,
  Button,
  Badge,
  StatusChip,
  ConfirmDialog,
  PhotoLightbox,
} from '@iedora/design-system'
import { Home, Maximize, Bath, MapPin, Trash2, Building2, ExternalLink } from 'lucide-react'
import { formatPrice, formatTypePT, formatOperationPT } from '@/shared/data/properties'
import type { Property, IntegratorStatus } from '@/shared/data/properties'
import { PublishIdealistaButton } from '@/features/idealista-publish/ui/publish-idealista-button'
import { EnergyBadge } from '@/shared/ui/energy-badge'

const INTEGRATORS = ['idealista'] as const

const INTEGRATOR_CONFIG: Record<string, { label: string; Icon: typeof Building2 }> = {
  idealista: { label: 'Idealista', Icon: Building2 },
}

type IntegratorConfig = { label: string; Icon: typeof Building2 }

function IntegratorRow({
  reference,
  integratorKey,
  cfg,
  status,
}: {
  reference: string
  integratorKey: string
  cfg: IntegratorConfig
  status: IntegratorStatus | undefined
}) {
  const t = useTranslations('Property')
  const state = status?.status ?? 'idle'

  const chipLabel =
    state === 'published'
      ? t('statusPublished')
      : state === 'publishing'
        ? t('statusPublishing')
        : state === 'failed'
          ? t('statusFailed')
          : t('statusDraft')

  const chipVariant: 'success' | 'danger' | 'neutral' =
    state === 'published' ? 'success' : state === 'failed' ? 'danger' : 'neutral'

  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-[auto_1fr_auto] items-start sm:items-center gap-1 sm:gap-3 px-3 py-2 text-[12px]"
      data-test-id={`property-integrator-row-${integratorKey}-${reference}`}
    >
      <div className="flex items-center gap-2">
        <cfg.Icon size={14} className="text-muted-foreground shrink-0" />
        <span className="text-foreground font-medium">{cfg.label}</span>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
        <StatusChip label={chipLabel} variant={chipVariant} />
        {status?.publishedAt && (
          <span className="text-muted-foreground">
            {new Date(status.publishedAt).toLocaleDateString('pt-PT', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        )}
        {state === 'failed' && status?.lastError && (
          <span className="text-[11px] text-[var(--cinnabar)]">{status.lastError}</span>
        )}
      </div>
      <div className="flex items-center gap-2 justify-self-start sm:justify-self-end">
        {status?.publishedUrl && (
          <a
            href={status.publishedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground no-underline"
            data-test-id={`property-integrator-link-${integratorKey}-${reference}`}
          >
            {t('viewListing')}
            <ExternalLink size={11} />
          </a>
        )}
        {(state === 'idle' || state === 'failed') && (
          <PublishIdealistaButton reference={reference} retry={state === 'failed'} />
        )}
      </div>
    </div>
  )
}

export function PropertyDetailView({
  prop,
  reference,
}: {
  prop: Property
  reference: string
}) {
  const t = useTranslations('Property')
  const tCommon = useTranslations('Common')
  const tPhotos = useTranslations('PropertyPhotos')

  const f = prop.features ?? {}
  const price = formatPrice(prop.priceCents)
  const pricePerSqm =
    f.constructedAreaSqm && f.constructedAreaSqm > 0
      ? formatPrice(Math.round(prop.priceCents / f.constructedAreaSqm))
      : null
  const area = f.constructedAreaSqm ?? prop.sizeSqm

  const positiveFeatures = [
    f.hasPool && t('feature.pool'),
    f.hasGarden && t('feature.garden'),
    f.hasTerrace && t('feature.terrace'),
    f.hasBalcony && t('feature.balcony'),
    f.hasParking && t('feature.parking'),
    f.hasStorage && t('feature.storage'),
    f.hasWardrobe && t('feature.wardrobe'),
    f.hasAirConditioning && t('feature.airConditioning'),
    f.hasFireplace && t('feature.fireplace'),
    f.hasLift && t('feature.lift'),
  ].filter(Boolean) as string[]

  return (
    <DashboardPage
      title={prop.reference}
      crumbs={[{ label: t('back'), href: '/dashboard' }]}
      data-test-id="property-detail"
    >
      {/* ── Info strip + image card ────────────────────────────── */}
      <div className="py-3 border-b border-[var(--border)]">
        <div className="flex gap-4 items-start">
          <div className="hidden sm:block w-[200px] h-[150px] shrink-0">
            <PhotoLightbox
              urls={prop.photoUrls ?? []}
              testId={`property-detail-image-${reference}`}
              size="large"
              labels={{
                empty: tPhotos('noPhoto'),
                expand: tPhotos('expandPhoto'),
                previous: tPhotos('previousPhoto'),
                next: tPhotos('nextPhoto'),
                close: tPhotos('closeLightbox'),
              }}
            />
          </div>
          <div className="flex-1 min-w-0 space-y-1.5">
            {/* Price + operation */}
            <div className="flex items-baseline gap-3">
              <span className="text-[22px] font-medium leading-none tracking-tight text-foreground">
                {price}
              </span>
              {pricePerSqm && (
                <span className="text-[12px] text-muted-foreground">
                  {pricePerSqm.replace('€', '').trim()} €/m²
                </span>
              )}
              <span className="text-[12px] text-muted-foreground">
                {formatOperationPT(prop.operation)}
              </span>
            </div>

            {/* Key stats */}
            <div className="flex items-center gap-2 text-[12px] text-muted-foreground flex-wrap">
              {prop.rooms && (
                <span className="inline-flex items-center gap-0.5">
                  <Home size={12} aria-hidden="true" />
                  T{prop.rooms}
                </span>
              )}
              {area && (
                <span className="inline-flex items-center gap-0.5">
                  <Maximize size={12} aria-hidden="true" />
                  {area} m²
                </span>
              )}
              {prop.bathrooms && (
                <span className="inline-flex items-center gap-0.5">
                  <Bath size={12} aria-hidden="true" />
                  {prop.bathrooms}
                </span>
              )}
              <span>{formatTypePT(prop.type)}</span>
              {f.yearBuilt && <span>· {f.yearBuilt}</span>}
            </div>

            {/* Address */}
            <div className="flex items-center gap-1 text-[12px] text-muted-foreground">
              <MapPin size={11} aria-hidden="true" />
              <span>
                {prop.address.street ? `${prop.address.street}, ` : ''}
                {[prop.address.locality, prop.address.municipality, prop.address.district]
                  .filter(Boolean)
                  .join(', ')}
                {prop.address.postalCode && ` · ${prop.address.postalCode}`}
              </span>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-1">
              <Button variant="accent" data-test-id="property-edit-button">
                {tCommon('edit')}
              </Button>
              <ConfirmDialog
                title={t('deleteTitle')}
                description={t('deleteDescription')}
                confirmLabel={tCommon('delete')}
                cancelLabel={tCommon('cancel')}
                variant="danger"
                onConfirm={async () => {
                  // TODO: implement actual delete
                }}
              >
                <Button variant="default" data-test-id="property-delete-button" aria-label={t('delete')}>
                  <Trash2 size={14} />
                </Button>
              </ConfirmDialog>
            </div>
          </div>
        </div>
      </div>

      {/* ── Integradores ───────────────────────────────────────── */}
      <div className="py-3 border-b border-[var(--border)]">
        <h2 className="eyebrow mb-2">{t('platforms')}</h2>
        <div className="border border-[var(--ink-14)]">
          {INTEGRATORS.map((key) => {
            const cfg = INTEGRATOR_CONFIG[key]
            const int = (prop.integrators ?? []).find((i) => i.key === key)
            return (
              <IntegratorRow
                key={key}
                integratorKey={key}
                reference={reference}
                cfg={cfg}
                status={int}
              />
            )
          })}
        </div>
      </div>

      {/* ── Details grid ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.2fr_1fr] pt-6">
        {/* Description */}
        {prop.description && (
          <section className="space-y-2">
            <h2 className="eyebrow">{t('description')}</h2>
            <p className="text-[13px] leading-relaxed text-[var(--ink-70)] whitespace-pre-line">
              {prop.description}
            </p>
          </section>
        )}

        {/* Details: data + location combined */}
        <section className="space-y-4">
          {/* Location */}
          <div>
            <h2 className="eyebrow mb-2">{t('location')}</h2>
            <div className="text-[13px] space-y-0.5">
              {prop.address.street && <div className="text-foreground">{prop.address.street}</div>}
              <div className="text-muted-foreground">
                {[prop.address.locality, prop.address.municipality, prop.address.district]
                  .filter(Boolean)
                  .join(', ')}
              </div>
              {prop.address.postalCode && (
                <div className="font-[family-name:var(--mono)] text-[11px] text-[var(--ink-40)]">
                  {prop.address.postalCode}
                </div>
              )}
            </div>
          </div>

          {/* Data table */}
          <div>
            <h2 className="eyebrow mb-2">{t('data')}</h2>
            <div className="space-y-1 text-[13px]">
              {prop.rooms != null && (
                <div className="flex justify-between py-1.5 border-b border-[var(--ink-08)]">
                  <span className="text-muted-foreground">{t('rooms_label')}</span>
                  <span className="font-medium text-foreground">T{prop.rooms}</span>
                </div>
              )}
              {prop.bathrooms != null && (
                <div className="flex justify-between py-1.5 border-b border-[var(--ink-08)]">
                  <span className="text-muted-foreground">{t('bathrooms_label')}</span>
                  <span className="font-medium text-foreground">{prop.bathrooms}</span>
                </div>
              )}
              {(f.constructedAreaSqm ?? prop.sizeSqm) && (
                <div className="flex justify-between py-1.5 border-b border-[var(--ink-08)]">
                  <span className="text-muted-foreground">{t('areaLabel')}</span>
                  <span className="font-medium text-foreground">{f.constructedAreaSqm ?? prop.sizeSqm} m²</span>
                </div>
              )}
              {f.usableAreaSqm && (
                <div className="flex justify-between py-1.5 border-b border-[var(--ink-08)]">
                  <span className="text-muted-foreground">{t('usableArea')}</span>
                  <span className="font-medium text-foreground">{f.usableAreaSqm} m²</span>
                </div>
              )}
              {f.lotSizeSqm && (
                <div className="flex justify-between py-1.5 border-b border-[var(--ink-08)]">
                  <span className="text-muted-foreground">{t('lotSize')}</span>
                  <span className="font-medium text-foreground">{f.lotSizeSqm.toLocaleString('pt-PT')} m²</span>
                </div>
              )}
              {f.floors && (
                <div className="flex justify-between py-1.5 border-b border-[var(--ink-08)]">
                  <span className="text-muted-foreground">{t('floors')}</span>
                  <span className="font-medium text-foreground">{f.floors}</span>
                </div>
              )}
              {f.yearBuilt && (
                <div className="flex justify-between py-1.5 border-b border-[var(--ink-08)]">
                  <span className="text-muted-foreground">{t('yearBuilt')}</span>
                  <span className="font-medium text-foreground">{f.yearBuilt}</span>
                </div>
              )}
              {f.energyCertificate && (
                <div className="flex justify-between py-1.5 border-b border-[var(--ink-08)]">
                  <span className="text-muted-foreground">{t('energyCertificate')}</span>
                  <EnergyBadge
                    value={f.energyCertificate}
                    data-test-id={`property-energy-${reference}`}
                  />
                </div>
              )}
              {f.heatingType && (
                <div className="flex justify-between py-1.5 border-b border-[var(--ink-08)]">
                  <span className="text-muted-foreground">{t('heating')}</span>
                  <span className="font-medium text-foreground">
                    {f.heatingType === 'individual'
                      ? t('heatingIndividual')
                      : f.heatingType === 'central'
                        ? t('heatingCentral')
                        : t('heatingNone')}
                  </span>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* ── Features ──────────────────────────────────────────── */}
      {positiveFeatures.length > 0 && (
        <section className="pt-6 space-y-2">
          <h2 className="eyebrow">{t('features')}</h2>
          <div className="flex flex-wrap gap-1.5">
            {positiveFeatures.map((feat) => (
              <Badge key={feat} variant="ghost">{feat}</Badge>
            ))}
          </div>
        </section>
      )}
    </DashboardPage>
  )
}
