import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Badge, Separator } from '@iedora/design-system'
import { requireAdmin } from '@/features/admin'
import { getSubscriptionById } from '@/features/webhooks'
import { Eyebrow, Mono, PageHead } from '../../_lib/editorial'
import {
  DeleteSubscriptionDialog,
  SecretReveal,
  SendTestEventButton,
  SubscriptionForm,
} from './subscription-actions.client'

export const metadata = { title: 'Subscription · Admin' }

type Params = Promise<{ id: string }>

function fmtDateTime(d: Date | null | undefined) {
  if (!d) return '—'
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export default async function AdminWebhookDetailPage({
  params,
}: {
  params: Params
}) {
  const { id } = await params
  await requireAdmin(`/admin/webhooks/${id}`)
  const sub = await getSubscriptionById(id)
  if (!sub) notFound()

  return (
    <>
      <PageHead
        eyebrow={
          <>
            <Link
              href="/admin/webhooks"
              style={{ color: 'inherit', textDecoration: 'none' }}
            >
              / 04  Webhooks
            </Link>{' '}
            ·{' '}
            <Mono style={{ color: 'var(--ink-55)' }}>{sub.id}</Mono>
          </>
        }
        title={sub.name ?? sub.url}
        note={
          <em>
            Registered {fmtDateTime(sub.createdAt)} ·{' '}
            {sub.enabled ? (
              <Badge variant="ink">Enabled</Badge>
            ) : (
              <Badge variant="ghost">Disabled</Badge>
            )}
          </em>
        }
        actions={
          <>
            <SendTestEventButton />
            <DeleteSubscriptionDialog id={sub.id} name={sub.name ?? sub.url} />
          </>
        }
      />

      {/* Credentials ------------------------------------------------------ */}
      <section style={{ marginBottom: 36 }}>
        <Eyebrow>/ Credentials</Eyebrow>
        <dl
          style={{
            display: 'grid',
            gridTemplateColumns: '180px 1fr',
            gap: '12px 36px',
            marginTop: 12,
            fontFamily: 'var(--serif)',
          }}
        >
          <dt style={dtStyle}>URL</dt>
          <dd style={ddStyle}>
            <Mono>{sub.url}</Mono>
          </dd>
          <dt style={dtStyle}>Secret</dt>
          <dd style={ddStyle}>
            {sub.secret === null ? (
              <em
                style={{
                  fontFamily: 'var(--serif)',
                  fontStyle: 'italic',
                  color: 'var(--cinnabar)',
                }}
              >
                Could not decrypt — secret unrecoverable. Delete and
                re-register this subscription.
              </em>
            ) : (
              <SecretReveal secret={sub.secret} />
            )}
          </dd>
          <dt style={dtStyle}>Updated</dt>
          <dd style={ddStyle}>
            <Mono>{fmtDateTime(sub.updatedAt)}</Mono>
          </dd>
        </dl>
      </section>

      <Separator />

      {/* Edit ------------------------------------------------------------- */}
      <section style={{ margin: '36px 0' }}>
        <Eyebrow>/ Configuration</Eyebrow>
        <p
          style={{
            fontFamily: 'var(--serif)',
            fontStyle: 'italic',
            color: 'var(--ink-70)',
            margin: '12px 0 16px',
          }}
        >
          Edit the URL, the event allow-list, or pause delivery without
          losing the secret. Save to apply.
        </p>
        <SubscriptionForm
          id={sub.id}
          initialName={sub.name ?? ''}
          initialUrl={sub.url}
          initialEnabled={sub.enabled}
          initialEvents={sub.events}
        />
      </section>
    </>
  )
}

const dtStyle: React.CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: 10.5,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: 'var(--ink-55)',
  alignSelf: 'baseline',
  paddingTop: 4,
}

const ddStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: 'var(--serif)',
  fontSize: 16,
  color: 'var(--ink)',
}
