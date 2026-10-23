'use client'

import { useState, type FormEvent } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { Input } from '@/components/ui/Input'
import { AuthError } from '@/lib/auth'
import { newPasswordProblem } from '@/lib/passwords'
import { withSession } from '@/lib/session'
import { setUserPassword } from '@/lib/users'

function bannerFor(err: unknown): string {
  if (!(err instanceof AuthError)) return 'Something went wrong. Please try again.'
  if (err.code === 'user.not_found') return 'That user no longer exists.'
  if (err.code === 'user.cannot_reset_own_password') {
    return 'Change your own password in Settings, which asks for the current one.'
  }
  if (err.status === 403) return 'Only a Super Admin can reset passwords.'
  if (err.status === 401) return 'Your session has ended. Please sign in again.'
  return err.message
}

/**
 * The reset step of Edit User: a Super Admin types someone's new password to
 * tell them in person. State lives here so the dialog can switch to it and back.
 */
export function useResetPassword(userId: string | null, onDone: () => void) {
  const [password, setPassword] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const [banner, setBanner] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!userId) return
    const found = newPasswordProblem(password)
    setProblem(found)
    setBanner(null)
    if (found) return

    setSaving(true)
    try {
      await withSession((token) => setUserPassword(userId, password, token))
      setPassword('')
      onDone()
    } catch (err) {
      const named =
        err instanceof AuthError && err.fields.find((field) => field.field === 'password')
      if (named) setProblem(named.message)
      else setBanner(bannerFor(err))
    } finally {
      setSaving(false)
    }
  }

  function clear() {
    setPassword('')
    setProblem(null)
    setBanner(null)
  }

  return { password, setPassword, problem, banner, saving, submit, clear }
}

export function ResetPasswordFields({
  formId,
  reset,
}: {
  formId: string
  reset: ReturnType<typeof useResetPassword>
}) {
  const [shown, setShown] = useState(false)
  return (
    <form id={formId} onSubmit={reset.submit} noValidate className="space-y-5 pt-1">
      {reset.banner && <Alert>{reset.banner}</Alert>}
      <Input
        label="New password"
        type={shown ? 'text' : 'password'}
        autoComplete="new-password"
        value={reset.password}
        onChange={(event) => reset.setPassword(event.target.value)}
        error={Boolean(reset.problem)}
        helperText={reset.problem ?? 'At least 8 characters.'}
        autoFocus
        endAdornment={
          <button
            type="button"
            onClick={() => setShown((now) => !now)}
            className="text-slate transition-colors hover:text-ink"
            aria-label={shown ? 'Hide password' : 'Show password'}
          >
            {shown ? (
              <EyeOff className="h-5 w-5" strokeWidth={2} aria-hidden />
            ) : (
              <Eye className="h-5 w-5" strokeWidth={2} aria-hidden />
            )}
          </button>
        }
      />
      <p className="text-xs leading-[150%] text-slate">
        Tell them this password yourself. Every session they have ends, so they are signed out
        within 15 minutes and sign in again with it.
      </p>
    </form>
  )
}
