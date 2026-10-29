'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import MuiButton from '@mui/material/Button'
import {
  ArrowLeft,
  CircleCheck,
  CircleDot,
  Scale,
  TriangleAlert,
  UserMinus,
  UserPlus,
  type LucideIcon,
} from 'lucide-react'
import { LeadRecord } from '@/components/admin/LeadDetailScreen'
import { useCurrentUser } from '@/components/auth/CurrentUserProvider'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { PageShell } from '@/components/ui/PageShell'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { AuthError, type Role } from '@/lib/auth'
import { formatDateTime } from '@/lib/format'
import { waitForMocking } from '@/lib/mockReady'
import {
  QA_NOTE_MAX,
  QA_STATUS_LABEL,
  QA_STATUS_TONE,
  assignQaItem,
  assigneeOptions,
  canAssign,
  getQaItem,
  listQaAgents,
  movesFor,
  setQaStatus,
  type QaAgent,
  type QaHistoryEvent,
  type QaItemDetail,
} from '@/lib/qa'
import { withSession } from '@/lib/session'
import { tokens } from '@/lib/theme'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; detail: QaItemDetail }

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
    return {
      icon: Scale,
      tone: tokens.status.gold,
      says: <>{who} started resolving the dispute</>,
    }
  }
  if (event.status === 'closed') {
    return { icon: CircleCheck, tone: tokens.status.bayGreen, says: <>{who} closed it</> }
  }
  if (event.status === 'open') {
    return { icon: CircleDot, tone: tokens.slate, says: <>{who} reopened it</> }
  }
  return { icon: CircleDot, tone: tokens.slate, says: <>{who} changed its status</> }
}

/** Who worked the review, oldest first, with the reason given at each step. */
function ReviewHistory({ events }: { events: QaHistoryEvent[] }) {
  return (
    <section className="h-full rounded-xl border-hairline border-slate bg-white p-5">
      <header className="mb-4 border-b-hairline border-light-grey pb-3">
        <h2 className="text-base font-semibold leading-[120%] text-ink">Review history</h2>
      </header>
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
                  <p className="text-sm leading-[150%] text-body-text">{says}</p>
                  <time className="whitespace-nowrap text-xs text-slate" dateTime={event.at}>
                    {formatDateTime(event.at)}
                  </time>
                </div>
                {event.note && (
                  <blockquote className="mt-2 whitespace-pre-line border-l-2 border-light-grey pl-3 text-sm leading-[150%] text-ink">
                    {event.note}
                  </blockquote>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

/** One sale under review: where it stands, who has it, and everything on its lead. */
export function QaItemScreen({ backHref }: { backHref: string }) {
  const id = useSearchParams().get('id') ?? ''
  const { user } = useCurrentUser()
  const roles: Role[] = user?.roles ?? []
  const assigner = canAssign(roles)

  const [load, setLoad] = useState<LoadState>({ status: 'loading' })
  const [agents, setAgents] = useState<QaAgent[]>([])
  const [tick, setTick] = useState(0)
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [note, setNote] = useState('')

  // Adjusting state during render, not in an effect, when another sale is opened.
  const [shown, setShown] = useState(id)
  if (shown !== id) {
    setShown(id)
    setLoad({ status: 'loading' })
    // A reason typed for one sale must never go with another's move.
    setNote('')
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

  const teamId = load.status === 'ready' ? load.detail.item.team_id : null
  useEffect(() => {
    if (!assigner || !teamId) return
    let cancelled = false
    withSession((token) => listQaAgents(token, teamId))
      .then((people) => {
        if (!cancelled) setAgents(people)
      })
      .catch(() => {
        if (!cancelled) setAgents([])
      })
    return () => {
      cancelled = true
    }
  }, [assigner, teamId])

  function save(change: (token: string) => Promise<unknown>, { movedOn = false } = {}) {
    setSaving(true)
    setProblem(null)
    withSession(change)
      .then(() => {
        // The reason went with the move, so the next move starts blank.
        if (movedOn) setNote('')
        setTick((n) => n + 1)
      })
      .catch((err) => setProblem(actionMessage(err)))
      .finally(() => setSaving(false))
  }

  const item = load.status === 'ready' ? load.detail.item : null
  const moves = item ? movesFor(roles, item.status) : []

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
      {load.status === 'ready' && item && (
        <div className="space-y-5">
          {/* Side by side when there is room, so neither card stretches across empty space. */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <section className="h-full rounded-xl border-hairline border-slate bg-white p-5">
              <header className="mb-4 border-b-hairline border-light-grey pb-3">
                <h2 className="text-base font-semibold leading-[120%] text-ink">Review</h2>
                <p className="mt-1 text-xs leading-[150%] text-slate">
                  {item.team_name} · {item.closer_outcome} by {item.closer_name},{' '}
                  {formatDateTime(item.closer_outcome_at)}
                </p>
              </header>
              {problem && (
                <p role="alert" className="mb-3 text-sm leading-[150%] text-status-red">
                  {problem}
                </p>
              )}
              {moves.length > 0 && (
                <div className="mb-4 max-w-[640px]">
                  <Textarea
                    label="Reason"
                    value={note}
                    maxLength={QA_NOTE_MAX}
                    disabled={saving}
                    onChange={(event) => setNote(event.target.value)}
                  />
                </div>
              )}
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm text-slate">Status</span>
                  <Badge tone={QA_STATUS_TONE[item.status]}>{QA_STATUS_LABEL[item.status]}</Badge>
                  {moves.map((move) => (
                    <MuiButton
                      key={move.to}
                      variant="outlined"
                      size="small"
                      disabled={saving}
                      onClick={() =>
                        save((token) => setQaStatus(item.interaction_id, move.to, note, token), {
                          movedOn: true,
                        })
                      }
                    >
                      {move.label}
                    </MuiButton>
                  ))}
                </div>
                <div className="w-[220px]">
                  {assigner ? (
                    <Select
                      label="Assigned to"
                      value={item.assignee_user_id ?? ''}
                      disabled={saving}
                      onChange={(event) => {
                        const next = event.target.value || null
                        save((token) => assignQaItem(item.interaction_id, next, token))
                      }}
                    >
                      <option value="">Unassigned</option>
                      {assigneeOptions(agents, item).map((agent) => (
                        <option key={agent.user_id} value={agent.user_id}>
                          {agent.name}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <p className="text-sm text-slate">
                      Assigned to{' '}
                      <span className="font-medium text-ink">{item.assignee_name ?? 'nobody yet'}</span>
                    </p>
                  )}
                </div>
              </div>
            </section>
            <ReviewHistory events={load.detail.history} />
          </div>
          {/* Showing a cart's full numbers is the Super Admin's alone, and logged. */}
          <LeadRecord history={load.detail.lead} revealable={roles.includes('super_admin')} />
        </div>
      )}
    </PageShell>
  )
}
