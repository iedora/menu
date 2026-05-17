'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@iedora/design-system'
import { setOrganizationPlan } from '@/features/plans/actions'
import type { PlanCode } from '@/features/plans'

export function UpgradeButton({
  target,
  label,
  current,
}: {
  target: PlanCode
  label: string
  current: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  if (current) {
    return (
      <Button disabled className="w-full">
        Current plan
      </Button>
    )
  }

  return (
    <Button
      variant="solid"
      className="w-full"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await setOrganizationPlan(target)
          router.refresh()
        })
      }
    >
      {pending ? 'Switching…' : label}
    </Button>
  )
}
