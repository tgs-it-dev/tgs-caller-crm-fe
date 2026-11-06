'use client'

import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Segmented } from '@/components/ui/Segmented'
import {
  PERIOD_OPTIONS,
  earlierDay,
  laterDay,
  periodLabel,
  type PeriodChoice,
  type PeriodShown,
} from '@/lib/agentStats'

function Step({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-body-text transition-colors hover:bg-shop-floor focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy disabled:cursor-not-allowed disabled:text-light-grey disabled:hover:bg-transparent motion-reduce:transition-none [&_svg]:h-4 [&_svg]:w-4"
    >
      {children}
    </button>
  )
}

const NOUN = { today: 'day', week: 'week', month: 'month' } as const

/**
 * Today, Week or Month, and arrows back through the earlier ones. Never past
 * today: the server names the dates, so the label is always the period shown.
 */
export function PeriodPicker({
  choice,
  shown,
  today,
  onChange,
}: {
  choice: PeriodChoice
  /** What the figures on screen answered; null while they load. */
  shown: PeriodShown | null
  /** Today in the user's zone, as YYYY-MM-DD. */
  today: string
  onChange: (next: PeriodChoice) => void
}) {
  const later = shown ? laterDay(shown, today) : null
  const noun = NOUN[choice.period]

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Segmented
        label="Period"
        options={PERIOD_OPTIONS}
        value={choice.period}
        onChange={(period) => onChange({ period, day: null })}
      />
      <div className="flex items-center gap-1">
        <Step
          label={`Earlier ${noun}`}
          disabled={!shown}
          onClick={() => shown && onChange({ period: choice.period, day: earlierDay(shown) })}
        >
          <ChevronLeft strokeWidth={2} aria-hidden />
        </Step>
        <span
          aria-live="polite"
          className="min-w-[170px] text-center text-sm font-medium leading-[140%] text-ink tabular-nums"
        >
          {shown ? periodLabel(shown) : 'Loading…'}
        </span>
        <Step
          label={`Later ${noun}`}
          disabled={!later}
          onClick={() => later && onChange({ period: choice.period, day: later })}
        >
          <ChevronRight strokeWidth={2} aria-hidden />
        </Step>
      </div>
    </div>
  )
}
