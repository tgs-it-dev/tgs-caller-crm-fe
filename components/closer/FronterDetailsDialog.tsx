'use client'

import { useId, useState, type FormEvent } from 'react'
import {
  EMPTY_LEAD_CREATE_FORM,
  LeadCreateForm,
  leadUpdatePayload,
  validateLeadCreateForm,
  type LeadCreateFormValues,
} from '@/components/fronter/LeadCreateForm'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { AuthError } from '@/lib/auth'
import { saveFronterDetails } from '@/lib/callbacks'
import type { CloserQualificationSnapshot } from '@/lib/closer'
import { waitForMocking } from '@/lib/mockReady'
import type { QualificationResponse } from '@/lib/qualification'
import { withSession } from '@/lib/session'

function valuesFrom(snapshot: CloserQualificationSnapshot): LeadCreateFormValues {
  return {
    ...EMPTY_LEAD_CREATE_FORM,
    first_name: snapshot.first_name,
    last_name: snapshot.last_name,
    phone_no: snapshot.phone_no,
    vehicle_make: snapshot.vehicle_make,
    vehicle_year: snapshot.vehicle_year,
    vehicle_model: snapshot.vehicle_model,
    identity_kind: snapshot.vin.trim() || !snapshot.license_plate.trim() ? 'vin' : 'license_plate',
    vin: snapshot.vin,
    license_plate: snapshot.license_plate,
  }
}

/** The closer's correction of what the fronter entered, with the fronter's own form and checks. */
export function FronterDetailsDialog({
  interactionId,
  snapshot,
  onClose,
  onSaved,
}: {
  interactionId: string
  snapshot: CloserQualificationSnapshot
  onClose: () => void
  onSaved: (saved: QualificationResponse) => void
}) {
  const formId = useId()
  const [values, setValues] = useState(() => valuesFrom(snapshot))
  const [problems, setProblems] = useState<Record<string, string>>({})
  const [banner, setBanner] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const found = validateLeadCreateForm(values, { phoneRequired: false })
    setProblems(found)
    if (Object.keys(found).length > 0) return

    setSaving(true)
    setBanner(null)
    try {
      await waitForMocking()
      const saved = await withSession((token) =>
        saveFronterDetails(interactionId, leadUpdatePayload(values), token)
      )
      onSaved(saved)
    } catch (err) {
      if (err instanceof AuthError && err.fields.length > 0) {
        setProblems(Object.fromEntries(err.fields.map((row) => [row.field, row.message])))
      }
      setBanner(err instanceof Error ? err.message : 'Could not save the details.')
      setSaving(false)
    }
  }

  return (
    <Dialog
      open
      title="Edit lead details"
      onClose={onClose}
      busy={saving}
      maxWidth="sm"
      actions={
        <div className="flex w-full gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form={formId} isLoading={saving} loadingText="Saving…">
            Save details
          </Button>
        </div>
      }
    >
      <p className="mb-4 text-sm leading-[150%] text-body-text">
        Saving updates this lead for everyone. The earlier version is kept.
      </p>
      <LeadCreateForm
        formId={formId}
        values={values}
        onChange={(patch) => setValues((current) => ({ ...current, ...patch }))}
        problems={problems}
        banner={banner}
        phoneLocked
        onSubmit={(event) => {
          void submit(event)
        }}
      />
    </Dialog>
  )
}
