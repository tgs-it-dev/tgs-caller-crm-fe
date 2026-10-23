'use client'

import { useId, useState, type FormEvent } from 'react'
import {
  EMPTY_LEAD_CREATE_FORM,
  LeadCreateForm,
  leadCreatePayload,
  validateLeadCreateForm,
  type LeadCreateFormValues,
} from '@/components/fronter/LeadCreateForm'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { AuthError } from '@/lib/auth'
import { formatDate } from '@/lib/format'
import { createLead, findLeadOnTeam } from '@/lib/leads'
import { withSession } from '@/lib/session'

const PHONE_PROBLEMS: Record<string, string> = {
  'lead.invalid_phone': 'Enter a valid phone number.',
  'lead.phone_suppressed': 'This number is on the company do-not-call list.',
}

function bannerFor(err: AuthError): string {
  if (err.code === 'lead.team_required') {
    return 'You are not on a team yet, so you cannot add leads.'
  }
  if (err.status === 403) return 'You no longer have access to lead management.'
  if (err.status === 401) return 'Your session has ended. Please sign in again.'
  return err.message
}

const FIELD_KEYS = [
  'first_name',
  'last_name',
  'phone_no',
  'vehicle_make',
  'vehicle_year',
  'vehicle_model',
  'vin',
  'license_plate',
] as const

export function LeadFormDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void
  onSaved: () => void
}) {
  const formId = useId()
  const [values, setValues] = useState<LeadCreateFormValues>(EMPTY_LEAD_CREATE_FORM)
  const [problems, setProblems] = useState<Record<string, string>>({})
  const [banner, setBanner] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function patch(next: Partial<LeadCreateFormValues>) {
    setValues((prev) => ({ ...prev, ...next }))
  }

  function showFailure(err: unknown) {
    if (!(err instanceof AuthError)) {
      setBanner('Something went wrong. Please try again.')
      return
    }
    if (PHONE_PROBLEMS[err.code]) {
      setProblems({ phone_no: PHONE_PROBLEMS[err.code] })
      return
    }
    const named = err.fields.filter((field) =>
      FIELD_KEYS.includes(field.field as (typeof FIELD_KEYS)[number])
    )
    if (named.length > 0) {
      setProblems(Object.fromEntries(named.map((field) => [field.field as string, field.message])))
      return
    }
    setBanner(bannerFor(err))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const found = validateLeadCreateForm(values)
    setProblems(found)
    setBanner(null)
    if (Object.keys(found).length > 0) return

    setSaving(true)
    try {
      const existing = await withSession((token) =>
        findLeadOnTeam(values.phone_no.trim(), token)
      )
      if (existing) {
        setBanner(
          `This number is already on your team (added ${formatDate(existing.created_at)}). Saving will update its details.`
        )
      }

      await withSession((token) => createLead(leadCreatePayload(values), token))
      onSaved()
    } catch (err) {
      showFailure(err)
      setSaving(false)
    }
  }

  return (
    <Dialog
      open
      title="Add lead"
      onClose={onClose}
      busy={saving}
      maxWidth="sm"
      actions={
        <div className="flex w-full gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form={formId} isLoading={saving} loadingText="Adding…">
            Add lead
          </Button>
        </div>
      }
    >
      <LeadCreateForm
        formId={formId}
        values={values}
        onChange={patch}
        problems={problems}
        banner={banner}
        onSubmit={(e) => {
          void submit(e)
        }}
      />
    </Dialog>
  )
}
