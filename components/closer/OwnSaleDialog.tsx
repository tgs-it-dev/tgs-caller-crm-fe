'use client'

import { useId, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import {
  EMPTY_LEAD_CREATE_FORM,
  LeadCreateForm,
  leadCreatePayload,
  leadFormValuesFromLead,
  validateLeadCreateForm,
  type LeadCreateFormValues,
} from '@/components/fronter/LeadCreateForm'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { AuthError } from '@/lib/auth'
import { closerWorkspaceHref } from '@/lib/closer'
import { formatDate } from '@/lib/format'
import { LEAD_PHONE_MAX, LEAD_PHONE_MIN } from '@/lib/leads'
import { waitForMocking } from '@/lib/mockReady'
import { lookupOwnSaleLead, startOwnSale, type OwnSaleLead } from '@/lib/ownSale'
import { withSession } from '@/lib/session'

const PHONE_PROBLEMS: Record<string, string> = {
  'lead.invalid_phone': 'Enter a valid phone number.',
  'lead.phone_suppressed': 'This number is on the company do-not-call list.',
}

type Problem = { phone?: string; banner?: string }

function problemFor(err: unknown): Problem {
  if (!(err instanceof AuthError)) return { banner: 'Something went wrong. Please try again.' }
  if (PHONE_PROBLEMS[err.code]) return { phone: PHONE_PROBLEMS[err.code] }
  // The server says how the number is being worked: waiting, or already on a call.
  if (err.code === 'own_sale.lead_busy') {
    return { phone: `${err.message.charAt(0).toUpperCase()}${err.message.slice(1)}.` }
  }
  if (err.code === 'lead.team_required') {
    return { banner: 'You are not on a team yet, so you cannot start a sale.' }
  }
  if (err.status === 401) return { banner: 'Your session has ended. Please sign in again.' }
  return { banner: err.message }
}

type Step =
  | { step: 'phone' }
  | { step: 'details'; lead: OwnSaleLead | null }

/** Own Sale: the customer's number, then their details, then the call screen. */
export function OwnSaleDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const formId = useId()
  const phoneFormId = useId()
  const [step, setStep] = useState<Step>({ step: 'phone' })
  const [phone, setPhone] = useState('')
  const [values, setValues] = useState<LeadCreateFormValues>(EMPTY_LEAD_CREATE_FORM)
  const [problems, setProblems] = useState<Record<string, string>>({})
  const [banner, setBanner] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function show(problem: Problem) {
    setProblems(problem.phone ? { phone_no: problem.phone } : {})
    setBanner(problem.banner ?? null)
  }

  async function lookUp(event: FormEvent) {
    event.preventDefault()
    const typed = phone.trim()
    if (typed.length < LEAD_PHONE_MIN || typed.length > LEAD_PHONE_MAX) {
      show({ phone: 'Enter a valid phone number.' })
      return
    }
    setBusy(true)
    show({})
    try {
      await waitForMocking()
      const found = await withSession((token) => lookupOwnSaleLead(typed, token))
      setValues(
        found.lead
          ? leadFormValuesFromLead({ ...found.lead, phone_no: found.phone_no })
          : { ...EMPTY_LEAD_CREATE_FORM, phone_no: found.phone_no }
      )
      setStep({ step: 'details', lead: found.lead ?? null })
    } catch (err) {
      show(problemFor(err))
    } finally {
      setBusy(false)
    }
  }

  async function startSale(event: FormEvent) {
    event.preventDefault()
    const found = validateLeadCreateForm(values, { phoneRequired: false })
    setProblems(found)
    setBanner(null)
    if (Object.keys(found).length > 0) return

    setBusy(true)
    try {
      await waitForMocking()
      const started = await withSession((token) => startOwnSale(leadCreatePayload(values), token))
      router.push(closerWorkspaceHref(started.interaction_id))
    } catch (err) {
      if (err instanceof AuthError && err.fields.some((row) => row.field !== 'phone_no')) {
        setProblems(Object.fromEntries(err.fields.map((row) => [row.field, row.message])))
      }
      const problem = problemFor(err)
      // The number itself was refused, so the banner says why on this step.
      setBanner(problem.phone ?? problem.banner ?? null)
      setBusy(false)
    }
  }

  function back() {
    setStep({ step: 'phone' })
    show({})
  }

  if (step.step === 'phone') {
    return (
      <Dialog
        open
        title="Own Sale"
        onClose={onClose}
        busy={busy}
        maxWidth="sm"
        actions={
          <div className="flex w-full gap-3">
            <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" form={phoneFormId} isLoading={busy} loadingText="Checking…">
              Continue
            </Button>
          </div>
        }
      >
        <form
          id={phoneFormId}
          onSubmit={(event) => {
            void lookUp(event)
          }}
          noValidate
          className="space-y-4 pt-1"
        >
          <p className="text-sm leading-[150%] text-body-text">
            Enter the customer&apos;s number. If they are already a lead on your team, their
            details fill in.
          </p>
          {banner && <Alert>{banner}</Alert>}
          <Input
            label="Phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            error={Boolean(problems.phone_no)}
            helperText={problems.phone_no}
            placeholder="212 555 0100"
            maxLength={LEAD_PHONE_MAX}
            autoFocus
          />
        </form>
      </Dialog>
    )
  }

  return (
    <Dialog
      open
      title="Own Sale"
      onClose={onClose}
      busy={busy}
      maxWidth="sm"
      actions={
        <div className="flex w-full gap-3">
          <Button type="button" variant="secondary" onClick={back} disabled={busy}>
            Back
          </Button>
          <Button type="submit" form={formId} isLoading={busy} loadingText="Starting…">
            Start sale
          </Button>
        </div>
      }
    >
      {step.lead && (
        <p className="mb-4 text-sm leading-[150%] text-body-text">
          Already a lead on your team since {formatDate(step.lead.created_at)}. Check the details
          with the customer.
        </p>
      )}
      <LeadCreateForm
        formId={formId}
        values={values}
        onChange={(patch) => setValues((current) => ({ ...current, ...patch }))}
        problems={problems}
        banner={banner}
        phoneLocked
        onSubmit={(event) => {
          void startSale(event)
        }}
      />
    </Dialog>
  )
}
