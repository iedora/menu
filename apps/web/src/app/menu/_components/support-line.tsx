import { Phone } from 'lucide-react'

/**
 * Support line (Pencil "Support Line") — a rounded muted pill with a phone
 * icon, the help label, and the coral phone number. Shared by the auth and
 * onboarding chrome so there's one pill, not two hand-rolled copies. The
 * `label` is passed in (each caller owns its own i18n namespace).
 */
export function SupportLine({
  label,
  className = '',
  testId,
}: {
  label: string
  className?: string
  testId?: string
}) {
  return (
    <a
      href="tel:+351917140356"
      className={`flex items-center justify-center gap-2 rounded-full bg-muted px-5 py-4 text-[14px] text-muted-foreground no-underline ${className}`}
      data-test-id={testId}
    >
      <Phone size={15} strokeWidth={2} aria-hidden="true" className="shrink-0" /> {label}{' '}
      <span className="whitespace-nowrap font-semibold text-primary">+351 917 140 356</span>
    </a>
  )
}
