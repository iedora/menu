import { DashboardPage, Button, EmptyState } from '@iedora/design-system'
import { getTranslations } from 'next-intl/server'
import { listProperties } from '@/shared/data/properties-data'
import { PropertyCrmRow } from './property-crm-row'

export default async function DashboardHome() {
  const t = await getTranslations('PropertyList')
  const properties = await listProperties()

  if (properties.length === 0) {
    return (
      <DashboardPage
        title={t('title')}
        data-test-id="properties"
        actions={
          <Button variant="accent" href="/dashboard/p/new">
            {t('newProperty')}
          </Button>
        }
      >
        <EmptyState label={t('emptyLabel')} note={t('emptyHint')} />
      </DashboardPage>
    )
  }

  return (
    <DashboardPage
      title={t('title')}
      data-test-id="properties"
      actions={
        <Button variant="accent" href="/dashboard/p/new">
          {t('newProperty')}
        </Button>
      }
    >
      <div data-test-id="properties-list" className="divide-y-0">
        {properties.map((p) => (
          <PropertyCrmRow key={p.reference} property={p} />
        ))}
      </div>
    </DashboardPage>
  )
}
