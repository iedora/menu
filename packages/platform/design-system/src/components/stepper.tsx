'use client'

import * as React from 'react'

export type StepperStep = {
  /** Stable identifier — matched against `currentKey` to resolve state. */
  key: string
  /** 1-indexed position used to derive done/current/pending state. */
  index: number
  /** Already-localised label rendered inside the chip. */
  label: string
}

export type StepperProps = {
  steps: ReadonlyArray<StepperStep>
  /** Key of the active step. Must match one of `steps[i].key`. */
  currentKey: string
  /** Already-localised `aria-label` on the <ol>. */
  ariaLabel: string
  /**
   * Already-localised "Step N of M" string. Rendered as mono caption
   * below the rail. Omit to hide the counter line entirely.
   */
  counterLabel?: string
  /** Test hook injected on the wrapper. */
  testId?: string
  /**
   * Test-hook factory for per-step elements. Receives the step key,
   * returns the value placed on `data-test-id`. Omit to skip.
   */
  stepTestId?: (key: string) => string
  className?: string
}

type StepState = 'done' | 'current' | 'pending'

function resolveState(step: StepperStep, currentIndex: number): StepState {
  if (step.index === currentIndex) return 'current'
  return step.index < currentIndex ? 'done' : 'pending'
}

const chipBase =
  'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] uppercase tracking-[0.18em] leading-none transition-colors'

const chipByState: Record<StepState, string> = {
  done: 'bg-[var(--ink)] text-[var(--paper)]',
  current:
    'bg-[var(--cinnabar)] text-[var(--paper)] ring-4 ring-[var(--cinnabar)]/15',
  pending:
    'border border-[var(--ink-22)] bg-[var(--paper)] text-[var(--ink-55)]',
}

/**
 * Visual lifecycle indicator: a row of named chips connected by a
 * progress rail. The chip *is* the step name (no separate number) so
 * the linkage between steps reads as a flow, not a counter.
 *
 * Done = filled ink chip with check; current = cinnabar chip with a
 * soft halo; pending = hollow chip. The rail behind them fills with
 * ink up to the active step.
 *
 * Translation-agnostic — every visible string is passed in already
 * localised. Wrap with a product-specific component that resolves
 * `useTranslations()` or similar.
 *
 * Two-step today, N-step ready: geometry derives from `steps.length`.
 */
export function Stepper({
  steps,
  currentKey,
  ariaLabel,
  counterLabel,
  testId,
  stepTestId,
  className,
}: StepperProps) {
  const current = steps.find((s) => s.key === currentKey) ?? steps[0]
  const currentIndex = current?.index ?? 1
  const total = steps.length

  // Rail fill: 0% when on step 1, 100% when on the last step. Grows
  // linearly so a 3-step wizard shows 50% on step 2.
  const filledRailPct =
    total > 1
      ? Math.max(0, Math.min(100, ((currentIndex - 1) / (total - 1)) * 100))
      : 0

  return (
    <div
      className={
        'flex w-full max-w-[520px] flex-col items-stretch gap-3' +
        (className ? ` ${className}` : '')
      }
      data-test-id={testId}
    >
      <ol
        className="relative flex items-center justify-between"
        aria-label={ariaLabel}
      >
        {/* Idle rail — runs the full chip-to-chip distance behind the chips. */}
        <div
          aria-hidden="true"
          className="absolute inset-x-6 top-1/2 h-px -translate-y-1/2 bg-[var(--ink-14)]"
        />
        {/* Done rail — grows from the first chip to the current chip. */}
        <div
          aria-hidden="true"
          className="absolute left-6 top-1/2 h-px -translate-y-1/2 bg-[var(--ink)] transition-[width] duration-300"
          style={{ width: `calc((100% - 3rem) * ${filledRailPct / 100})` }}
        />

        {steps.map((step, i) => {
          const state = resolveState(step, currentIndex)
          const isLast = i === steps.length - 1
          return (
            <li
              key={step.key}
              className={
                'relative z-10 flex' +
                (i === 0 ? ' justify-start' : isLast ? ' justify-end' : ' justify-center')
              }
              style={{ flex: '0 0 auto' }}
              data-test-id={stepTestId?.(step.key)}
              data-state={state}
            >
              <span
                className={`${chipBase} ${chipByState[state]}`}
                aria-current={state === 'current' ? 'step' : undefined}
              >
                {state === 'done' ? (
                  <svg
                    viewBox="0 0 16 16"
                    aria-hidden="true"
                    className="h-3 w-3"
                  >
                    <path
                      d="M3.5 8.5l3 3 6-6.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <span
                    aria-hidden="true"
                    className={
                      'inline-block h-1.5 w-1.5 rounded-full ' +
                      (state === 'current'
                        ? 'bg-[var(--paper)]'
                        : 'bg-[var(--ink-22)]')
                    }
                  />
                )}
                <span>{step.label}</span>
              </span>
            </li>
          )
        })}
      </ol>
      {counterLabel ? (
        <p
          className="text-center font-[family-name:var(--mono)] text-[10.5px] uppercase tracking-[0.18em] text-[var(--ink-55)]"
          data-test-id={testId ? `${testId}-counter` : undefined}
        >
          {counterLabel}
        </p>
      ) : null}
    </div>
  )
}
