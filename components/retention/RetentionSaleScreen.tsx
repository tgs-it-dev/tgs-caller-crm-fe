'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Card, Pair, Pairs } from '@/components/admin/LeadDetailScreen'
import { ReviewHistory } from '@/components/qa/QaItemScreen'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { PageShell } from '@/components/ui/PageShell'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { AuthError } from '@/lib/auth'
import { formatDateTime, formatPhone } from '@/lib/format'
import { waitForMocking } from '@/lib/mockReady'
import { QA_STATUS_LABEL, QA_STATUS_TONE } from '@/lib/qa'
import {
  POLICY_STATUSES,
  POLICY_STATUS_LABEL,
  POLICY_STATUS_TONE,
  RETENTION_NOTE_MAX,
  getRetentionSale,
  setPolicyStatus,
  type PolicyStatus,
  type RetentionSaleDetail,
  type RetentionStatusEvent,
} from '@/lib/retention'
import { withSession } from '@/lib/session'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; sale: RetentionSaleDetail }

function messageFor(err: unknown): string {
  if (err instanceof AuthError && err.status === 404) return 'That sale has no policy to work.'
  if (err instanceof AuthError && err.status === 401) {
    return 'Your session has ended. Please sign in again.'
  }
  return 'Could not load this sale.'
}

function StatusBadge({ status }: { status: PolicyStatus | null }) {
  return status ? (
    <Badge tone={POLICY_STATUS_TONE[status]}>{POLICY_STATUS_LABEL[status]}</Badge>
  ) : (
    <Badge tone="neutral">No status</Badge>
  )
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border-hairline border-slate bg-white p-5">
      <h2 className="mb-4 border-b-hairline border-light-grey pb-3 text-base font-semibold leading-[120%] text-ink">
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

/** Each change to the policy's status, newest first, and where it came from. */
function StatusHistory({ events }: { events: RetentionStatusEvent[] }) {
  return (
    <Card title="Status history">
      {events.length === 0 ? (
        <p className="text-sm text-slate">No status has been set for this policy.</p>
      ) : (
        <ol className="space-y-4">
          {events.map((event, index) => (
            <li key={`${event.at}-${index}`} className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2 text-sm text-body-text">
                <StatusBadge status={event.status} />
                <span>
                  {event.actor_name ?? 'Someone'}, {formatDateTime(event.at)}
                </span>
              </div>
              <p className="text-xs leading-[150%] text-slate">
                {event.file_name ? `From ${event.file_name}` : 'Typed in'}
              </p>
              {event.note && (
                <blockquote className="whitespace-pre-line border-l-2 border-light-grey pl-3 text-sm leading-[150%] text-ink">
                  {event.note}
                </blockquote>
              )}
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}

/**
 * One sale as Retention works it: the customer, who sold it, its policy's status
 * and QA's review. Never what was paid or what it was worth.
 */
export function RetentionSaleScreen({ base }: { base: string }) {
  const id = useSearchParams().get('id') ?? ''
  const [load, setLoad] = useState<LoadState>({ status: 'loading' })
  const [tick, setTick] = useState(0)
  const [status, setStatus] = useState<PolicyStatus | ''>('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [saved, setSaved] = useState<RetentionStatusEvent | null>(null)

  // Adjusting state during render, not in an effect, when another sale is opened.
  const [shown, setShown] = useState(id)
  if (shown !== id) {
    setShown(id)
    setLoad({ status: 'loading' })
    setStatus('')
    setNote('')
    setSaved(null)
    setProblem(null)
  }

  useEffect(() => {
    let cancelled = false
    waitForMocking()
      .then(() => withSession((token) => getRetentionSale(id, token)))
      .then((sale) => {
        if (!cancelled) setLoad({ status: 'ready', sale })
      })
      .catch((err) => {
        if (!cancelled) setLoad({ status: 'error', message: messageFor(err) })
      })
    return () => {
      cancelled = true
    }
  }, [id, tick])

  function save(sale: RetentionSaleDetail) {
    if (!status) return
    setSaving(true)
    setProblem(null)
    withSession((token) => setPolicyStatus(sale.interaction_id, status, note, token))
      .then((change) => {
        setSaved(change)
        setStatus('')
        setNote('')
        setTick((n) => n + 1)
      })
      .catch((err) =>
        setProblem(
          err instanceof AuthError && err.status === 422 ? err.message : 'That did not save. Try again.'
        )
      )
      .finally(() => setSaving(false))
  }

  const sale = load.status === 'ready' ? load.sale : null

  return (
    <PageShell
      title={
        <Link href={base} className="group inline-flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border-hairline border-slate bg-white text-ink group-hover:bg-shop-floor">
            <ArrowLeft className="h-4 w-4" strokeWidth={2} aria-hidden />
          </span>
          Back to Retention
        </Link>
      }
    >
      {load.status === 'loading' && (
        <p className="rounded-xl border-hairline border-slate bg-white px-4 py-10 text-center text-sm text-slate">
          Loading this sale…
        </p>
      )}
      {load.status === 'error' && <Alert>{load.message}</Alert>}
      {sale && (
        <div className="space-y-5">
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-2xl font-semibold leading-[120%] text-ink">
                Policy {sale.policy_number}
              </h2>
              <p className="mt-1 text-sm leading-[150%] text-slate">
                {sale.lead_name} · {sale.team_name}
              </p>
            </div>
            <StatusBadge status={sale.status} />
          </header>

          <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(380px,2fr)]">
            <div className="min-w-0 space-y-5">
              <Card title="Customer and sale">
                <Pairs wide>
                  <Pair label="Customer">{sale.lead_name}</Pair>
                  <Pair label="Phone">{formatPhone(sale.lead_phone)}</Pair>
                  <Pair label="Vehicle">
                    {[sale.vehicle_year, sale.vehicle_make, sale.vehicle_model]
                      .filter((part) => part !== null && part !== '')
                      .join(' ') || '-'}
                  </Pair>
                  <Pair label="Team">{sale.team_name}</Pair>
                  <Pair label="Closer">{sale.closer_name}</Pair>
                  <Pair label="Sold">{formatDateTime(sale.sold_at)}</Pair>
                </Pairs>
              </Card>
              <StatusHistory events={sale.history} />
              <Card
                title="QA review"
                actions={
                  <Badge tone={QA_STATUS_TONE[sale.qa.status]}>
                    {QA_STATUS_LABEL[sale.qa.status]}
                  </Badge>
                }
              >
                <Pairs>
                  <Pair label="Score">
                    {sale.qa.score === null ? 'Not scored' : `${sale.qa.score} / 100`}
                  </Pair>
                </Pairs>
              </Card>
              {sale.qa.history.length > 0 && <ReviewHistory events={sale.qa.history} startOpen />}
            </div>

            <aside className="min-w-0 xl:sticky xl:top-5">
              <Panel title="Policy status">
                {saved && (
                  <p className="text-sm leading-[150%] text-ink" aria-live="polite">
                    Saved as {POLICY_STATUS_LABEL[saved.status]}.
                  </p>
                )}
                <Select
                  label="Status"
                  value={status}
                  onChange={(event) => {
                    setStatus(event.target.value as PolicyStatus | '')
                    setSaved(null)
                  }}
                >
                  <option value="">Choose a status</option>
                  {POLICY_STATUSES.map((value) => (
                    <option key={value} value={value}>
                      {POLICY_STATUS_LABEL[value]}
                    </option>
                  ))}
                </Select>
                <Textarea
                  label="Note (optional)"
                  value={note}
                  maxLength={RETENTION_NOTE_MAX}
                  rows={4}
                  onChange={(event) => setNote(event.target.value)}
                />
                {problem && (
                  <p role="alert" className="text-sm leading-[150%] text-status-red">
                    {problem}
                  </p>
                )}
                <Button
                  type="button"
                  disabled={!status}
                  isLoading={saving}
                  loadingText="Saving…"
                  onClick={() => save(sale)}
                >
                  Save status
                </Button>
              </Panel>
            </aside>
          </div>
        </div>
      )}
    </PageShell>
  )
}
