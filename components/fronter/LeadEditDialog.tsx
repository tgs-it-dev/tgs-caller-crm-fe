'use client'

import { useEffect, useId, useState, type FormEvent } from 'react'
import {
  EMPTY_LEAD_CREATE_FORM,
  LeadCreateForm,
  leadFormValuesFromLead,
  leadUpdatePayload,
  validateLeadCreateForm,
  type LeadCreateFormValues,
} from '@/components/fronter/LeadCreateForm'
import type { LeadCreateResult } from '@/components/fronter/LeadCreateDialog'
import { useCurrentUser } from '@/components/auth/CurrentUserProvider'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { AuthError } from '@/lib/auth'
import { captureDisposition, listDispositions, type DispositionResponse } from '@/lib/dispositions'
import { CALLBACK_DISPOSITION_LABEL } from '@/lib/leadFormDraft'
import {
  getLead,
  openLeadCall,
  updateLead,
  type LeadResponse,
  type LeadSearchItem,
} from '@/lib/leads'
import { waitForMocking } from '@/lib/mockReady'
import { submitQualification } from '@/lib/qualification'
import { withSession } from '@/lib/session'
import {
  createTransfer,
  listAvailableClosers,
  type AvailableCloserItem,
} from '@/lib/transfers'

function bannerFor(err: AuthError): string {
  if (err.status === 404 || err.code === 'lead.not_found') {
    return 'This lead is no longer available.'
  }
  if (err.code === 'transfer.no_closer_available') {
    return 'No closers available right now. Pick someone free, or clear the pin for any closer.'
  }
  if (err.code === 'transfer.disposition_not_transferable') {
    return err.message
  }
  if (err.status === 403) return 'You no longer have access to edit leads.'
  if (err.status === 401) return 'Your session has ended. Please sign in again.'
  return err.message
}

const FIELD_KEYS = [
  'first_name',
  'last_name',
  'vehicle_make',
  'vehicle_year',
  'vehicle_model',
  'vin',
  'license_plate',
] as const

/**
 * Edit a lead from the fronter's list: PATCH form fields, optionally record a
 * disposition, and transfer when it allows one. The call is asked for only when
 * a disposition or transfer is saved, so opening a lead never starts one.
 */
export function LeadEditDialog({
  entry,
  onClose,
  onSaved,
}: {
  entry: LeadSearchItem
  onClose: () => void
  onSaved: (result: LeadCreateResult) => void
}) {
  const formId = useId()
  const currentUser = useCurrentUser()
  const [values, setValues] = useState<LeadCreateFormValues>(EMPTY_LEAD_CREATE_FORM)
  const [problems, setProblems] = useState<Record<string, string>>({})
  const [banner, setBanner] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dispositions, setDispositions] = useState<DispositionResponse[] | null>(null)
  const [closers, setClosers] = useState<AvailableCloserItem[] | null>(null)
  const [selectedCloserUserId, setSelectedCloserUserId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setBanner(null)
    waitForMocking()
      .then(() =>
        withSession(async (token) => {
          const [lead, disp, available] = await Promise.all([
            getLead(entry.lead_id, token),
            listDispositions(token, 'fronter'),
            listAvailableClosers(token),
          ])
          return { lead, disp, available }
        })
      )
      .then(({ lead, disp, available }) => {
        if (cancelled) return
        const form = leadFormValuesFromLead(lead)
        // A callback starts on Callback, as it did on the callback list. Anything
        // else starts empty, so saving an edit to the lead records nothing.
        const current =
          entry.latest_disposition === CALLBACK_DISPOSITION_LABEL
            ? disp.find((row) => row.label === CALLBACK_DISPOSITION_LABEL)
            : undefined
        if (current) form.disposition_id = current.id
        setValues(form)
        setDispositions(disp)
        setClosers(available)
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        setLoading(false)
        setDispositions([])
        setClosers([])
        setBanner(err instanceof AuthError ? bannerFor(err) : 'Could not load this lead.')
      })
    return () => {
      cancelled = true
    }
  }, [entry.lead_id, entry.latest_disposition])

  function patch(next: Partial<LeadCreateFormValues>) {
    setValues((prev) => ({ ...prev, ...next }))
  }

  function showFailure(err: unknown) {
    if (!(err instanceof AuthError)) {
      setBanner('Something went wrong. Please try again.')
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
    fronterUserId: string,
    interactionId: string
  ): Promise<LeadCreateResult> {
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
            phone_no: entry.phone_no,
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
          ...(selectedCloserUserId ? { closer_user_id: selectedCloserUserId } : {}),
        },
        token
      )
    )

    const closerName =
      selectedCloserUserId == null
        ? null
        : (closers?.find((row) => row.user_id === selectedCloserUserId)?.name ?? null)

    return {
      next: 'transferred',
      lead: { ...lead, interaction_id: interactionId },
      disposition,
      transfer,
      closerName,
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (currentUser.status !== 'ready') {
      setBanner('Unable to identify the current agent. Please refresh and try again.')
      return
    }

    const found = validateLeadCreateForm(values, { phoneRequired: false })
    setProblems(found)
    setBanner(null)
    if (Object.keys(found).length > 0) return

    if (transferNow && closers && !closers.some((row) => row.status === 'available')) {
      setProblems({ closer: 'No closers are available right now.' })
      return
    }

    setSaving(true)
    try {
      const lead = await withSession((token) =>
        updateLead(entry.lead_id, leadUpdatePayload(values), token)
      )
      if (!selected || !(finishOnDesk || transferNow)) {
        onSaved({ next: 'saved', lead })
        return
      }

      const interactionId = await withSession((token) => openLeadCall(entry.lead_id, token))
      const withInteraction: LeadResponse = { ...lead, interaction_id: interactionId }
      if (finishOnDesk) {
        await withSession((token) =>
          captureDisposition(interactionId, { disposition_id: selected.id }, token)
        )
        onSaved({ next: 'desk', lead: withInteraction, disposition: selected })
        return
      }

      const result = await transferLead(
        withInteraction,
        selected,
        currentUser.user.id,
        interactionId
      )
      onSaved(result)
    } catch (err) {
      showFailure(err)
      setSaving(false)
    }
  }

  return (
    <Dialog
      open
      title="Edit lead"
      onClose={onClose}
      busy={saving || loading}
      maxWidth="sm"
      actions={
        <div className="flex w-full gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="submit"
            form={formId}
            isLoading={saving}
            loadingText="Saving…"
            disabled={loading}
          >
            {submitLabel}
          </Button>
        </div>
      }
    >
      {loading ? (
        <p className="py-6 text-center text-sm text-slate">Loading lead…</p>
      ) : (
        <LeadCreateForm
          formId={formId}
          values={values}
          onChange={patch}
          problems={problems}
          banner={banner}
          phoneLocked
          dispositions={dispositions}
          closers={transferNow ? closers : null}
          selectedCloserUserId={selectedCloserUserId}
          onCloserSelect={setSelectedCloserUserId}
          onSubmit={(e) => {
            void submit(e)
          }}
        />
      )}
    </Dialog>
  )
}
