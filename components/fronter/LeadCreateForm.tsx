'use client'

import { type FormEvent, type ReactNode } from 'react'
import { ClosersTable } from '@/components/workspace/ClosersTable'
import { Alert } from '@/components/ui/Alert'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import type { DispositionResponse } from '@/lib/dispositions'
import {
  LEAD_FIELD_MAX,
  LEAD_NAME_MAX,
  LEAD_PHONE_MAX,
  LEAD_PHONE_MIN,
  VEHICLE_YEAR_MAX,
  VEHICLE_YEAR_MIN,
  type LeadResponse,
  type LeadUpdate,
  type NewLead,
} from '@/lib/leads'
import type { AvailableCloserItem } from '@/lib/transfers'

/** Figma Signal red — required marker matching Active Call checklist. */
function RequiredMark() {
  return (
    <span aria-hidden className="text-signal-red">
      {' *'}
    </span>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-4">
      <legend className="text-sm font-medium leading-[150%] text-ink">{title}</legend>
      {children}
    </fieldset>
  )
}

export type LeadCreateFormValues = {
  first_name: string
  last_name: string
  phone_no: string
  vehicle_make: string
  vehicle_year: string
  vehicle_model: string
  win: string
  license_plate: string
  /** Empty = open Active Call without capturing an outcome yet. */
  disposition_id: string
}

export const EMPTY_LEAD_CREATE_FORM: LeadCreateFormValues = {
  first_name: '',
  last_name: '',
  phone_no: '',
  vehicle_make: '',
  vehicle_year: '',
  vehicle_model: '',
  win: '',
  license_plate: '',
  disposition_id: '',
}

/** Client checks that mirror BE LeadCreateRequest / LeadFormFields. */
export function validateLeadCreateForm(
  values: LeadCreateFormValues,
  { phoneRequired = true }: { phoneRequired?: boolean } = {}
): Record<string, string> {
  const found: Record<string, string> = {}
  if (!values.first_name.trim()) found.first_name = 'Enter a first name.'
  if (!values.last_name.trim()) found.last_name = 'Enter a last name.'

  if (phoneRequired) {
    const phone = values.phone_no.trim()
    if (!phone) found.phone_no = 'Enter a phone number.'
    else if (phone.length < LEAD_PHONE_MIN || phone.length > LEAD_PHONE_MAX) {
      found.phone_no = `Enter a phone number between ${LEAD_PHONE_MIN} and ${LEAD_PHONE_MAX} characters.`
    }
  }

  if (!values.vehicle_make.trim()) found.vehicle_make = 'Enter the vehicle make.'
  if (!values.vehicle_model.trim()) found.vehicle_model = 'Enter the vehicle model.'

  const yearRaw = values.vehicle_year.trim()
  if (!yearRaw) found.vehicle_year = 'Enter the vehicle year.'
  else {
    const year = Number(yearRaw)
    if (!Number.isInteger(year) || year < VEHICLE_YEAR_MIN || year > VEHICLE_YEAR_MAX) {
      found.vehicle_year = `Enter a year between ${VEHICLE_YEAR_MIN} and ${VEHICLE_YEAR_MAX}.`
    }
  }

  if (!values.win.trim() && !values.license_plate.trim()) {
    found.win = 'Provide a WIN, a license plate, or both.'
    found.license_plate = 'Provide a WIN, a license plate, or both.'
  }

  return found
}

export function leadCreatePayload(values: LeadCreateFormValues): NewLead {
  const win = values.win.trim()
  const plate = values.license_plate.trim()
  return {
    first_name: values.first_name.trim(),
    last_name: values.last_name.trim(),
    phone_no: values.phone_no.trim(),
    vehicle_make: values.vehicle_make.trim(),
    vehicle_year: Number(values.vehicle_year.trim()),
    vehicle_model: values.vehicle_model.trim(),
    ...(win ? { win } : { win: null }),
    ...(plate ? { license_plate: plate } : { license_plate: null }),
  }
}

/** PATCH body — phone is not on LeadUpdateRequest. */
export function leadUpdatePayload(values: LeadCreateFormValues): LeadUpdate {
  const win = values.win.trim()
  const plate = values.license_plate.trim()
  return {
    first_name: values.first_name.trim(),
    last_name: values.last_name.trim(),
    vehicle_make: values.vehicle_make.trim(),
    vehicle_year: Number(values.vehicle_year.trim()),
    vehicle_model: values.vehicle_model.trim(),
    ...(win ? { win } : { win: null }),
    ...(plate ? { license_plate: plate } : { license_plate: null }),
  }
}

export function leadFormValuesFromLead(lead: LeadResponse): LeadCreateFormValues {
  return {
    first_name: lead.first_name ?? '',
    last_name: lead.last_name ?? '',
    phone_no: lead.phone_no,
    vehicle_make: lead.vehicle_make ?? '',
    vehicle_year: lead.vehicle_year != null ? String(lead.vehicle_year) : '',
    vehicle_model: lead.vehicle_model ?? '',
    win: lead.win ?? '',
    license_plate: lead.license_plate ?? '',
    disposition_id: '',
  }
}

export function LeadCreateForm({
  formId,
  values,
  onChange,
  problems,
  banner,
  onSubmit,
  dispositions = null,
  closers = null,
  selectedCloserUserId = null,
  onCloserSelect,
  phoneLocked = false,
}: {
  formId: string
  values: LeadCreateFormValues
  onChange: (patch: Partial<LeadCreateFormValues>) => void
  problems: Record<string, string>
  banner: string | null
  onSubmit: (event: FormEvent) => void
  /**
   * Fronter catalogue for the Disposition section. Omit on the admin Add Lead
   * dialog — admins do not disposition from create.
   */
  dispositions?: DispositionResponse[] | null
  /** Available closers when the chosen disposition allows transfer. */
  closers?: AvailableCloserItem[] | null
  selectedCloserUserId?: string | null
  onCloserSelect?: (userId: string | null) => void
  /** Edit mode — phone cannot change after create. */
  phoneLocked?: boolean
}) {
  const selectedDisposition =
    dispositions?.find((row) => row.id === values.disposition_id) ?? null
  const showTransfer = Boolean(selectedDisposition?.allows_transfer && closers)
  return (
    <form id={formId} onSubmit={onSubmit} noValidate className="space-y-6 pt-1">
      {banner && <Alert>{banner}</Alert>}

      <Section title="Personal">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={
              <>
                First name
                <RequiredMark />
              </>
            }
            value={values.first_name}
            onChange={(e) => onChange({ first_name: e.target.value })}
            error={Boolean(problems.first_name)}
            helperText={problems.first_name}
            maxLength={LEAD_NAME_MAX}
            autoFocus
          />
          <Input
            label={
              <>
                Last name
                <RequiredMark />
              </>
            }
            value={values.last_name}
            onChange={(e) => onChange({ last_name: e.target.value })}
            error={Boolean(problems.last_name)}
            helperText={problems.last_name}
            maxLength={LEAD_NAME_MAX}
          />
        </div>
        <Input
          label={
            <>
              Phone
              {!phoneLocked && <RequiredMark />}
            </>
          }
          type="tel"
          value={values.phone_no}
          onChange={(e) => onChange({ phone_no: e.target.value })}
          error={Boolean(problems.phone_no)}
          helperText={problems.phone_no}
          maxLength={LEAD_PHONE_MAX}
          disabled={phoneLocked}
        />
      </Section>

      <Section title="Vehicle">
        <div className="grid gap-4 sm:grid-cols-3">
          <Input
            label={
              <>
                Make
                <RequiredMark />
              </>
            }
            value={values.vehicle_make}
            onChange={(e) => onChange({ vehicle_make: e.target.value })}
            error={Boolean(problems.vehicle_make)}
            helperText={problems.vehicle_make}
            maxLength={LEAD_FIELD_MAX}
          />
          <Input
            label={
              <>
                Year
                <RequiredMark />
              </>
            }
            type="number"
            value={values.vehicle_year}
            onChange={(e) => onChange({ vehicle_year: e.target.value })}
            error={Boolean(problems.vehicle_year)}
            helperText={problems.vehicle_year}
            min={VEHICLE_YEAR_MIN}
            max={VEHICLE_YEAR_MAX}
          />
          <Input
            label={
              <>
                Model
                <RequiredMark />
              </>
            }
            value={values.vehicle_model}
            onChange={(e) => onChange({ vehicle_model: e.target.value })}
            error={Boolean(problems.vehicle_model)}
            helperText={problems.vehicle_model}
            maxLength={LEAD_FIELD_MAX}
          />
        </div>
      </Section>

      <Section title="Identity">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={
              <>
                WIN
                <RequiredMark />
              </>
            }
            value={values.win}
            onChange={(e) => onChange({ win: e.target.value })}
            error={Boolean(problems.win)}
            helperText={problems.win}
            maxLength={LEAD_FIELD_MAX}
          />
          <Input
            label={
              <>
                License plate
                <RequiredMark />
              </>
            }
            value={values.license_plate}
            onChange={(e) => onChange({ license_plate: e.target.value })}
            error={Boolean(problems.license_plate)}
            helperText={problems.license_plate}
            maxLength={LEAD_FIELD_MAX}
          />
        </div>
      </Section>

      {dispositions && (
        <Section title="Disposition">
          <Select
            label="Call outcome"
            value={values.disposition_id}
            onChange={(e) => onChange({ disposition_id: e.target.value })}
          >
            <option value="">Select disposition</option>
            {dispositions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </Select>
          {problems.disposition_id && (
            <p className="text-sm leading-[150%] text-signal-red">{problems.disposition_id}</p>
          )}
        </Section>
      )}

      {showTransfer && closers && onCloserSelect && (
        <Section title="Transfer to closer">
          <ClosersTable
            closers={closers}
            selectedUserId={selectedCloserUserId}
            onSelect={onCloserSelect}
          />
          {problems.closer && (
            <p className="text-sm leading-[150%] text-signal-red">{problems.closer}</p>
          )}
        </Section>
      )}
    </form>
  )
}
