'use client'

import { useState } from 'react'
import { Select } from '@/components/ui/Select'

const DISPOSITION_OPTIONS = [
  'Qualified — ready to transfer',
  'Not interested',
  'Callback requested',
  'Do not call',
  'Invalid / wrong number',
]

export function DispositionCard() {
  const [disposition, setDisposition] = useState('')

  return (
    <div className="rounded-xl border border-slate bg-white p-6" style={{ borderWidth: '0.5px' }}>
      <h2 className="border-b border-slate/20 pb-4 text-lg font-medium leading-[120%] text-ink">Disposition</h2>
      <div className="mt-4">
        <Select
          aria-label="Select disposition"
          value={disposition}
          onChange={(e) => setDisposition(e.target.value)}
        >
          <option value="" disabled>
            Select disposition
          </option>
          {DISPOSITION_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
      </div>
    </div>
  )
}
