'use client'

import { useEffect, useState } from 'react'
import { RequireRole } from '@/components/auth/RequireRole'
import { useCurrentUser } from '@/components/auth/CurrentUserProvider'
import { CloserDispositionCard } from '@/components/closer/CloserDispositionCard'
import { QualificationSnapshot } from '@/components/closer/QualificationSnapshot'
import { TodaysDispositionTable } from '@/components/closer/TodaysDispositionTable'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { PageShell } from '@/components/ui/PageShell'
import { readToken } from '@/lib/auth'
import {
  CLOSER_DEFAULT_INTERACTION_ID,
  CLOSER_DEFAULT_TRANSFER_ID,
  MOCK_CLOSER_SNAPSHOT,
  createCloserDisposition,
  getLatestQualification,
  getTransfer,
  latestCloserDisposition,
  listCloserDispositionOptions,
  listInteractionDispositions,
  listTodaysDispositions,
  snapshotFromQualification,
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
  const { user } = useCurrentUser()
  const transferId =
    interactionId === CLOSER_DEFAULT_INTERACTION_ID
      ? CLOSER_DEFAULT_TRANSFER_ID
      : `transfer-for-${interactionId}`

  const [snapshot, setSnapshot] = useState<CloserQualificationSnapshot>(MOCK_CLOSER_SNAPSHOT)
  const [options, setOptions] = useState<DispositionResponse[]>([])
  const [dispositionId, setDispositionId] = useState('')
  const [savedLabel, setSavedLabel] = useState<string | null>(null)
  const [rows, setRows] = useState<TodaysDispositionRow[]>(() => listTodaysDispositions())
  const [transferStatus, setTransferStatus] = useState<TransferStatusLabel>('accepted')
  const [isSaving, setIsSaving] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const token = readToken()
    if (!token) return

    waitForMocking()
      .then(async () => {
        const [qualification, transfer, catalog, captured] = await Promise.all([
          getLatestQualification(interactionId, token),
          getTransfer(transferId, token),
          listCloserDispositionOptions(token),
          listInteractionDispositions(interactionId, token),
        ])
        if (cancelled) return

        setSnapshot(snapshotFromQualification(qualification))
        setOptions(catalog)

        if (transfer) {
          setTransferStatus(transfer.status)
        }

        const latest = latestCloserDisposition(captured)
        setSavedLabel(latest?.label ?? null)
        if (latest) {
          setDispositionId(latest.disposition_id)
        }

        const labels: Record<string, string | null> = {}
        if (latest) labels[interactionId] = latest.label
        setRows(listTodaysDispositions(labels))
      })
      .catch(() => {
        if (cancelled) return
        setLoadError('Unable to load the accepted transfer workspace.')
        setSnapshot(MOCK_CLOSER_SNAPSHOT)
      })

    return () => {
      cancelled = true
    }
  }, [interactionId, transferId])

  async function handleSaveDisposition() {
    const token = readToken()
    if (!token || !user || !dispositionId || isSaving) return

    setIsSaving(true)
    setSaveError(null)
    try {
      await waitForMocking()
      await createCloserDisposition(interactionId, { disposition_id: dispositionId }, token)
      const captured = await listInteractionDispositions(interactionId, token)
      const latest = latestCloserDisposition(captured)
      setSavedLabel(latest?.label ?? null)

      const labels: Record<string, string | null> = {}
      if (latest) labels[interactionId] = latest.label
      setRows(listTodaysDispositions(labels))
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Unable to save the disposition.')
    } finally {
      setIsSaving(false)
    }
  }

  const statusText = STATUS_LABEL[transferStatus] ?? 'Transfer Accepted'
  const dispositionLocked = transferStatus !== 'accepted'

  return (
    <PageShell
      title="Active Call"
      actions={
        <Badge tone="accepted" dot>
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
          <QualificationSnapshot snapshot={snapshot} />
          <TodaysDispositionTable rows={rows} />
        </div>
        <div className="lg:col-span-5">
          <CloserDispositionCard
            options={options}
            dispositionId={dispositionId}
            onDispositionChange={setDispositionId}
            onSave={handleSaveDisposition}
            isSaving={isSaving}
            disabled={dispositionLocked}
            savedLabel={savedLabel}
            error={
              saveError ??
              (dispositionLocked
                ? 'Disposition unlocks after the transfer is accepted.'
                : null)
            }
          />
        </div>
      </div>
    </PageShell>
  )
}
