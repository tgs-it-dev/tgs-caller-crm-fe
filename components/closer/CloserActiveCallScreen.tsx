'use client'

import { useCallback, useEffect, useReducer, useState } from 'react'
import { RequireRole } from '@/components/auth/RequireRole'
import { CloserDispositionCard } from '@/components/closer/CloserDispositionCard'
import { QualificationSnapshot } from '@/components/closer/QualificationSnapshot'
import { TodaysDispositionTable } from '@/components/closer/TodaysDispositionTable'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { PageShell } from '@/components/ui/PageShell'
import { readToken } from '@/lib/auth'
import {
  CLOSER_DEFAULT_INTERACTION_ID,
  createCloserDisposition,
  getLatestQualification,
  getTransfer,
  latestCloserDisposition,
  listCloserDispositionOptions,
  listInteractionDispositions,
  listTodaysDispositions,
  snapshotFromQualification,
  transferIdForInteraction,
  type CloserQualificationSnapshot,
  type DispositionResponse,
  type TodaysDispositionRow,
  type TransferResponse,
} from '@/lib/closer'
import { waitForMocking } from '@/lib/mockReady'

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

function loadErrorFor(
  qualification: Awaited<ReturnType<typeof getLatestQualification>>,
  transfer: Awaited<ReturnType<typeof getTransfer>>
): string | null {
  if (!qualification && !transfer) {
    return 'No accepted transfer or qualification snapshot found for this interaction.'
  }
  if (!transfer) return 'No transfer found for this interaction.'
  if (!qualification) return 'No qualification snapshot found for this interaction.'
  return null
}

export function CloserActiveCallScreen({
  interactionId = CLOSER_DEFAULT_INTERACTION_ID,
}: {
  interactionId?: string
}) {
  return (
    <RequireRole role="closer">
      <CloserActiveCallContent interactionId={interactionId} />
    </RequireRole>
  )
}

function CloserActiveCallContent({ interactionId }: { interactionId: string }) {
  // Survives workspace URL changes so Today's Disposition keeps saved labels.
  const [dispositionLabels, setDispositionLabels] = useState<Record<string, string | null>>({})
  const rows: TodaysDispositionRow[] = listTodaysDispositions(dispositionLabels)
  const onDispositionLabel = useCallback((id: string, label: string | null) => {
    setDispositionLabels((prev) => ({ ...prev, [id]: label }))
  }, [])

  return (
    <CloserActiveCallWorkspace
      key={interactionId}
      interactionId={interactionId}
      rows={rows}
      onDispositionLabel={onDispositionLabel}
    />
  )
}

function CloserActiveCallWorkspace({
  interactionId,
  rows,
  onDispositionLabel,
}: {
  interactionId: string
  rows: TodaysDispositionRow[]
  onDispositionLabel: (interactionId: string, label: string | null) => void
}) {
  const transferId = transferIdForInteraction(interactionId)
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
    const token = readToken()
    if (!token) return

    // Remount via key={interactionId} resets reducer to initialWorkspace — no
    // synchronous setState cascade here (react-hooks/set-state-in-effect).
    waitForMocking()
      .then(async () => {
        const [qualification, transfer, catalog, captured] = await Promise.all([
          getLatestQualification(interactionId, token),
          getTransfer(transferId, token),
          listCloserDispositionOptions(token),
          listInteractionDispositions(interactionId, token),
        ])
        if (cancelled) return

        const latest = latestCloserDisposition(captured)
        const nextLabel = latest?.label ?? null

        dispatch({
          type: 'load_success',
          snapshot: snapshotFromQualification(qualification),
          options: catalog,
          transferStatus: transfer?.status ?? null,
          savedLabel: nextLabel,
          dispositionId: latest?.disposition_id ?? '',
          loadError: loadErrorFor(qualification, transfer),
        })
        onDispositionLabel(interactionId, nextLabel)
      })
      .catch(() => {
        if (cancelled) return
        dispatch({
          type: 'load_error',
          message: 'Unable to load the accepted transfer workspace.',
        })
      })

    return () => {
      cancelled = true
    }
  }, [interactionId, transferId, onDispositionLabel])

  async function handleSaveDisposition() {
    if (!dispositionId || isSaving) return

    const token = readToken()
    if (!token) {
      dispatch({
        type: 'save_error',
        message: 'Your session expired. Please sign in again.',
      })
      return
    }

    setIsSaving(true)
    dispatch({ type: 'save_start' })
    try {
      await waitForMocking()
      await createCloserDisposition(interactionId, { disposition_id: dispositionId }, token)
      const captured = await listInteractionDispositions(interactionId, token)
      const latest = latestCloserDisposition(captured)
      const nextLabel = latest?.label ?? null
      dispatch({ type: 'save_success', savedLabel: nextLabel })
      onDispositionLabel(interactionId, nextLabel)
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
    ? 'Transfer Accepted'
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
          <TodaysDispositionTable rows={rows} />
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
