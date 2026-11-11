'use client'

import { useState, type FormEvent } from 'react'
import FormControlLabel from '@mui/material/FormControlLabel'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import { ChangePasswordForm } from '@/components/auth/ChangePasswordForm'
import { useCurrentUser } from '@/components/auth/CurrentUserProvider'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { PageShell } from '@/components/ui/PageShell'
import { RADIO_CONTROL_SX, RADIO_ROW_SX } from '@/components/ui/radio'
import { AuthError, updateMyTimezone } from '@/lib/auth'
import { BUSINESS_TIMEZONE, TIME_ZONES, formatTime, type TimeZoneName } from '@/lib/format'
import { withSession } from '@/lib/session'

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

function PasswordCard() {
  const [changed, setChanged] = useState(false)
  return (
    <section className={CARD}>
      <h2 className="text-lg font-medium leading-[120%] text-ink">Password</h2>
      <div className="mt-4 space-y-4">
        <ChangePasswordForm submitLabel="Change password" onChanged={() => setChanged(true)} />
        {changed && (
          <p role="status" className="text-sm leading-[150%] text-status-green">
            Password changed. Your other devices are signed out, and you may be asked to sign in
            again here with the new password.
          </p>
        )}
      </div>
    </section>
  )
}
