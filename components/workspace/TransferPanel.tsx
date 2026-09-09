'use client'

import { useMemo, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { getCurrentUser, readToken } from '@/lib/auth'
import { waitForMocking } from '@/lib/mockReady'
import { createTransfer } from '@/lib/transfers'
import { ClosersTable, MOCK_CLOSERS } from './ClosersTable'
import { OverrideReason } from './OverrideReason'
import { Pagination } from './Pagination'

const PAGE_SIZE = 5

export function TransferPanel({ interactionId }: { interactionId: string }) {
  const [page, setPage] = useState(1)
  const [overrideReason, setOverrideReason] = useState('')
  const [isTransferring, setIsTransferring] = useState(false)
  const [transferError, setTransferError] = useState<string | null>(null)
  const [transferStatus, setTransferStatus] = useState<string | null>(null)

  const totalPages = Math.max(1, Math.ceil(MOCK_CLOSERS.length / PAGE_SIZE))
  const pageClosers = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return MOCK_CLOSERS.slice(start, start + PAGE_SIZE)
  }, [page])
  const rangeStart = MOCK_CLOSERS.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(page * PAGE_SIZE, MOCK_CLOSERS.length)

  async function handleTransfer() {
    const token = readToken()
    if (!token || isTransferring || transferStatus) return

    setIsTransferring(true)
    setTransferError(null)
    try {
      await waitForMocking()
      const user = await getCurrentUser(token)
      const transfer = await createTransfer(
        { interaction_id: interactionId, fronter_user_id: user.id },
        token
      )
      setTransferStatus(transfer.status)
    } catch (err) {
      setTransferError(err instanceof Error ? err.message : 'Unable to transfer. Please try again.')
    } finally {
      setIsTransferring(false)
    }
  }

  return (
    <div className="rounded-xl border border-slate bg-white p-6" style={{ borderWidth: '0.5px' }}>
      <h2 className="border-b border-slate/20 pb-4 text-lg font-medium leading-[120%] text-ink">Transfer</h2>

      <p className="mt-4 text-sm font-medium text-ink">Available Closers</p>
      <ClosersTable closers={pageClosers} />
      <Pagination
        page={page}
        totalPages={totalPages}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        onPrevious={() => setPage((prev) => Math.max(1, prev - 1))}
        onNext={() => setPage((prev) => Math.min(totalPages, prev + 1))}
      />

      <div className="mt-5">
        {transferError && <Alert>{transferError}</Alert>}
        {transferStatus && (
          <p className="mb-3 text-center text-sm text-status-green">Transfer {transferStatus}</p>
        )}
        <Button
          type="button"
          onClick={handleTransfer}
          disabled={isTransferring || !!transferStatus}
          isLoading={isTransferring}
          loadingText="Transferring…"
        >
          Transfer to Closer
        </Button>
        <p className="mt-2 text-center text-xs text-slate">
          {overrideReason.trim()
            ? 'Override reason will be included when qualification is saved.'
            : "Add an override reason if the checklist isn't complete."}
        </p>
      </div>

      <OverrideReason reason={overrideReason} onReasonChange={setOverrideReason} />
    </div>
  )
}
