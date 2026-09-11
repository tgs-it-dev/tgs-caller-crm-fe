'use client'

import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import type { DispositionResponse } from '@/lib/closer'

export function CloserDispositionCard({
  options,
  dispositionId,
  onDispositionChange,
  onSave,
  isSaving = false,
  disabled = false,
  savedLabel = null,
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
  error?: string | null
}) {
  const canSave = Boolean(dispositionId) && !disabled && !isSaving

  return (
    <div className="flex h-full flex-col rounded-xl border-hairline border-slate bg-white p-6">
      <h2 className="border-b-hairline border-light-grey pb-4 text-lg font-medium leading-[120%] text-ink">
        Closer Disposition
      </h2>

      <div className="mt-4 flex flex-1 flex-col gap-4">
        {savedLabel && (
          <p className="text-sm leading-[150%] text-body-text">
            Saved on interaction:{' '}
            <span className="font-medium text-ink">{savedLabel}</span>
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
