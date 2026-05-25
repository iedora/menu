import { DashboardPage } from '@iedora/design-system'
import { getTranslations } from 'next-intl/server'

export default async function IdealistaIntegrator() {
  const t = await getTranslations('IdealistaIntegrator')
  const tList = await getTranslations('PropertyList')

  return (
    <DashboardPage
      title={t('title')}
      crumbs={[{ label: tList('title'), href: '/dashboard' }]}
      data-test-id="integrator-idealista"
      description={t('description')}
    >
      <div className="rounded border border-border p-6 text-[14px] text-muted-foreground space-y-2">
        <p>
          {t('accountLabel')}{' '}
          <span className="font-medium text-foreground">eduardoferdcarvalho+agency@gmail.com</span>
        </p>
        <p>
          {t('stateLabel')}{' '}
          <span className="font-medium text-foreground">{t('stateActive')}</span>
        </p>
        <p className="text-[12.5px]">{t('note')}</p>
      </div>
    </DashboardPage>
  )
}
