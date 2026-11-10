'use client'

import { useCallback, useEffect, useReducer, useState, type ReactNode } from 'react'
import MuiButton from '@mui/material/Button'
import { Pencil } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { RequireRole } from '@/components/auth/RequireRole'
import { useCurrentUser } from '@/components/auth/CurrentUserProvider'
import { CartPaymentCard } from '@/components/closer/CartPaymentCard'
import { CloserDispositionCard } from '@/components/closer/CloserDispositionCard'
import { FronterDetailsDialog } from '@/components/closer/FronterDetailsDialog'
import { QualificationSnapshot } from '@/components/closer/QualificationSnapshot'
import { TodaysDispositionTable } from '@/components/closer/TodaysDispositionTable'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { PageShell } from '@/components/ui/PageShell'
import { deskRoleFromPath } from '@/lib/auth'
import {
  closedCall,
  closerTodaysRowsFromStats,
  createCloserDisposition,
  getInteractionDispositions,
  latestCloserDisposition,
  loadCloserWorkspace,
  snapshotFromQualification,
  type CallStanding,
  type CloserQualificationSnapshot,
  type DispositionResponse,
  type TodaysDispositionRow,
  type TransferResponse,
} from '@/lib/closer'
import { fetchTodaysStats, statsStageForUser } from '@/lib/closerStats'
import { formatElapsed } from '@/lib/format'
import { waitForMocking } from '@/lib/mockReady'
import { withSession } from '@/lib/session'

type TransferStatusLabel = TransferResponse['status']

const STATUS_LABEL: Partial<Record<TransferStatusLabel, string>> = {
  accepted: 'Transfer Accepted',
  offered: 'Transfer Offered',
  initiated: 'Transfer Initiated',
  rejected: 'Transfer Rejected',
  timeout: 'Transfer Timed Out',
}

/** Same layout as fronter Active Call: status badge unchanged, timer beside it. */
function TransferStatusBadge({
  label,
  tone,
  startedAt,
}: {
  label: string
  tone: 'accepted' | 'neutral'
  startedAt: string | null
}) {
  const [elapsed, setElapsed] = useState(() =>
    startedAt ? formatElapsed(startedAt) : null
  )

  useEffect(() => {
    if (!startedAt) return
    const id = setInterval(() => setElapsed(formatElapsed(startedAt)), 1000)
    return () => clearInterval(id)
  }, [startedAt])

  return (
    <div className="flex items-center gap-3">
      <Badge tone={tone} dot>
        {label}
      </Badge>
      {elapsed !== null && (
        <span className="text-sm text-ink">on call — {elapsed}</span>
      )}
    </div>
  )
}

const OPEN: CallStanding = { locked: false }

type WorkspaceState = {
  snapshot: CloserQualificationSnapshot | null
  standing: CallStanding
  options: DispositionResponse[]
  dispositionId: string
  savedLabel: string | null
  transferStatus: TransferStatusLabel | null
  /** Started by the closer on Own Sale: theirs with no transfer to accept. */
  ownSale: boolean
  /** Accept time (`updated_at` once accepted) — drives the header call timer. */
  callStartedAt: string | null
  isLoading: boolean
  loadError: string | null
  saveError: string | null
}

type WorkspaceAction =
  | {
      type: 'load_success'
      snapshot: CloserQualificationSnapshot | null
      standing: CallStanding
      options: DispositionResponse[]
      transferStatus: TransferStatusLabel | null
      ownSale: boolean
      callStartedAt: string | null
      savedLabel: string | null
      dispositionId: string
      loadError: string | null
    }
  | { type: 'load_error'; message: string }
  | { type: 'set_disposition_id'; dispositionId: string }
  | { type: 'save_start' }
  | { type: 'save_success'; savedLabel: string | null; standing: CallStanding }
  | { type: 'details_saved'; snapshot: CloserQualificationSnapshot | null }
  | { type: 'save_error'; message: string }

const initialWorkspace: WorkspaceState = {
  snapshot: null,
  standing: OPEN,
  options: [],
  dispositionId: '',
  savedLabel: null,
  transferStatus: null,
  ownSale: false,
  callStartedAt: null,
  isLoading: true,
  loadError: null,
  saveError: null,
}

function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  switch (action.type) {
    case 'load_success':
      return {
        snapshot: action.snapshot,
        standing: action.standing,
        options: action.options,
        transferStatus: action.transferStatus,
        ownSale: action.ownSale,
        callStartedAt: action.callStartedAt,
        savedLabel: action.savedLabel,
        dispositionId: action.dispositionId,
        loadError: action.loadError,
        saveError: null,
        isLoading: false,
      }
    case 'load_error':
      return {
        ...initialWorkspace,
        isLoading: false,
        loadError: action.message,
      }
    case 'set_disposition_id':
      return { ...state, dispositionId: action.dispositionId, saveError: null }
    case 'save_start':
      return { ...state, saveError: null }
    case 'save_success':
      return {
        ...state,
        savedLabel: action.savedLabel,
        standing: action.standing,
        saveError: null,
      }
    case 'details_saved':
      return { ...state, snapshot: action.snapshot }
    case 'save_error':
      return { ...state, saveError: action.message }
    default:
      return state
  }
}

function softLoadHint(
  qualification: Awaited<ReturnType<typeof loadCloserWorkspace>>['qualification'],
  open: boolean
): string | null {
  if (!qualification && open) {
    return 'No lead details found for this call.'
  }
  return null
}

type TodaysLoad =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; rows: TodaysDispositionRow[] }

function useCloserTodaysDispositions(refreshKey = 0): TodaysLoad {
  const pathname = usePathname()
  const { user, status: userStatus } = useCurrentUser()
  const desk = deskRoleFromPath(pathname)
  const stage = user ? statsStageForUser(user.roles, desk) : null
  const [fetchState, setFetchState] = useState<TodaysLoad>({ status: 'loading' })

  useEffect(() => {
    if (userStatus === 'loading' || !user) return

    let cancelled = false

    waitForMocking()
      .then(() => withSession((token) => fetchTodaysStats(token, stage)))
      .then((payload) => {
        if (cancelled) return
        setFetchState({ status: 'ready', rows: closerTodaysRowsFromStats(payload) })
      })
      .catch((err) => {
        if (cancelled) return
        setFetchState({
          status: 'error',
          message:
            err instanceof Error
              ? err.message
              : "Unable to load today's dispositions.",
        })
      })

    return () => {
      cancelled = true
    }
  }, [refreshKey, userStatus, user, stage])

  // Derived, not effect-driven: a missing user is known synchronously once
  // userStatus settles, so there's nothing to wait a render on.
  if (!user && userStatus !== 'loading') {
    return { status: 'error', message: "Unable to load today's dispositions." }
  }
  return fetchState
}

export function CloserActiveCallScreen({
  interactionId,
  transferId,
}: {
  interactionId?: string
  transferId?: string
} = {}) {
  return (
    <RequireRole role="closer">
      <CloserActiveCallContent interactionId={interactionId} transferId={transferId} />
    </RequireRole>
  )
}

function CloserActiveCallContent({
  interactionId,
  transferId,
}: {
  interactionId?: string
  transferId?: string
}) {
  const [todaysRefreshKey, setTodaysRefreshKey] = useState(0)
  const todays = useCloserTodaysDispositions(todaysRefreshKey)

  const refreshTodays = useCallback(() => {
    setTodaysRefreshKey((n) => n + 1)
  }, [])

  const todaysTable = (
    <TodaysDispositionTable
      rows={todays.status === 'ready' ? todays.rows : []}
      isLoading={todays.status === 'loading'}
      error={todays.status === 'error' ? todays.message : null}
    />
  )

  if (!interactionId) {
    return (
      <PageShell title="Active Call">
        <Alert>
          No active transfer. Open a row from the Queue to accept the offer and load the workspace.
        </Alert>
        <div className="mt-4">{todaysTable}</div>
      </PageShell>
    )
  }

  return (
    <CloserActiveCallWorkspace
      key={`${interactionId}:${transferId ?? 'own-sale'}`}
      interactionId={interactionId}
      transferId={transferId}
      todaysTable={todaysTable}
      onDispositionSaved={refreshTodays}
    />
  )
}

function CloserActiveCallWorkspace({
  interactionId,
  transferId,
  todaysTable,
  onDispositionSaved,
}: {
  interactionId: string
  /** None on a call the closer started as an Own Sale. */
  transferId?: string
  todaysTable: ReactNode
  onDispositionSaved: () => void
}) {
  const { user, status: userStatus } = useCurrentUser()
  const [workspace, dispatch] = useReducer(workspaceReducer, initialWorkspace)
  const [isSaving, setIsSaving] = useState(false)
  // Null until the cart has loaded, so a failed load leaves the call to the server.
  const [cartSaved, setCartSaved] = useState<boolean | null>(null)
  const [editingDetails, setEditingDetails] = useState(false)
  // A callback locks the saved card, so the card reloads after each outcome.
  const [outcomeSaves, setOutcomeSaves] = useState(0)

  const {
    snapshot,
    standing,
    options,
    dispositionId,
    savedLabel,
    transferStatus,
    ownSale,
    callStartedAt,
    isLoading,
    loadError,
    saveError,
  } = workspace

  useEffect(() => {
    let cancelled = false

    if (userStatus === 'loading') return
    if (!user) {
      dispatch({
        type: 'load_error',
        message: 'Unable to identify the current closer. Please sign in again.',
      })
      return
    }

    waitForMocking()
      .then(() =>
        withSession((token) =>
          loadCloserWorkspace(
            { interactionId, transferId: transferId ?? null, closerUserId: user.id },
            token
          )
        )
      )
      .then((loaded) => {
        if (cancelled) return

        const latest = latestCloserDisposition(loaded.captured)
        const nextLabel = latest?.label ?? null
        const transferStatus = loaded.transfer?.status ?? null

        dispatch({
          type: 'load_success',
          snapshot: snapshotFromQualification(loaded.qualification),
          standing: loaded.standing,
          options: loaded.options,
          transferStatus,
          ownSale: loaded.ownSale,
          callStartedAt: loaded.startedAt,
          savedLabel: nextLabel,
          dispositionId: latest?.disposition_id ?? '',
          loadError: softLoadHint(
            loaded.qualification,
            loaded.ownSale || transferStatus === 'accepted'
          ),
        })
      })
      .catch((err) => {
        if (cancelled) return
        dispatch({
          type: 'load_error',
          message:
            err instanceof Error
              ? err.message
              : 'Unable to load the accepted transfer workspace.',
        })
      })

    return () => {
      cancelled = true
    }
  }, [interactionId, transferId, user, userStatus])

  async function handleSaveDisposition() {
    if (!dispositionId || isSaving) return

    setIsSaving(true)
    dispatch({ type: 'save_start' })
    try {
      await waitForMocking()
      await withSession((token) =>
        createCloserDisposition(interactionId, { disposition_id: dispositionId }, token)
      )
      const list = await withSession((token) =>
        getInteractionDispositions(interactionId, token)
      )
      const latest = latestCloserDisposition(list.items)
      const nextLabel = latest?.label ?? null
      dispatch({
        type: 'save_success',
        savedLabel: nextLabel,
        standing: { locked: list.locked },
      })
      setOutcomeSaves((n) => n + 1)
      onDispositionSaved()
    } catch (err) {
      dispatch({
        type: 'save_error',
        message: err instanceof Error ? err.message : 'Unable to save the disposition.',
      })
    } finally {
      setIsSaving(false)
    }
  }

  // An Own Sale call is the closer's from the start, as an accepted transfer is.
  const open = ownSale || transferStatus === 'accepted'
  const statusText = isLoading
    ? transferId
      ? 'Accepting transfer…'
      : 'Loading…'
    : ownSale
      ? 'Own Sale'
      : transferStatus
        ? (STATUS_LABEL[transferStatus] ?? 'Transfer Accepted')
        : 'Transfer not found'
  const closed = closedCall(standing)
  const dispositionLocked = isLoading || !open || closed !== null
  const canEditDetails = !isLoading && open && !closed && snapshot
  // The clock counts from the accept or the Own Sale start, so a call with an
  // outcome, such as a callback opened days later, shows none.
  const live = open && !savedLabel
  const lockedMessage =
    isLoading || open ? null : 'Disposition unlocks after the transfer is accepted.'

  return (
    <PageShell
      title="Active Call"
      actions={
        <TransferStatusBadge
          key={live ? (callStartedAt ?? 'pending') : 'pending'}
          label={statusText}
          tone={!isLoading && !open ? 'neutral' : 'accepted'}
          startedAt={live ? callStartedAt : null}
        />
      }
    >
      {loadError && (
        <div className="mb-4">
          <Alert>{loadError}</Alert>
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
        <div className="flex flex-col gap-4 lg:col-span-7">
          <QualificationSnapshot
            snapshot={snapshot}
            isLoading={isLoading}
            action={
              canEditDetails ? (
                <MuiButton
                  size="small"
                  variant="outlined"
                  color="primary"
                  onClick={() => setEditingDetails(true)}
                  startIcon={<Pencil className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />}
                  aria-label="Edit lead details"
                >
                  Edit
                </MuiButton>
              ) : null
            }
          />
          {todaysTable}
        </div>
        <div className="flex flex-col gap-4 lg:col-span-5">
          <CartPaymentCard
            interactionId={interactionId}
            enabled={!isLoading && open}
            readOnly={closed !== null}
            reloadKey={outcomeSaves}
            onCartLoaded={setCartSaved}
          />
          <CloserDispositionCard
            options={options}
            dispositionId={dispositionId}
            onDispositionChange={(id) => dispatch({ type: 'set_disposition_id', dispositionId: id })}
            onSave={handleSaveDisposition}
            isSaving={isSaving}
            disabled={dispositionLocked}
            savedLabel={savedLabel}
            cartSaved={cartSaved}
            closed={closed}
            error={saveError ?? lockedMessage}
          />
        </div>
      </div>

      {editingDetails && snapshot && (
        <FronterDetailsDialog
          interactionId={interactionId}
          snapshot={snapshot}
          onClose={() => setEditingDetails(false)}
          onSaved={(saved) => {
            setEditingDetails(false)
            dispatch({ type: 'details_saved', snapshot: snapshotFromQualification(saved) })
          }}
        />
      )}
    </PageShell>
  )
}
