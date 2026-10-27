'use client'

import { useEffect, useId, useState, type FormEvent } from 'react'
import {
  EMPTY_LEAD_CREATE_FORM,
  LeadCreateForm,
  leadCreatePayload,
  validateLeadCreateForm,
  type LeadCreateFormValues,
} from '@/components/fronter/LeadCreateForm'
import { useCurrentUser } from '@/components/auth/CurrentUserProvider'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { AuthError } from '@/lib/auth'
import { captureDisposition, listDispositions, type DispositionResponse } from '@/lib/dispositions'
import { createLead, type LeadResponse } from '@/lib/leads'
import { waitForMocking } from '@/lib/mockReady'
import { submitQualification } from '@/lib/qualification'
import { withSession } from '@/lib/session'
import {
  createTransfer,
  listAvailableClosers,
  type AvailableCloserItem,
  type TransferResponse,
} from '@/lib/transfers'

const PHONE_PROBLEMS: Record<string, string> = {
  'lead.invalid_phone': 'Enter a valid phone number.',
  'lead.phone_suppressed': 'This number is on the company do-not-call list.',
}

const FORM_TRANSFER_OVERRIDE =
  'Lead form transfer — vehicle details captured on create'

function bannerFor(err: AuthError): string {
  if (err.code === 'lead.team_required') {
    return 'You are not on a team yet, so you cannot create leads.'
  }
  if (err.code === 'transfer.no_closer_available') {
    return 'No closers available right now. Pick someone free, or clear the pin for any closer.'
  }
  if (err.code === 'transfer.disposition_not_transferable') {
    return err.message
  }
  if (err.status === 403) return 'You no longer have access to create leads.'
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

export type LeadCreateResult =
  | {
      /** Lead saved; no disposition change (or create without an outcome). */
      next: 'saved'
      lead: LeadResponse
    }
  | {
      next: 'desk'
      lead: LeadResponse
      disposition: DispositionResponse
    }
  | {
      next: 'transferred'
      lead: LeadResponse
      disposition: DispositionResponse
      transfer: TransferResponse
      closerName: string | null
    }

export function LeadCreateDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (result: LeadCreateResult) => void
}) {
  const formId = useId()
  const currentUser = useCurrentUser()
  const [values, setValues] = useState<LeadCreateFormValues>(EMPTY_LEAD_CREATE_FORM)
  const [problems, setProblems] = useState<Record<string, string>>({})
  const [banner, setBanner] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [dispositions, setDispositions] = useState<DispositionResponse[] | null>(null)
  const [closers, setClosers] = useState<AvailableCloserItem[] | null>(null)
  const [selectedCloserUserId, setSelectedCloserUserId] = useState<string | null>(null)
  /** Survives a failed transfer so retry does not mint a second lead. */
  const [createdLead, setCreatedLead] = useState<LeadResponse | null>(null)

  useEffect(() => {
    let cancelled = false
    waitForMocking()
      .then(() =>
        withSession(async (token) => {
          const [disp, available] = await Promise.all([
            listDispositions(token, 'fronter'),
            listAvailableClosers(token),
          ])
          return { disp, available }
        })
      )
      .then(({ disp, available }) => {
        if (cancelled) return
        setDispositions(disp)
        setClosers(available)
      })
      .catch(() => {
        if (!cancelled) {
          setDispositions([])
          setClosers([])
          setBanner('Could not load dispositions or closers. You can still save the lead.')
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

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

  const selected = dispositions?.find((row) => row.id === values.disposition_id) ?? null
  const finishOnDesk = selected != null && !selected.allows_transfer
  const transferNow = selected != null && selected.allows_transfer
  const submitLabel = transferNow ? 'Save & transfer' : 'Save'

  async function transferLead(
    lead: LeadResponse,
    disposition: DispositionResponse,
    fronterUserId: string
  ): Promise<LeadCreateResult> {
    const interactionId = lead.interaction_id!
    const year = Number(values.vehicle_year.trim())
    const make = values.vehicle_make.trim()
    const model = values.vehicle_model.trim()
    const firstName = values.first_name.trim()
    const lastName = values.last_name.trim()
    const vin = values.identity_kind === 'vin' ? values.vin.trim() : ''
    const licensePlate =
      values.identity_kind === 'license_plate' ? values.license_plate.trim() : ''
    const vehicleLine = [year, make, model].filter(Boolean).join(' ')
    const now = new Date().toISOString()

    await withSession((token) =>
      submitQualification(
        {
          interaction_id: interactionId,
          snapshot_json: {
            first_name: firstName,
            last_name: lastName,
            phone_no: lead.phone_no,
            vehicle: vehicleLine,
            vehicle_year: String(year),
            vehicle_make: make,
            vehicle_model: model,
            ...(vin ? { vin } : {}),
            ...(licensePlate ? { license_plate: licensePlate } : {}),
          },
          consent_dnc: {
            consent_given: true,
            consent_captured_at: now,
            dnc_flagged: false,
            dnc_source: null,
          },
        },
        token
      )
    )

    await withSession((token) =>
      captureDisposition(interactionId, { disposition_id: disposition.id }, token)
    )

    const transfer = await withSession((token) =>
      createTransfer(
        {
          interaction_id: interactionId,
          fronter_user_id: fronterUserId,
          override_reason: FORM_TRANSFER_OVERRIDE,
          ...(selectedCloserUserId ? { closer_user_id: selectedCloserUserId } : {}),
        },
        token
      )
    )

    const closerName =
      selectedCloserUserId == null
        ? null
        : (closers?.find((row) => row.user_id === selectedCloserUserId)?.name ?? null)

    return { next: 'transferred', lead, disposition, transfer, closerName }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (currentUser.status !== 'ready') {
      setBanner('Unable to identify the current agent. Please refresh and try again.')
      return
    }

    const found = validateLeadCreateForm(values)
    setProblems(found)
    setBanner(null)
    if (Object.keys(found).length > 0) return

    if (transferNow && closers && !closers.some((row) => row.status === 'available')) {
      setProblems({ closer: 'No closers are available right now.' })
      return
    }

    setSaving(true)
    try {
      let lead = createdLead
      if (!lead) {
        lead = await withSession((token) => createLead(leadCreatePayload(values), token))
        setCreatedLead(lead)
      }
      if (!lead) {
        setBanner('Lead could not be saved. Please try again.')
        setSaving(false)
        return
      }
      const saved = lead
      const interactionId = saved.interaction_id

      if ((finishOnDesk || transferNow) && selected && !interactionId) {
        setBanner('Lead was saved, but no interaction was opened for the outcome. Please try again.')
        setSaving(false)
        return
      }

      if (finishOnDesk && selected && interactionId) {
        await withSession((token) =>
          captureDisposition(interactionId, { disposition_id: selected.id }, token)
        )
        onCreated({ next: 'desk', lead: saved, disposition: selected })
        return
      }

      if (transferNow && selected) {
        const result = await transferLead(saved, selected, currentUser.user.id)
        onCreated(result)
        return
      }

      onCreated({ next: 'saved', lead: saved })
    } catch (err) {
      showFailure(err)
      setSaving(false)
    }
  }

  return (
    <Dialog
      open
      title="New lead"
      onClose={onClose}
      busy={saving}
      maxWidth="sm"
      actions={
        <div className="flex w-full gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form={formId} isLoading={saving} loadingText="Saving…">
            {submitLabel}
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
        dispositions={dispositions}
        closers={transferNow ? closers : null}
        selectedCloserUserId={selectedCloserUserId}
        onCloserSelect={setSelectedCloserUserId}
        onSubmit={(e) => {
          void submit(e)
        }}
      />
    </Dialog>
  )
}
