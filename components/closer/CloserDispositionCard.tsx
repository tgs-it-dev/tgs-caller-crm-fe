'use client'

import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import type { ClosedCall, DispositionResponse } from '@/lib/closer'

export function CloserDispositionCard({
  options,
  dispositionId,
  onDispositionChange,
  onSave,
  isSaving = false,
  disabled = false,
  savedLabel = null,
  cartSaved = null,
  closed = null,
  error = null,
}: {
  options: DispositionResponse[]
  dispositionId: string
  onDispositionChange: (dispositionId: string) => void
  onSave: () => void
  isSaving?: boolean
  disabled?: boolean
  /** Latest closer disposition label already on the interaction record. */
  savedLabel?: string | null
  /** Whether this call has a saved cart; null until that is known. */
  cartSaved?: boolean | null
  /** The call is closed to its closer: the saved outcome and where it stands, no form. */
  closed?: ClosedCall | null
  error?: string | null
}) {
  const selected = options.find((option) => option.id === dispositionId)
  const needsCart = Boolean(selected?.counts_as_sale) && cartSaved === false
  const canSave = Boolean(dispositionId) && !disabled && !isSaving && !needsCart

  if (closed) {
    return (
      <div className="flex h-full flex-col rounded-xl border-hairline border-slate bg-white p-6">
        <h2 className="border-b-hairline border-light-grey pb-4 text-lg font-medium leading-[120%] text-ink">
          Closer Disposition
        </h2>
        <div className="mt-4 flex flex-col gap-2" role="status">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm leading-[150%] text-body-text">
              Outcome: <span className="font-medium text-ink">{savedLabel ?? '-'}</span>
            </p>
            <Badge tone={closed.tone}>{closed.badge}</Badge>
          </div>
          <p className="text-sm leading-[150%] text-slate">{closed.message}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col rounded-xl border-hairline border-slate bg-white p-6">
      <h2 className="border-b-hairline border-light-grey pb-4 text-lg font-medium leading-[120%] text-ink">
        Closer Disposition
      </h2>

      <div className="mt-4 flex flex-1 flex-col gap-4">
        {savedLabel && (
          <p className="text-sm leading-[150%] text-body-text">
            Saved outcome: <span className="font-medium text-ink">{savedLabel}</span>
          </p>
        )}

        <Select
          aria-label="Select closer disposition"
          label="Disposition"
          value={dispositionId}
          onChange={(e) => onDispositionChange(e.target.value)}
          disabled={disabled || isSaving}
        >
          <option value="" disabled>
            Select disposition
          </option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </Select>

        {needsCart && (
          <p className="text-sm leading-[150%] text-body-text">
            Save the card before recording a sale.
          </p>
        )}

        {error && <Alert>{error}</Alert>}
      </div>

      <div className="mt-6">
        <Button
          type="button"
          onClick={onSave}
          disabled={!canSave}
          isLoading={isSaving}
          loadingText="Saving…"
        >
          Save Disposition
        </Button>
      </div>
    </div>
  )
}
