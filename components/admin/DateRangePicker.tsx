'use client'

import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Input } from '@/components/ui/Input'
import type { DateRange } from '@/lib/reporting'

// Nothing here predates the CRM, and a year still being typed lands below it:
// the field reads the "2" of 2026 as the year 0002 and reports it as a date.
const EARLIEST = '2000-01-01'

// Every finished date on the way to the one meant is a date of its own —
// typing a day turns 21 into 01 before 15 — so the last one wins.
const SETTLE_MS = 400

/**
 * The two dates, sent on once they make a range.
 *
 * The fields keep their own values while they're being edited — handing them
 * back a value would rewrite the field between keystrokes — so `draft` is only
 * what the two of them currently add up to.
 */
export function DateRangePicker({
  range,
  max,
  onChange,
}: {
  range: DateRange
  /** The latest day that can be asked for — today, in the business zone once it's known. */
  max: string
  onChange: (range: DateRange) => void
}) {
  const [draft, setDraft] = useState(range)
  const [problem, setProblem] = useState<string | null>(null)
  const settling = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => () => clearTimeout(settling.current), [])

  const usable = (day: string) => day >= EARLIEST && day <= max

  const edit = (event: ChangeEvent<HTMLInputElement>) => {
    const next = { ...draft, [event.target.name as keyof DateRange]: event.target.value }
    setDraft(next)
    clearTimeout(settling.current)
    // Half a date, or a day nobody meant: leave it where it is and wait.
    if (!usable(next.start) || !usable(next.end)) return
    // The API answers a backwards window with a 422; there's nothing to ask it.
    const backwards = next.end < next.start
    setProblem(backwards ? 'The end date cannot be before the start date.' : null)
    if (!backwards) settling.current = setTimeout(() => onChange(next), SETTLE_MS)
  }

  return (
    <div className="flex flex-wrap items-end justify-end gap-3">
      <Input
        label="From"
        name="start"
        type="date"
        className="w-[150px]"
        defaultValue={range.start}
        min={EARLIEST}
        max={max}
        onChange={edit}
      />
      <Input
        label="To"
        name="end"
        type="date"
        className="w-[150px]"
        defaultValue={range.end}
        min={EARLIEST}
        max={max}
        onChange={edit}
      />
      {problem && (
        <p role="alert" className="w-full text-right text-xs leading-[150%] text-status-red">
          {problem}
        </p>
      )}
    </div>
  )
}
