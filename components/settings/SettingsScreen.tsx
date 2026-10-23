'use client'

import { useState, type FormEvent } from 'react'
import FormControlLabel from '@mui/material/FormControlLabel'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import { Eye, EyeOff } from 'lucide-react'
import { useCurrentUser } from '@/components/auth/CurrentUserProvider'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PageShell } from '@/components/ui/PageShell'
import { RADIO_CONTROL_SX, RADIO_ROW_SX } from '@/components/ui/radio'
import { AuthError, updateMyTimezone } from '@/lib/auth'
import { BUSINESS_TIMEZONE, TIME_ZONES, formatTime, type TimeZoneName } from '@/lib/format'
import { newPasswordProblem } from '@/lib/passwords'
import { changePassword, withSession } from '@/lib/session'

const CARD = 'rounded-xl border-hairline border-slate bg-white p-5'

function failureFor(err: unknown): string {
  if (err instanceof AuthError && err.status === 401) {
    return 'Your session has ended. Please sign in again.'
  }
  return 'Something went wrong. Please try again.'
}

/** Settings for whoever is signed in, whatever their desk: time zone and password. */
export function SettingsScreen() {
  return (
    <PageShell title="Settings">
      <div className="max-w-xl space-y-5">
        <TimeZoneCard />
        <PasswordCard />
      </div>
    </PageShell>
  )
}

function TimeZoneCard() {
  const { user, hydrate } = useCurrentUser()
  const saved = user?.timezone ?? BUSINESS_TIMEZONE
  const [choice, setChoice] = useState<TimeZoneName>(saved)
  const [now] = useState(() => new Date().toISOString())
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  async function save(event: FormEvent) {
    event.preventDefault()
    setProblem(null)
    setSaving(true)
    try {
      // Redraws the whole app in the new zone, this card included.
      hydrate(await withSession((token) => updateMyTimezone(choice, token)))
    } catch (err) {
      setProblem(failureFor(err))
      setSaving(false)
    }
  }

  return (
    <section className={CARD}>
      <h2 id="time-zone-heading" className="text-lg font-medium leading-[120%] text-ink">
        Time zone
      </h2>
      <p className="mt-1 text-sm leading-[150%] text-slate">
        Every time in the CRM is shown in this zone, and &ldquo;today&rdquo; and report dates
        follow it.
      </p>
      <form onSubmit={save} noValidate className="mt-4 space-y-4">
        {problem && <Alert>{problem}</Alert>}
        <RadioGroup
          aria-labelledby="time-zone-heading"
          value={choice}
          onChange={(event) => setChoice(event.target.value as TimeZoneName)}
          className="flex flex-col items-start gap-2"
        >
          {TIME_ZONES.map(({ value, label, city }) => (
            <FormControlLabel
              key={value}
              value={value}
              sx={RADIO_ROW_SX}
              control={<Radio size="small" disableRipple sx={RADIO_CONTROL_SX} />}
              label={
                <span className="flex flex-col">
                  <span className="text-ink">{label}</span>
                  {/* The time there now, so the choice reads as a clock, not a code. */}
                  <span className="text-xs leading-[150%] text-slate">
                    {city} · {formatTime(now, value)}
                  </span>
                </span>
              }
            />
          ))}
        </RadioGroup>
        <div className="w-[140px]">
          <Button
            type="submit"
            size="small"
            disabled={choice === saved}
            isLoading={saving}
            loadingText="Saving…"
          >
            Save
          </Button>
        </div>
      </form>
    </section>
  )
}

function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  problem,
  hint,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  autoComplete: 'current-password' | 'new-password'
  problem?: string
  hint?: string
}) {
  const [shown, setShown] = useState(false)
  return (
    <Input
      label={label}
      type={shown ? 'text' : 'password'}
      autoComplete={autoComplete}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      error={Boolean(problem)}
      helperText={problem ?? hint}
      endAdornment={
        <button
          type="button"
          onClick={() => setShown((now) => !now)}
          className="text-slate transition-colors hover:text-ink"
          aria-label={shown ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
        >
          {shown ? (
            <EyeOff className="h-5 w-5" strokeWidth={2} aria-hidden />
          ) : (
            <Eye className="h-5 w-5" strokeWidth={2} aria-hidden />
          )}
        </button>
      }
    />
  )
}

function PasswordCard() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [problems, setProblems] = useState<Record<string, string>>({})
  const [banner, setBanner] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [changed, setChanged] = useState(false)

  /** What can be answered without asking the server. */
  function checkHere(): Record<string, string> {
    const found: Record<string, string> = {}
    if (!current) found.current_password = 'Enter your current password.'
    const problem = newPasswordProblem(next)
    if (problem) found.new_password = problem
    else if (next !== confirmation) found.confirmation = 'Those two do not match.'
    return found
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    const found = checkHere()
    setProblems(found)
    setBanner(null)
    setChanged(false)
    if (Object.keys(found).length > 0) return

    setSaving(true)
    try {
      await changePassword(current, next)
      setCurrent('')
      setNext('')
      setConfirmation('')
      setChanged(true)
    } catch (err) {
      if (err instanceof AuthError && err.code === 'user.password_incorrect') {
        setProblems({ current_password: 'That is not your current password.' })
      } else if (err instanceof AuthError && err.fields.some((field) => field.field)) {
        setProblems(
          Object.fromEntries(
            err.fields
              .filter((field) => field.field)
              .map((field) => [field.field as string, field.message])
          )
        )
      } else {
        setBanner(failureFor(err))
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className={CARD}>
      <h2 className="text-lg font-medium leading-[120%] text-ink">Password</h2>
      <form onSubmit={save} noValidate className="mt-4 space-y-4">
        {banner && <Alert>{banner}</Alert>}
        <PasswordField
          label="Current password"
          value={current}
          onChange={setCurrent}
          autoComplete="current-password"
          problem={problems.current_password}
        />
        <PasswordField
          label="New password"
          value={next}
          onChange={setNext}
          autoComplete="new-password"
          problem={problems.new_password}
          hint="At least 8 characters."
        />
        <PasswordField
          label="Confirm new password"
          value={confirmation}
          onChange={setConfirmation}
          autoComplete="new-password"
          problem={problems.confirmation}
        />
        {changed && (
          <p role="status" className="text-sm leading-[150%] text-status-green">
            Password changed. Your other devices are signed out, and you may be asked to sign in
            again here with the new password.
          </p>
        )}
        <div className="w-[180px]">
          <Button type="submit" size="small" isLoading={saving} loadingText="Saving…">
            Change password
          </Button>
        </div>
      </form>
    </section>
  )
}
