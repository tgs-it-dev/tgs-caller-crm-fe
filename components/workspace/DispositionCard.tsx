'use client'

import { Select } from '@/components/ui/Select'
import type { DispositionResponse } from '@/lib/dispositions'

export function DispositionCard({
  options,
  dispositionId,
  onDispositionChange,
}: {
  options: DispositionResponse[]
  dispositionId: string
  onDispositionChange: (id: string) => void
}) {
  return (
    <div className="rounded-xl border-hairline border-slate bg-white p-6">
      <h2 className="border-b border-slate/20 pb-4 text-lg font-medium leading-[120%] text-ink">
        Disposition
      </h2>
      <div className="mt-4">
        <Select
          aria-label="Select disposition"
          value={dispositionId}
          onChange={(e) => onDispositionChange(e.target.value)}
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
      </div>
    </div>
  )
}
