'use client'

import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import type { AvailableCloserItem } from '@/lib/transfers'
import { ClosersTable } from './ClosersTable'
import { OverrideReason } from './OverrideReason'

export function TransferPanel({
  closers,
  canTransfer,
  needsOverride,
  overrideReason,
  onOverrideReasonChange,
  isTransferring,
  transferError,
  transferStatus,
  onTransfer,
}: {
  closers: AvailableCloserItem[]
  canTransfer: boolean
  needsOverride: boolean
  overrideReason: string
  onOverrideReasonChange: (value: string) => void
  isTransferring: boolean
  transferError: string | null
  transferStatus: string | null
  onTransfer: () => void
}) {
  return (
    <div className="rounded-xl border-hairline border-slate bg-white p-6">
      <h2 className="border-b border-slate/20 pb-4 text-lg font-medium leading-[120%] text-ink">
        Transfer
      </h2>

      <p className="mt-4 text-sm font-medium text-ink">Available Closers</p>
      <div className="mt-3">
        <ClosersTable closers={closers} />
      </div>
      {/* <p className="mt-2 text-xs text-slate">
        Read-only — the server assigns an available closer when you transfer.
      </p> */}

      {transferStatus && (
        <p className="mt-3 text-sm text-status-green">Transfer {transferStatus}</p>
      )}

      {transferError && (
        <div className="mt-3">
          <Alert>{transferError}</Alert>
        </div>
      )}

      <div className="mt-5">
        <Button type="button" disabled={!canTransfer || isTransferring} onClick={onTransfer}>
          {isTransferring ? 'Transferring…' : 'Transfer to Closer'}
        </Button>
        <p className="mt-2 text-center text-xs text-slate">
          {needsOverride
            ? "Add an override reason if the checklist isn't complete."
            : 'Complete consent, disposition, and vehicle fields to transfer.'}
        </p>
      </div>

      <OverrideReason reason={overrideReason} onReasonChange={onOverrideReasonChange} />
    </div>
  )
}
