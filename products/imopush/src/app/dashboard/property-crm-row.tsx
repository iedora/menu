import Link from 'next/link'
import { StatusChip, PhotoLightbox } from '@iedora/design-system'
import { getTranslations } from 'next-intl/server'
import { Home, Maximize, Bath, Camera, Building2 } from 'lucide-react'
import {
  formatPrice,
  formatTypePT,
  formatOperationPT,
  type Property,
} from '@/shared/data/properties'

const INTEGRATORS = ['idealista'] as const

const INTEGRATOR_CONFIG: Record<
  string,
  { label: string; Icon: typeof Building2 }
> = {
  idealista: { label: 'Idealista', Icon: Building2 },
}

export async function PropertyCrmRow({
  property,
}: {
  property: Property
}) {
  const t = await getTranslations('PropertyPhotos')
  const photoLabels = {
    empty: t('noPhoto'),
    expand: t('expandPhoto'),
    previous: t('previousPhoto'),
    next: t('nextPhoto'),
    close: t('closeLightbox'),
  }
  const f = property.features ?? {}
  const area = f.constructedAreaSqm ?? property.sizeSqm
  const hasPhotos = property.photoUrls && property.photoUrls.length > 0
  const integrators = property.integrators ?? []

  return (
    <Link
      href={`/dashboard/p/${property.reference}`}
      className="group flex no-underline h-[84px] transition-colors hover:bg-[color-mix(in_oklab,var(--accent)_60%,transparent)]"
      data-test-id={`property-crm-row-${property.reference}`}
    >
      {/* Image — fixed width, full row height (prevents layout shift) */}
      <div className="w-[130px] shrink-0 self-stretch">
        <PhotoLightbox
          urls={property.photoUrls ?? []}
          testId={`property-crm-image-${property.reference}`}
          size="compact"
          labels={photoLabels}
        />
      </div>

      {/* Content — fills remaining space */}
      <div className="flex flex-1 min-w-0">
        {/* Main info */}
        <div className="flex-1 min-w-0 px-2.5 py-1.5 space-y-0.5">
          {/* Reference + type + locality */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[12px] font-medium leading-tight text-foreground truncate min-w-0">
              {property.reference}
            </span>
            <span className="text-[10.5px] text-muted-foreground truncate min-w-0">
              {formatTypePT(property.type)} · {property.address.locality}
            </span>
          </div>

          {/* Key stats */}
          <div className="flex items-center gap-2 text-[10.5px] text-muted-foreground">
            {property.rooms && (
              <span className="inline-flex items-center gap-0.5">
                <Home size={10} aria-hidden="true" />
                T{property.rooms}
              </span>
            )}
            {area && (
              <span className="inline-flex items-center gap-0.5">
                <Maximize size={10} aria-hidden="true" />
                {area} m²
              </span>
            )}
            {property.bathrooms && (
              <span className="inline-flex items-center gap-0.5">
                <Bath size={10} aria-hidden="true" />
                {property.bathrooms}
              </span>
            )}
            {hasPhotos && (
              <span className="inline-flex items-center gap-0.5">
                <Camera size={10} aria-hidden="true" />
                {property.photoUrls!.length}
              </span>
            )}
          </div>

          {/* Integrator chips — state per integrator */}
          {INTEGRATORS.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              {INTEGRATORS.map((key) => {
                const cfg = INTEGRATOR_CONFIG[key]
                if (!cfg) return null
                const intStatus = integrators.find((i) => i.key === key)
                return (
                  <StatusChip
                    key={key}
                    label={cfg.label}
                    icon={<cfg.Icon size={10} />}
                    variant={intStatus?.status === 'published' ? 'success' : intStatus?.status === 'failed' ? 'danger' : 'neutral'}
                  />
                )
              })}
            </div>
          )}
        </div>

        {/* Price — top right */}
        <div className="self-start pt-1.5 pr-2.5 text-right whitespace-nowrap min-w-0">
          <div className="text-[14px] font-medium leading-tight text-foreground truncate">
            {formatPrice(property.priceCents)}
          </div>
          <div className="mt-0.5 text-[9px] text-muted-foreground">
            {formatOperationPT(property.operation)}
          </div>
        </div>
      </div>
    </Link>
  )
}
