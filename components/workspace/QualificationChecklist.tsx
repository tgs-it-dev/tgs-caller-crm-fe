'use client'

import { useState } from 'react'
import FormControl from '@mui/material/FormControl'
import FormControlLabel from '@mui/material/FormControlLabel'
import FormLabel from '@mui/material/FormLabel'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'

const WARRANTY_STATUS_OPTIONS = ['Active', 'Expired', 'Expiring soon', 'Unknown']

export function QualificationChecklist() {
  const [vehicle, setVehicle] = useState('')
  const [mileage, setMileage] = useState('')
  const [state, setState] = useState('')
  const [warrantyStatus, setWarrantyStatus] = useState('')
  const [consent, setConsent] = useState<'yes' | 'no'>('yes')
  const [notes, setNotes] = useState('')

  return (
    <div className="rounded-xl border-hairline border-slate bg-white p-6">
      <h2 className="border-b border-slate/20 pb-4 text-lg font-medium leading-[120%] text-ink">
        Qualification Checklist
      </h2>

      <div className="mt-5 space-y-5">
        <Input
          label="Vehicle Year / Make / Model *"
          placeholder="e.g. 2019 Toyota Camry"
          value={vehicle}
          onChange={(e) => setVehicle(e.target.value)}
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Mileage *"
            placeholder="e.g. 62,400"
            value={mileage}
            onChange={(e) => setMileage(e.target.value)}
          />
          <Input label="State *" placeholder="TX" value={state} onChange={(e) => setState(e.target.value)} />
        </div>

        <Select
          id="warranty-status"
          label="Warranty Status *"
          value={warrantyStatus}
          onChange={(e) => setWarrantyStatus(e.target.value)}
        >
          <option value="" disabled>
            Select
          </option>
          {WARRANTY_STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>

        <FormControl>
          <FormLabel id="consent-dnc-label">Consent / DNC confirmation *</FormLabel>
          <RadioGroup
            row
            aria-labelledby="consent-dnc-label"
            name="consent"
            value={consent}
            onChange={(e) => setConsent(e.target.value as 'yes' | 'no')}
          >
            <FormControlLabel value="yes" control={<Radio size="small" color="primary" />} label="Yes" />
            <FormControlLabel value="no" control={<Radio size="small" color="primary" />} label="No" />
          </RadioGroup>
        </FormControl>

        <Textarea
          id="call-notes"
          label="Notes"
          rows={3}
          placeholder="Add call notes here..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
    </div>
  )
}
