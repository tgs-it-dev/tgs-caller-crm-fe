'use client'

import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import type { AvailableCloserItem } from '@/lib/transfers'
import { ClosersTable } from './ClosersTable'
import { OverrideReason } from './OverrideReason'

/**
 * What to say under the buttons, most-blocking first.
 *
 * Telling somebody to complete the checklist while the lead is flagged
 * do-not-call sends them down a road that ends nowhere. The old copy had this
 * inverted: it advised an override when fields were missing, and asked for
 * fields when nothing was.
 */
function whyTransferIsUnavailable({
  dncFlagged,
  dispositionLabel,
  transferable,
  canTransfer,
  needsOverride,
  hasReason,
}: {
  dncFlagged: boolean
  dispositionLabel: string | null
  /** The chosen outcome's `allows_transfer`, which is not the same as `canTransfer`. */
  transferable: boolean
  canTransfer: boolean
  needsOverride: boolean
  hasReason: boolean
}): string {
  if (dncFlagged) {
    return 'Do Not Call is flagged — transfer is blocked, but you can still end the call.'
  }
  if (!dispositionLabel) return 'Choose a disposition to continue.'
  // Before the override line, not after: an incomplete checklist is also true
  // of a terminal outcome, and offering an override for a call that can never
  // be transferred sends the fronter to fill in fields for nothing.
  if (!transferable) {
    return `“${dispositionLabel}” ends the call here. Use Save & End Call, or pick another outcome.`
  }
  if (canTransfer) return 'Ready to transfer, or save and end the call here.'
  if (needsOverride && !hasReason) {
    return 'Complete the checklist, or add an override reason to transfer anyway.'
  }
  return 'Complete consent and the checklist to transfer.'
}

export function TransferPanel({
  closers,
  canTransfer,
  needsOverride,
  dncFlagged = false,
  overrideReason,
  onOverrideReasonChange,
  isTransferring,
  transferError,
  transferStatus,
  onTransfer,
  canEnd,
  isEnding,
  endedAs,
  onEndCall,
  dispositionLabel,
  dispositionAllowsTransfer,
}: {
  closers: AvailableCloserItem[]
  canTransfer: boolean
  needsOverride: boolean
  dncFlagged?: boolean
  overrideReason: string
  onOverrideReasonChange: (value: string) => void
  isTransferring: boolean
  transferError: string | null
  transferStatus: string | null
  onTransfer: () => void
  canEnd: boolean
  isEnding: boolean
  /** The outcome this call was closed with, once Save & End Call has run. */
  endedAs: string | null
  onEndCall: () => void
  dispositionLabel: string | null
  dispositionAllowsTransfer: boolean
}) {
  const busy = isTransferring || isEnding
  const settled = Boolean(transferStatus || endedAs)
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

      {endedAs && <p className="mt-3 text-sm text-status-green">Call saved as “{endedAs}”.</p>}

      {transferError && (
        <div className="mt-3">
          <Alert>{transferError}</Alert>
        </div>
      )}

      <div className="mt-5 space-y-3">
        <Button type="button" disabled={!canTransfer || busy || settled} onClick={onTransfer}>
          {isTransferring ? 'Transferring…' : 'Transfer to Closer'}
        </Button>
        {/* Always offered, never hidden. A qualified lead with no closer free is
            refused by the server, and a fronter with nowhere to record that call
            would be left holding it. */}
        <Button
          type="button"
          variant="secondary"
          disabled={!canEnd || busy || settled}
          onClick={onEndCall}
        >
          {isEnding ? 'Saving…' : 'Save & End Call'}
        </Button>
        <p className="text-center text-xs text-slate">
          {settled
            ? 'This call is closed. Pick another from the Queue.'
            : whyTransferIsUnavailable({
                dncFlagged,
                dispositionLabel,
                transferable: dispositionAllowsTransfer,
                canTransfer,
                needsOverride,
                hasReason: overrideReason.trim().length > 0,
              })}
        </p>
      </div>

      {/* Only when an override would actually be sent. Offered on a complete
          checklist it invites a justification the transfer never carries. */}
      {!dncFlagged && needsOverride && (
        <OverrideReason reason={overrideReason} onReasonChange={onOverrideReasonChange} />
      )}
    </div>
  )
}
