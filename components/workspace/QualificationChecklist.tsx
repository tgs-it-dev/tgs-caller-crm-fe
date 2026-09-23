'use client'

import FormControl from '@mui/material/FormControl'
import FormControlLabel from '@mui/material/FormControlLabel'
import FormLabel from '@mui/material/FormLabel'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import { Checkbox } from '@/components/ui/Checkbox'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import {
  WARRANTY_STATUS_OPTIONS,
  type ActiveCallForm,
} from '@/lib/qualification'
import { tokens } from '@/lib/theme'

export function QualificationChecklist({
  form,
  onChange,
}: {
  form: ActiveCallForm
  onChange: (patch: Partial<ActiveCallForm>) => void
}) {
  return (
    <div className="rounded-xl border-hairline border-slate bg-white p-6">
      <h2 className="border-b border-slate/20 pb-4 text-lg font-medium leading-[120%] text-ink">
        Qualification Checklist
      </h2>

      <div className="mt-5 space-y-5">
        <Input
          label="Vehicle Year / Make / Model *"
          placeholder="e.g. 2019 Toyota Camry"
          value={form.vehicle}
          onChange={(e) => onChange({ vehicle: e.target.value })}
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Mileage *"
            placeholder="e.g. 62,400"
            value={form.mileage}
            onChange={(e) => onChange({ mileage: e.target.value })}
          />
          <Input
            label="State *"
            placeholder="TX"
            value={form.state}
            onChange={(e) => onChange({ state: e.target.value })}
          />
        </div>

        <Select
          id="warranty-status"
          label="Warranty Status *"
          value={form.warranty_status}
          onChange={(e) => onChange({ warranty_status: e.target.value })}
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
          <FormLabel
            id="consent-dnc-label"
            sx={{
              fontSize: '14px',
              fontWeight: 500,
              lineHeight: 1.5,
              letterSpacing: 0,
              marginBottom: '12px',
              color: tokens.ink,
              '&.Mui-focused': { color: tokens.ink },
            }}
          >
            Consent / DNC confirmation *
          </FormLabel>
          <RadioGroup
            row
            aria-labelledby="consent-dnc-label"
            name="consent"
            value={form.consent}
            onChange={(e) => onChange({ consent: e.target.value as 'yes' | 'no' })}
          >
            <FormControlLabel value="yes" control={<Radio size="small" color="primary" />} label="Yes" />
            <FormControlLabel value="no" control={<Radio size="small" color="primary" />} label="No" />
          </RadioGroup>
        </FormControl>

        <div className="space-y-2.5">
          <Checkbox
            label="Flag as Do Not Call"
            checked={form.dnc_flagged}
            onChange={(e) =>
              onChange({
                dnc_flagged: e.target.checked,
                dnc_source: e.target.checked ? 'fronter_active_call' : null,
              })
            }
          />
          {form.dnc_flagged && (
            <p
              role="status"
              className="rounded-lg border border-status-red/30 bg-status-red/10 px-3 py-2 text-xs text-status-red"
            >
              This lead is flagged Do Not Call. Transfer is blocked and cannot be overridden.
            </p>
          )}
        </div>

        <Textarea
          id="call-notes"
          label="Notes"
          rows={3}
          placeholder="Add call notes here..."
          value={form.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
        />
      </div>
    </div>
  )
}
