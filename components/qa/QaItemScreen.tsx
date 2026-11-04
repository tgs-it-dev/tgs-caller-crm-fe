'use client'

import { useEffect, useId, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import MuiButton from '@mui/material/Button'
import Slider from '@mui/material/Slider'
import {
  ArrowLeft,
  ChevronDown,
  CircleCheck,
  CircleDot,
  Scale,
  TriangleAlert,
  UserMinus,
  UserPlus,
  type LucideIcon,
} from 'lucide-react'
import { Card, CartCard, LeadCard, Pair, Pairs } from '@/components/admin/LeadDetailScreen'
import { useCurrentUser } from '@/components/auth/CurrentUserProvider'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { PageShell } from '@/components/ui/PageShell'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { AuthError, type Role } from '@/lib/auth'
import { formatDateTime, formatPhone } from '@/lib/format'
import { waitForMocking } from '@/lib/mockReady'
import {
  QA_NOTE_MAX,
  QA_SCORE_MAX,
  QA_SCORE_MIN,
  QA_STATUS_LABEL,
  QA_STATUS_TONE,
  assignQaItem,
  assigneeOptions,
  canAssign,
  getQaItem,
  listQaAgents,
  movesFor,
  reviewsOwnOnly,
  setQaStatus,
  type QaAgent,
  type QaHistoryEvent,
  type QaItem,
  type QaItemDetail,
  type QaStatus,
} from '@/lib/qa'
import { withSession } from '@/lib/session'
import { tokens } from '@/lib/theme'

type Cart = QaItemDetail['lead']['carts'][number]

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; detail: QaItemDetail }

/** What is being saved, so only that button shows it. */
type Saving = QaStatus | 'assign' | null

function messageFor(err: unknown): string {
  if (err instanceof AuthError && err.status === 404) return 'This sale is not in your queue.'
  if (err instanceof AuthError && err.status === 401) {
    return 'Your session has ended. Please sign in again.'
  }
  return 'Could not load this sale.'
}

function actionMessage(err: unknown): string {
  if (err instanceof AuthError && (err.status === 403 || err.status === 422)) return err.message
  return 'That did not save. Try again.'
}

/** What a step reads as, and the icon and colour it gets on the timeline. */
function step(event: QaHistoryEvent): { icon: LucideIcon; tone: string; says: ReactNode } {
  const who = <strong className="font-semibold text-ink">{event.actor_name ?? 'Someone'}</strong>
  if (event.kind === 'assigned') {
    return event.assignee_name
      ? {
          icon: UserPlus,
          tone: tokens.navy,
          says: (
            <>
              {who} assigned it to{' '}
              <strong className="font-semibold text-ink">{event.assignee_name}</strong>
            </>
          ),
        }
      : { icon: UserMinus, tone: tokens.slate, says: <>{who} unassigned it</> }
  }
  if (event.status === 'disputed') {
    return { icon: TriangleAlert, tone: tokens.status.red, says: <>{who} disputed it</> }
  }
  if (event.status === 'resolve_dispute') {
    return { icon: Scale, tone: tokens.status.gold, says: <>{who} resolved the dispute</> }
  }
  if (event.status === 'closed') {
    return { icon: CircleCheck, tone: tokens.status.bayGreen, says: <>{who} closed it</> }
  }
  if (event.status === 'open') {
    return { icon: CircleDot, tone: tokens.slate, says: <>{who} reopened it</> }
  }
  return { icon: CircleDot, tone: tokens.slate, says: <>{who} changed its status</> }
}

/** The agent's notes, set off from the text around them. */
function Quote({ children }: { children: ReactNode }) {
  return (
    <blockquote className="whitespace-pre-line border-l-2 border-light-grey pl-3 text-sm leading-[150%] text-ink">
      {children}
    </blockquote>
  )
}

/**
 * Who worked the review, oldest first, with the notes and score given at each
 * step. Folded away until asked for when it matters less than the sale itself.
 */
function ReviewHistory({ events, startOpen }: { events: QaHistoryEvent[]; startOpen: boolean }) {
  const [open, setOpen] = useState(startOpen)
  const bodyId = useId()
  return (
    <section className="rounded-xl border-hairline border-slate bg-white p-5">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((shown) => !shown)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <h2 className="text-base font-semibold leading-[120%] text-ink">
          Review history <span className="font-normal text-slate">({events.length})</span>
        </h2>
        <ChevronDown
          className={`h-4 w-4 text-slate transition-transform motion-reduce:transition-none ${
            open ? 'rotate-180' : ''
          }`}
          strokeWidth={2}
          aria-hidden
        />
      </button>
      {open && (
        <div id={bodyId} className="mt-4 border-t-hairline border-light-grey pt-4">
          {events.length === 0 ? (
            <p className="text-sm text-slate">Nobody has worked on this review yet.</p>
          ) : (
            <ol>
              {events.map((event, index) => {
                const { icon: Icon, tone, says } = step(event)
                const last = index === events.length - 1
                return (
                  <li key={index} className={`relative pl-11 ${last ? '' : 'pb-5'}`}>
                    {/* The rail joins each step to the next. */}
                    {!last && (
                      <span
                        className="absolute bottom-0 left-[15px] top-8 w-px bg-light-grey"
                        aria-hidden
                      />
                    )}
                    <span
                      className="absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full border-hairline border-light-grey bg-white"
                      aria-hidden
                    >
                      <Icon className="h-4 w-4" color={tone} strokeWidth={2} />
                    </span>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pt-1.5">
                      <p className="text-sm leading-[150%] text-body-text">
                        {says}
                        {event.score != null && (
                          <span className="text-slate"> · Score {event.score}</span>
                        )}
                      </p>
                      <time className="whitespace-nowrap text-xs text-slate" dateTime={event.at}>
                        {formatDateTime(event.at)}
                      </time>
                    </div>
                    {event.note && (
                      <div className="mt-2">
                        <Quote>{event.note}</Quote>
                      </div>
                    )}
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      )}
    </section>
  )
}

/** A score from 0 to 100, unset until the agent moves it, so no sale closes on a default. */
function ScorePicker({
  value,
  disabled,
  onChange,
}: {
  value: number | null
  disabled: boolean
  onChange: (score: number) => void
}) {
  const labelId = useId()
  const unset = value === null
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span id={labelId} className="text-sm font-medium text-ink">
          Score
        </span>
        {unset ? (
          <span className="text-sm text-slate">Not scored yet</span>
        ) : (
          <span className="text-sm text-slate">
            <span className="text-2xl font-semibold tabular-nums text-ink">{value}</span> /{' '}
            {QA_SCORE_MAX}
          </span>
        )}
      </div>
      <div className="px-2">
        <Slider
          aria-labelledby={labelId}
          value={value ?? (QA_SCORE_MIN + QA_SCORE_MAX) / 2}
          min={QA_SCORE_MIN}
          max={QA_SCORE_MAX}
          step={1}
          marks={[
            { value: QA_SCORE_MIN, label: String(QA_SCORE_MIN) },
            { value: 50, label: '50' },
            { value: QA_SCORE_MAX, label: String(QA_SCORE_MAX) },
          ]}
          track={unset ? false : 'normal'}
          disabled={disabled}
          onChange={(_, next) => {
            if (typeof next === 'number') onChange(next)
          }}
          // Unset reads as a hollow grey thumb, not a score of 50.
          sx={
            unset
              ? {
                  '& .MuiSlider-thumb': {
                    bgcolor: 'common.white',
                    border: `2px solid ${tokens.slate}`,
                    boxShadow: 'none',
                  },
                }
              : undefined
          }
        />
      </div>
      {unset && (
        <p className="text-xs leading-[150%] text-slate">Drag or tap to score. Needed to close.</p>
      )}
    </div>
  )
}

/**
 * This sale: who sold it and when, which the agent needs to find the recording,
 * then how the customer pays. Only this sale's cart, not the lead's other calls'.
 */
function SaleCard({ item, cart, revealable }: { item: QaItem; cart?: Cart; revealable: boolean }) {
  const sold = (
    <>
      <Pair label="Closer">{item.closer_name}</Pair>
      <Pair label="Sold">{formatDateTime(item.closer_outcome_at)}</Pair>
    </>
  )
  if (cart) return <CartCard cart={cart} revealable={revealable} title="Sale" before={sold} />
  return (
    <Card title="Sale">
      <Pairs wide>{sold}</Pairs>
      <p className="mt-4 text-sm text-slate">No cart was saved for this sale.</p>
    </Card>
  )
}

/** The right-hand card: one job per person, with the status and score kept in view. */
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

function Problem({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="text-sm leading-[150%] text-status-red">
      {children}
    </p>
  )
}

/** One sale under review: the lead and its masked cart, and what this person does with it. */
export function QaItemScreen({ backHref }: { backHref: string }) {
  const id = useSearchParams().get('id') ?? ''
  const router = useRouter()
  const { user } = useCurrentUser()
  const roles: Role[] = user?.roles ?? []
  const assigner = canAssign(roles)
  const superAdmin = roles.includes('super_admin')
  const own = reviewsOwnOnly(roles)

  const [load, setLoad] = useState<LoadState>({ status: 'loading' })
  const [agents, setAgents] = useState<QaAgent[]>([])
  const [tick, setTick] = useState(0)
  const [saving, setSaving] = useState<Saving>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [score, setScore] = useState<number | null>(null)

  // Adjusting state during render, not in an effect, when another sale is opened.
  const [shown, setShown] = useState(id)
  if (shown !== id) {
    setShown(id)
    setLoad({ status: 'loading' })
    // A review started on one sale must never go with another's.
    setNote('')
    setScore(null)
  }

  useEffect(() => {
    let cancelled = false
    waitForMocking()
      .then(() => withSession((token) => getQaItem(id, token)))
      .then((detail) => {
        if (!cancelled) setLoad({ status: 'ready', detail })
      })
      .catch((err) => {
        if (!cancelled) setLoad({ status: 'error', message: messageFor(err) })
      })
    return () => {
      cancelled = true
    }
  }, [id, tick])

  useEffect(() => {
    if (!assigner) return
    let cancelled = false
    withSession((token) => listQaAgents(token))
      .then((people) => {
        if (!cancelled) setAgents(people)
      })
      .catch(() => {
        if (!cancelled) setAgents([])
      })
    return () => {
      cancelled = true
    }
  }, [assigner])

  function save(what: Exclude<Saving, null>, change: (token: string) => Promise<unknown>) {
    setSaving(what)
    setProblem(null)
    withSession(change)
      .then(() => {
        // Once an agent closes or disputes a sale it leaves their queue.
        if (what !== 'assign' && own) {
          router.push(backHref)
          return
        }
        setTick((n) => n + 1)
      })
      .catch((err) => setProblem(actionMessage(err)))
      .finally(() => setSaving(null))
  }

  function move(item: QaItem, to: QaStatus) {
    const review = to === 'resolve_dispute' ? null : { note, score }
    save(to, (token) => setQaStatus(item.interaction_id, to, review, token))
  }

  function assigneeField(item: QaItem) {
    if (assigner && item.status === 'open') {
      return (
        <Select
          label="Assigned to"
          value={item.assignee_user_id ?? ''}
          disabled={saving !== null}
          onChange={(event) => {
            const next = event.target.value || null
            save('assign', (token) => assignQaItem(item.interaction_id, next, token))
          }}
        >
          <option value="">Unassigned</option>
          {assigneeOptions(agents, item).map((agent) => (
            <option key={agent.user_id} value={agent.user_id}>
              {agent.name}
            </option>
          ))}
        </Select>
      )
    }
    return (
      <p className="text-sm text-slate">
        Assigned to{' '}
        <span className="font-medium text-ink">{item.assignee_name ?? 'nobody yet'}</span>
      </p>
    )
  }

  function panel(item: QaItem, history: QaHistoryEvent[]) {
    const moves = movesFor(roles, item, user?.id ?? null)

    // The assigned agent's review.
    if (moves.some((next) => next.to === 'closed')) {
      return (
        <Panel title="Your review">
          <ScorePicker value={score} disabled={saving !== null} onChange={setScore} />
          <Textarea
            label="Notes (optional)"
            value={note}
            maxLength={QA_NOTE_MAX}
            disabled={saving !== null}
            onChange={(event) => setNote(event.target.value)}
          />
          {problem && <Problem>{problem}</Problem>}
          <div className="grid gap-3">
            <Button
              disabled={score === null || saving !== null}
              isLoading={saving === 'closed'}
              loadingText="Closing…"
              onClick={() => move(item, 'closed')}
            >
              {score === null ? 'Close' : `Close with score ${score}`}
            </Button>
            <MuiButton
              fullWidth
              variant="outlined"
              color="error"
              disabled={saving !== null}
              onClick={() => move(item, 'disputed')}
            >
              {saving === 'disputed' ? 'Disputing…' : 'Dispute'}
            </MuiButton>
          </div>
        </Panel>
      )
    }

    const review = history.find(
      (event) => event.kind === 'status_changed' && event.previous_status === 'open'
    )
    const verdict = review && (
      <div className="space-y-2">
        <p className="text-sm leading-[150%] text-slate">
          {review.status === 'disputed' ? 'Disputed' : 'Closed'} by{' '}
          <span className="font-medium text-ink">{review.actor_name ?? 'Someone'}</span>,{' '}
          {formatDateTime(review.at)}
        </p>
        <p className="text-sm text-slate">
          {item.score === null ? (
            'No score given'
          ) : (
            <>
              Score{' '}
              <span className="text-2xl font-semibold tabular-nums text-ink">{item.score}</span> /{' '}
              {QA_SCORE_MAX}
            </>
          )}
        </p>
        {review.note && <Quote>{review.note}</Quote>}
      </div>
    )

    // A Super Admin settles a dispute, with no score or notes of their own.
    if (moves.some((next) => next.to === 'resolve_dispute')) {
      return (
        <Panel title="Dispute">
          {verdict}
          {problem && <Problem>{problem}</Problem>}
          <Button
            disabled={saving !== null}
            isLoading={saving === 'resolve_dispute'}
            loadingText="Resolving…"
            onClick={() => move(item, 'resolve_dispute')}
          >
            Resolve dispute
          </Button>
        </Panel>
      )
    }

    return (
      <Panel title="Review">
        {verdict ?? <p className="text-sm text-slate">Not reviewed yet.</p>}
        {problem && <Problem>{problem}</Problem>}
        {assigneeField(item)}
      </Panel>
    )
  }

  const item = load.status === 'ready' ? load.detail.item : null
  const lead = load.status === 'ready' ? load.detail.lead.lead : null

  return (
    <PageShell
      title={
        <Link href={backHref} className="group inline-flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border-hairline border-slate bg-white text-ink group-hover:bg-shop-floor">
            <ArrowLeft className="h-4 w-4" strokeWidth={2} aria-hidden />
          </span>
          Back to QA
        </Link>
      }
    >
      {load.status === 'loading' && (
        <p className="rounded-xl border-hairline border-slate bg-white px-4 py-10 text-center text-sm text-slate">
          Loading this sale…
        </p>
      )}
      {load.status === 'error' && <Alert>{load.message}</Alert>}
      {load.status === 'ready' && item && lead && (
        <div className="space-y-5">
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-2xl font-semibold leading-[120%] text-ink">
                {lead.lead_name !== lead.phone_no ? lead.lead_name : formatPhone(lead.phone_no)}
              </h2>
              <p className="mt-1 text-sm leading-[150%] text-slate">
                {item.team_name} · {item.closer_outcome} by {item.closer_name},{' '}
                {formatDateTime(item.closer_outcome_at)}
              </p>
            </div>
            <div className="flex items-center gap-4">
              {superAdmin && (
                <Link
                  href={`/admin/reports/lead/?id=${encodeURIComponent(item.lead_id)}`}
                  className="text-sm font-medium text-navy hover:underline"
                >
                  Open lead
                </Link>
              )}
              <Badge tone={QA_STATUS_TONE[item.status]}>{QA_STATUS_LABEL[item.status]}</Badge>
            </div>
          </header>

          {/*
            What the reviewer checks on the left, three parts to the review's two, which stays in
            view on the right. Narrower than xl both would be cramped, so the review goes below.
          */}
          <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(380px,2fr)]">
            <div className="min-w-0 space-y-5">
              <LeadCard lead={lead} title="Lead details" />
              {/* Showing a cart's full numbers is the Super Admin's alone, and logged. */}
              <SaleCard
                item={item}
                cart={load.detail.lead.carts.find(
                  (cart) => cart.interaction_id === item.interaction_id
                )}
                revealable={superAdmin}
              />
            </div>
            <aside className="min-w-0 xl:sticky xl:top-5">{panel(item, load.detail.history)}</aside>
          </div>

          <ReviewHistory key={item.interaction_id} events={load.detail.history} startOpen={!own} />
        </div>
      )}
    </PageShell>
  )
}
