'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { requestPasswordReset } from '@/lib/invitations'
import { waitForMocking } from '@/lib/mockReady'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SERVER_UNREACHABLE =
  'Unable to reach the server. Please check your connection and try again.'

/** Empty or malformed — same check on blur and on submit as login. */
function emailProblem(email: string): string | undefined {
  const trimmed = email.trim()
  if (!trimmed) return 'Enter your email address.'
  if (!EMAIL_PATTERN.test(trimmed)) return 'Enter a valid email address.'
  return undefined
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  /** Present = red border; non-empty string = helper text under the field. */
  const [problem, setProblem] = useState<string | undefined>()
  const [sending, setSending] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const issue = emailProblem(email)
    setProblem(issue)
    if (issue) return

    setSending(true)
    try {
      await waitForMocking()
      await requestPasswordReset(email)
      setSent(true)
    } catch {
      // Never a verdict on the address: the endpoint answers 202 for every one
      // alike, so only an unreachable or broken server lands here. Same copy
      // as login's reachability failure (message sits under this sole field).
      setProblem(SERVER_UNREACHABLE)
      setSending(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-6">
      <div className="w-full max-w-sm">
        {sent ? (
          /* The same words whether or not that address has an account. The API
             answers identically on purpose, and a screen that said "no account
             here" would hand back exactly what it withholds. */
          <>
            <h1 className="text-2xl font-semibold leading-[120%] text-ink">Check your email</h1>
            <p className="mt-3 text-sm leading-[150%] text-slate">
              If an account uses {email}, a link to choose a new password is on its way. It can be
              used once and expires in an hour.
            </p>
            <p className="mt-6 text-sm">
              <Link href="/login" className="font-medium text-navy underline">
                Back to sign in
              </Link>
            </p>
          </>
        ) : (
          <form onSubmit={submit} noValidate className="space-y-5">
            <div>
              <h1 className="text-2xl font-semibold leading-[120%] text-ink">
                Forgotten your password?
              </h1>
              <p className="mt-2 text-sm text-slate">
                Tell us the address you sign in with and we will send a link.
              </p>
            </div>

            <Input
              label="Email"
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => {
                const next = e.target.value
                setEmail(next)
                if (problem == null) return
                // Validation error: keep it honest while they type; clear once valid.
                // Server reachability copy drops as soon as they edit.
                setProblem(emailProblem(next))
              }}
              onBlur={() => {
                const issue = emailProblem(email)
                setProblem((prev) => {
                  if (issue) return issue
                  // Valid: clear a validation message, leave a server message alone.
                  if (prev === SERVER_UNREACHABLE) return prev
                  return undefined
                })
              }}
              placeholder="Enter your email"
              autoFocus
              error={problem != null}
              helperText={problem || undefined}
            />

            <Button type="submit" isLoading={sending} loadingText="Sending…">
              Send the link
            </Button>

            <p className="text-sm">
              <Link href="/login" className="font-medium text-navy underline">
                Back to sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </main>
  )
}
