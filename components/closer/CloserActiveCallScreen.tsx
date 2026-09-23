'use client'

import { useCallback, useEffect, useReducer, useState, type ReactNode } from 'react'
import { RequireRole } from '@/components/auth/RequireRole'
import { useCurrentUser } from '@/components/auth/CurrentUserProvider'
import { CloserDispositionCard } from '@/components/closer/CloserDispositionCard'
import { QualificationSnapshot } from '@/components/closer/QualificationSnapshot'
import { TodaysDispositionTable } from '@/components/closer/TodaysDispositionTable'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { PageShell } from '@/components/ui/PageShell'
import {
  closerTodaysRowsFromStats,
  createCloserDisposition,
  fetchCloserTodaysStats,
  latestCloserDisposition,
  listInteractionDispositions,
  loadCloserWorkspace,
  snapshotFromQualification,
  type CloserQualificationSnapshot,
  type DispositionResponse,
  type TodaysDispositionRow,
  type TransferResponse,
} from '@/lib/closer'
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

type WorkspaceState = {
  snapshot: CloserQualificationSnapshot | null
  options: DispositionResponse[]
  dispositionId: string
  savedLabel: string | null
  transferStatus: TransferStatusLabel | null
  isLoading: boolean
  loadError: string | null
  saveError: string | null
}

type WorkspaceAction =
  | {
      type: 'load_success'
      snapshot: CloserQualificationSnapshot | null
      options: DispositionResponse[]
      transferStatus: TransferStatusLabel | null
      savedLabel: string | null
      dispositionId: string
      loadError: string | null
    }
  | { type: 'load_error'; message: string }
  | { type: 'set_disposition_id'; dispositionId: string }
  | { type: 'save_start' }
  | { type: 'save_success'; savedLabel: string | null }
  | { type: 'save_error'; message: string }

const initialWorkspace: WorkspaceState = {
  snapshot: null,
  options: [],
  dispositionId: '',
  savedLabel: null,
  transferStatus: null,
  isLoading: true,
  loadError: null,
  saveError: null,
}

function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  switch (action.type) {
    case 'load_success':
      return {
        snapshot: action.snapshot,
        options: action.options,
        transferStatus: action.transferStatus,
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
      return { ...state, savedLabel: action.savedLabel, saveError: null }
    case 'save_error':
      return { ...state, saveError: action.message }
    default:
      return state
  }
}

function softLoadHint(
  qualification: Awaited<ReturnType<typeof loadCloserWorkspace>>['qualification'],
  transfer: TransferResponse
): string | null {
  if (!qualification && transfer.status === 'accepted') {
    return 'No qualification snapshot found for this interaction.'
  }
  return null
}

type TodaysLoad =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; rows: TodaysDispositionRow[] }

function useCloserTodaysDispositions(refreshKey = 0) {
  const [load, setLoad] = useState<TodaysLoad>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false

    waitForMocking()
      .then(() => withSession(fetchCloserTodaysStats))
      .then((payload) => {
        if (cancelled) return
        setLoad({ status: 'ready', rows: closerTodaysRowsFromStats(payload) })
      })
      .catch((err) => {
        if (cancelled) return
        setLoad({
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
  }, [refreshKey])

  return load
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

  if (!interactionId || !transferId) {
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
      key={`${interactionId}:${transferId}`}
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
  transferId: string
  todaysTable: ReactNode
  onDispositionSaved: () => void
}) {
  const { user, status: userStatus } = useCurrentUser()
  const [workspace, dispatch] = useReducer(workspaceReducer, initialWorkspace)
  const [isSaving, setIsSaving] = useState(false)

  const {
    snapshot,
    options,
    dispositionId,
    savedLabel,
    transferStatus,
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
            { interactionId, transferId, closerUserId: user.id },
            token
          )
        )
      )
      .then(({ transfer, qualification, options: catalog, captured }) => {
        if (cancelled) return

        const latest = latestCloserDisposition(captured)
        const nextLabel = latest?.label ?? null

        dispatch({
          type: 'load_success',
          snapshot: snapshotFromQualification(qualification),
          options: catalog,
          transferStatus: transfer.status,
          savedLabel: nextLabel,
          dispositionId: latest?.disposition_id ?? '',
          loadError: softLoadHint(qualification, transfer),
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
      const captured = await withSession((token) =>
        listInteractionDispositions(interactionId, token)
      )
      const latest = latestCloserDisposition(captured)
      const nextLabel = latest?.label ?? null
      dispatch({ type: 'save_success', savedLabel: nextLabel })
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

  const statusText = isLoading
    ? 'Accepting transfer…'
    : transferStatus
      ? (STATUS_LABEL[transferStatus] ?? 'Transfer Accepted')
      : 'Transfer not found'
  const dispositionLocked = isLoading || transferStatus !== 'accepted'
  const lockedMessage =
    isLoading || transferStatus === 'accepted'
      ? null
      : 'Disposition unlocks after the transfer is accepted.'

  return (
    <PageShell
      title="Active Call"
      actions={
        <Badge
          tone={!isLoading && transferStatus !== 'accepted' ? 'neutral' : 'accepted'}
          dot
        >
          {statusText}
        </Badge>
      }
    >
      {loadError && (
        <div className="mb-4">
          <Alert>{loadError}</Alert>
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
        <div className="flex flex-col gap-4 lg:col-span-7">
          <QualificationSnapshot snapshot={snapshot} isLoading={isLoading} />
          {todaysTable}
        </div>
        <div className="lg:col-span-5">
          <CloserDispositionCard
            options={options}
            dispositionId={dispositionId}
            onDispositionChange={(id) => dispatch({ type: 'set_disposition_id', dispositionId: id })}
            onSave={handleSaveDisposition}
            isSaving={isSaving}
            disabled={dispositionLocked}
            savedLabel={savedLabel}
            error={saveError ?? lockedMessage}
          />
        </div>
      </div>
    </PageShell>
  )
}
