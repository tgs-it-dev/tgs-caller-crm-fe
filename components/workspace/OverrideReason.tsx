'use client'

import { useState } from 'react'
import { Textarea } from '@/components/ui/Textarea'

function ChevronUpIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
      <path
        fillRule="evenodd"
        d="M9.47 5.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 01-1.06 1.06L10 6.81l-3.72 3.72a.75.75 0 01-1.06-1.06l4.25-4.25z"
        clipRule="evenodd"
      />
    </svg>
  )
}

export function OverrideReason({
  reason,
  onReasonChange,
}: {
  reason: string
  onReasonChange: (value: string) => void
}) {
  const [open, setOpen] = useState(true)

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between text-sm font-medium text-ink"
      >
        Override reason
        <span className={`transition-transform ${open ? '' : 'rotate-180'}`}>
          <ChevronUpIcon />
        </span>
      </button>
      {open && (
        <Textarea
          aria-label="Override reason"
          rows={3}
          placeholder="Reason for override..."
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          className="mt-2"
        />
      )}
    </div>
  )
}
