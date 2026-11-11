'use client'

import { useState, type FormEvent, type ReactNode } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { AuthError } from '@/lib/auth'
import { newPasswordProblem } from '@/lib/passwords'
import { changePassword } from '@/lib/session'

function failureFor(err: unknown): string {
  if (err instanceof AuthError && err.status === 401) {
    return 'Your session has ended. Please sign in again.'
  }
  return 'Something went wrong. Please try again.'
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

/**
 * Current, new and confirm, then the change. Settings and the first sign-in both
 * use it; `onChanged` runs once the new password is saved.
 */
export function ChangePasswordForm({
  submitLabel,
  onChanged,
  aside,
}: {
  submitLabel: string
  onChanged: () => void
  /** Shown beside the submit button, such as Sign out. */
  aside?: ReactNode
}) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [problems, setProblems] = useState<Record<string, string>>({})
  const [banner, setBanner] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

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
    if (Object.keys(found).length > 0) return

    setSaving(true)
    try {
      await changePassword(current, next)
      setCurrent('')
      setNext('')
      setConfirmation('')
      onChanged()
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
    <form onSubmit={save} noValidate className="space-y-4">
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        {aside}
        <div className="w-[180px]">
          <Button type="submit" size="small" isLoading={saving} loadingText="Saving…">
            {submitLabel}
          </Button>
        </div>
      </div>
    </form>
  )
}
