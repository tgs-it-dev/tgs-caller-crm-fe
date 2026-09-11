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
  MOCK_CLOSER_SNAPSHOT,
  acceptTransfer,
  getLatestQualification,
  listTodaysDispositions,
  snapshotFromQualification,
  type CloserQualificationSnapshot,
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
  const [snapshot, setSnapshot] = useState<CloserQualificationSnapshot>(MOCK_CLOSER_SNAPSHOT)
  const [rows] = useState<TodaysDispositionRow[]>(() => listTodaysDispositions())
  const [transferStatus, setTransferStatus] = useState<TransferStatusLabel>('accepted')
  const [isActing, setIsActing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const token = readToken()
    if (!token) return

    waitForMocking()
      .then(() => getLatestQualification(interactionId, token))
      .then((qualification) => {
        if (cancelled) return
        setSnapshot(snapshotFromQualification(qualification))
      })
      .catch(() => {
        if (cancelled) return
        setSnapshot(MOCK_CLOSER_SNAPSHOT)
      })

    return () => {
      cancelled = true
    }
  }, [interactionId])

  async function handleTransferAction() {
    const token = readToken()
    if (!token || !user || isActing) return

    setIsActing(true)
    setError(null)
    try {
      await waitForMocking()
      // Demo path: accept the seeded offered transfer for this interaction.
      const transfer = await acceptTransfer(
        `transfer-for-${interactionId}`,
        { closer_user_id: user.id },
        token
      )
      setTransferStatus(transfer.status)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to complete the action.')
    } finally {
      setIsActing(false)
    }
  }

  const statusText = STATUS_LABEL[transferStatus] ?? 'Transfer Accepted'

  return (
    <PageShell
      title="Active Call"
      actions={
        <Badge tone="done" dot>
          {statusText}
        </Badge>
      }
    >
      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
        <div className="flex flex-col gap-4 lg:col-span-7">
          <QualificationSnapshot snapshot={snapshot} />
          <TodaysDispositionTable rows={rows} />
        </div>
        <div className="lg:col-span-5">
          <CloserDispositionCard
            onTransfer={handleTransferAction}
            isTransferring={isActing}
          />
        </div>
      </div>
    </PageShell>
  )
}
