'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, Copy } from 'lucide-react'
import {
  CallLegsPanel,
  QualificationPanel,
  RawEventLogPanel,
  TransfersPanel,
} from '@/components/admin/InteractionPanels'
import { Alert } from '@/components/ui/Alert'
import { PageShell } from '@/components/ui/PageShell'
import { AuthError } from '@/lib/auth'
import {
  getInteractionDetail,
  getQualificationRecord,
  listCallLegs,
  listInteractionEvents,
  listInteractionTransfers,
  type CallLeg,
  type InteractionDetailResponse,
  type InteractionEventList,
  type InteractionTransfer,
  type QualificationRecord,
} from '@/lib/interactionDetail'
import { waitForMocking } from '@/lib/mockReady'
import { withSession } from '@/lib/session'

const EVENTS_LIMIT = 10

/**
 * Where the reader came from, and so where "back" goes.
 *
 * This screen has more than one way in by design — the exception queue today,
 * the reports funnel next — so the header can't hard-code one of them. A new
 * caller adds its entry here and passes `?from=`; nothing else changes.
 */
const ORIGINS: Record<string, { href: string; label: string }> = {
  exceptions: { href: '/admin/exceptions', label: 'Back to Exceptions' },
}

/** For a bookmarked or pasted link, which names no origin. */
const NO_ORIGIN = { href: '/admin', label: 'Back to Dashboard' }

type Loaded = {
  detail: InteractionDetailResponse
  legs: CallLeg[]
  transfers: InteractionTransfer[]
  qualification: QualificationRecord | null
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: Loaded }

function messageFor(err: unknown): string {
  if (err instanceof AuthError && err.code === 'interaction.not_found') {
    return 'There is no interaction with that id.'
  }
  if (err instanceof AuthError && err.status === 403) {
    return 'You no longer have access to interaction detail.'
  }
  if (err instanceof AuthError && err.status === 401) {
    return 'Your session has ended. Please sign in again.'
  }
  return 'Could not load this interaction.'
}

export function InteractionDetailScreen({
  interactionId,
  from,
}: {
  interactionId: string
  /** The `?from=` the caller set, if any. */
  from?: string
}) {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' })
  const [eventsOffset, setEventsOffset] = useState(0)
  const [events, setEvents] = useState<InteractionEventList | null>(null)
  const [eventsFailed, setEventsFailed] = useState(false)
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null)

  const origin = (from && ORIGINS[from]) || NO_ORIGIN

  useEffect(() => {
    let cancelled = false

    waitForMocking()
      .then(() =>
        withSession(async (token) => {
          // The detail first: a 404 here is the answer for the whole page, and
          // there is no sense asking four panels about an interaction that
          // does not exist.
          const detail = await getInteractionDetail(interactionId, token)
          const [legs, transfers, qualification] = await Promise.all([
            listCallLegs(interactionId, token),
            listInteractionTransfers(interactionId, token),
            getQualificationRecord(interactionId, token),
          ])
          return { detail, legs, transfers, qualification }
        })
      )
      .then((data) => {
        if (!cancelled) setLoad({ status: 'ready', data })
      })
      .catch((err) => {
        if (!cancelled) setLoad({ status: 'error', message: messageFor(err) })
      })

    return () => {
      cancelled = true
    }
  }, [interactionId])

  useEffect(() => {
    let cancelled = false

    waitForMocking()
      .then(() =>
        withSession((token) =>
          listInteractionEvents(interactionId, { limit: EVENTS_LIMIT, offset: eventsOffset }, token)
        )
      )
      .then((page) => {
        if (!cancelled) setEvents(page)
      })
      // The log is one panel of four. Losing it says so in place rather than
      // taking the rest of the screen down with it.
      .catch(() => {
        if (!cancelled) setEventsFailed(true)
      })

    return () => {
      cancelled = true
    }
  }, [interactionId, eventsOffset])

  return (
    // The back control is the heading, per the design — so the page is titled
    // by where it returns to, which is why `?from=` has to be right. Arrow and
    // words are one link: the words read as part of the control, so they are.
    <PageShell
      title={
        <Link href={origin.href} className="group inline-flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border-hairline border-slate bg-white text-ink group-hover:bg-shop-floor">
            <ArrowLeft className="h-4 w-4" strokeWidth={2} aria-hidden />
          </span>
          {origin.label}
        </Link>
      }
    >
      {load.status === 'loading' && (
        <p className="rounded-xl border-hairline border-slate bg-white px-4 py-10 text-center text-sm text-slate">
          Loading this interaction…
        </p>
      )}

      {load.status === 'error' && <Alert>{load.message}</Alert>}

      {load.status === 'ready' && (
        <div className="space-y-5">
          <InteractionHeader detail={load.data.detail} />

          {/* Side by side where there is room, per the design; stacked below
              it. Two thirds to Call Legs, because four columns of ids and
              timestamps need it and Transfer's three names do not. */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <CallLegsPanel legs={load.data.legs} />
            </div>
            <TransfersPanel transfers={load.data.transfers} />
          </div>

          <QualificationPanel record={load.data.qualification} />

          {eventsFailed && <Alert>Could not load the raw event log.</Alert>}
          {!eventsFailed && events && (
            <RawEventLogPanel
              page={events}
              expandedId={expandedEventId}
              onToggle={(id) => setExpandedEventId((open) => (open === id ? null : id))}
              onOffsetChange={(offset) => {
                setExpandedEventId(null)
                setEventsOffset(offset)
              }}
            />
          )}
        </div>
      )}
    </PageShell>
  )
}

function InteractionHeader({ detail }: { detail: InteractionDetailResponse }) {
  return (
    <div>
      <p className="mb-2 text-sm leading-[150%] text-body-text">Interaction Detail:</p>
      <div className="inline-flex max-w-full items-center gap-3 rounded-lg border-hairline border-slate bg-white px-4 py-3">
        <span className="break-all text-sm text-ink">{detail.id}</span>
        <CopyButton value={detail.id} label="interaction id" />
      </div>
    </div>
  )
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard
      .writeText(value)
      .then(() => setCopied(true))
      // Refused in an insecure context or without permission. Nothing was
      // copied, so the button must not claim otherwise.
      .catch(() => setCopied(false))
  }

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  return (
    <button
      type="button"
      onClick={copy}
      className="shrink-0 text-slate hover:text-ink"
      aria-live="polite"
    >
      {copied ? (
        <Check className="h-4 w-4 text-status-green" strokeWidth={2} aria-hidden />
      ) : (
        <Copy className="h-4 w-4" strokeWidth={2} aria-hidden />
      )}
      <span className="sr-only">{copied ? `Copied ${label}` : `Copy ${label}`}</span>
    </button>
  )
}
