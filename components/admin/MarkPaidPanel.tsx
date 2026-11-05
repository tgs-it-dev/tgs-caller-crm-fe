'use client'

import { useState } from 'react'
import { BadgeCheck } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Select } from '@/components/ui/Select'
import { AuthError } from '@/lib/auth'
import { formatMonth, recentMonths, type PaidUpload, type PolicySale } from '@/lib/policies'
import { businessDay } from '@/lib/reporting'
import { tokens } from '@/lib/theme'

function salesText(count: number) {
  return `${count.toLocaleString()} ${count === 1 ? 'sale' : 'sales'}`
}

function messageFor(err: unknown) {
  if (err instanceof AuthError && err.fields.some((field) => field.field === 'month')) {
    return 'Choose this month or an earlier one.'
  }
  // The API names the file when it cannot read it, in words meant for the reader.
  if (err instanceof AuthError && err.fields.some((field) => field.field === 'file')) {
    return err.message
  }
  return 'Could not mark these sales as Paid. Try again.'
}

/**
 * The step after the lookup, for a Super Admin: choose the month the sales were
 * paid in and mark them. Sales already Paid keep their month. Once saved it says
 * so and offers nothing more, so one lookup is never saved twice.
 */
export function MarkPaidPanel({
  matches,
  saved,
  onMark,
}: {
  matches: PolicySale[]
  /** The upload this lookup was saved as, once it has been. */
  saved: PaidUpload | null
  /** Saves the file for a month (YYYY-MM); rejects with the API's error. */
  onMark: (month: string) => Promise<void>
}) {
  const [month, setMonth] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  // A sale made after the month cannot have been paid in it, so the upload leaves it out.
  const kept = month
    ? matches.filter((sale) => businessDay(new Date(sale.sold_at)).slice(0, 7) <= month)
    : matches
  const later = matches.length - kept.length
  const unpaid = kept.filter((sale) => sale.paid_month === null).length
  const alreadyPaid = kept.length - unpaid

  function mark() {
    setBusy(true)
    setProblem(null)
    onMark(month)
      .catch((err) => setProblem(messageFor(err)))
      .finally(() => {
        setBusy(false)
        setConfirming(false)
      })
  }

  if (saved) {
    const kept = saved.matched - saved.newly_paid
    return (
      <section
        className="flex items-start gap-3 rounded-xl border-hairline border-slate bg-white p-5"
        aria-live="polite"
      >
        <BadgeCheck
          className="mt-0.5 h-5 w-5 shrink-0"
          color={tokens.status.bayGreen}
          strokeWidth={2}
          aria-hidden
        />
        <div className="min-w-0">
          <h2 className="text-base font-semibold leading-[120%] text-ink">
            Saved as the {formatMonth(saved.month)} upload
          </h2>
          <p className="mt-1 text-sm leading-[150%] text-slate">
            Marked {salesText(saved.newly_paid)} as Paid for {formatMonth(saved.month)}.
            {kept > 0 && ` ${salesText(kept)} were Paid already and kept their month.`}
          </p>
        </div>
      </section>
    )
  }

  const leftOut =
    later > 0
      ? ` ${salesText(later)} ${later === 1 ? 'was' : 'were'} made after ${formatMonth(month)} and ${
          later === 1 ? 'is' : 'are'
        } left out.`
      : ''
  const outcome =
    kept.length === 0
      ? `Nothing can be marked: every sale was made after ${formatMonth(month)}.`
      : unpaid > 0
        ? `${salesText(unpaid)} will be marked Paid.${
            alreadyPaid > 0 ? ` ${salesText(alreadyPaid)} are Paid already and keep their month.` : ''
          }${leftOut}`
        : `Nothing new will be marked: all ${salesText(kept.length)} are Paid already.${leftOut}`

  return (
    <section className="rounded-xl border-hairline border-slate bg-white p-5">
      <header className="mb-4 border-b-hairline border-light-grey pb-3">
        <h2 className="text-base font-semibold leading-[120%] text-ink">Mark as Paid</h2>
      </header>
      <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
        <div className="w-[200px]">
          <Select
            label="Paid month"
            value={month}
            onChange={(event) => {
              setMonth(event.target.value)
              setProblem(null)
            }}
          >
            <option value="">Choose a month</option>
            {recentMonths(businessDay(new Date())).map((value) => (
              <option key={value} value={value}>
                {formatMonth(value)}
              </option>
            ))}
          </Select>
        </div>
        <p className="min-w-0 flex-1 pb-2 text-sm leading-[150%] text-slate">{outcome}</p>
        <div className="w-[160px]">
          <Button
            type="button"
            size="small"
            disabled={!month || kept.length === 0}
            onClick={() => setConfirming(true)}
          >
            Mark as Paid
          </Button>
        </div>
      </div>
      {problem && (
        <p role="alert" className="mt-2 text-xs leading-[150%] text-status-red">
          {problem}
        </p>
      )}

      <Dialog
        open={confirming}
        title="Mark as Paid"
        onClose={() => setConfirming(false)}
        busy={busy}
        actions={
          <div className="flex w-full gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setConfirming(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="button" onClick={mark} isLoading={busy} loadingText="Saving…">
              {unpaid > 0 ? 'Mark as Paid' : 'Save upload'}
            </Button>
          </div>
        }
      >
        {month && (
          <div className="space-y-2 text-sm leading-[150%] text-body-text">
            <p className="font-medium text-ink">
              {unpaid > 0
                ? `Mark ${salesText(unpaid)} as Paid for ${formatMonth(month)}?`
                : `Save this upload for ${formatMonth(month)}?`}
            </p>
            <p>
              {unpaid > 0
                ? `Conversion counts them in ${formatMonth(month)}.`
                : 'Nothing new is marked, but it backs up the months these sales already have.'}{' '}
              You can undo it from Paid uploads below.
            </p>
          </div>
        )}
      </Dialog>
    </section>
  )
}
