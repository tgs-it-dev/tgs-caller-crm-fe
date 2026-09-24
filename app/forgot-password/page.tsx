'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { requestPasswordReset } from '@/lib/invitations'
import { waitForMocking } from '@/lib/mockReady'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setProblem('Enter a valid email address.')
      return
    }

    setProblem(null)
    setSending(true)
    try {
      await waitForMocking()
      await requestPasswordReset(email)
      setSent(true)
    } catch {
      // Never a verdict on the address: the endpoint answers 202 for every one
      // alike, so only an unreachable or broken server lands here.
      setProblem('Could not reach the server. Please try again.')
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

            {problem && <Alert>{problem}</Alert>}

            <Input
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoFocus
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
