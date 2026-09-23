'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCurrentUser } from '@/components/auth/CurrentUserProvider'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { AuthError, getCurrentUser, landingRouteForRoles, storeSession } from '@/lib/auth'
import { acceptInvitation, readInvitation, resetPassword } from '@/lib/invitations'
import { waitForMocking } from '@/lib/mockReady'

type Mode = 'invite' | 'reset'

// The API's ceiling is bcrypt's, and it counts bytes: one emoji is four of
// them, so a passphrase can pass a character count and still be refused.
// Checked here rather than left to the 422, which has no home on this screen —
// a dead link is the only failure it recovers from.
const MAX_PASSWORD_BYTES = 72

type Screen =
  | { status: 'checking' }
  /** The link cannot be used, and saying why is the only helpful thing left. */
  | { status: 'dead'; message: string; offer: 'sign-in' | 'new-link' }
  | { status: 'form'; greeting: string | null }

const COPY = {
  invite: {
    heading: 'Set up your account',
    action: 'Create account',
    working: 'Creating…',
  },
  reset: {
    heading: 'Choose a new password',
    action: 'Save password',
    working: 'Saving…',
  },
} as const

/** What a refused link means to the person holding it. */
function refusal(err: unknown): { message: string; offer: 'sign-in' | 'new-link' } {
  const code = err instanceof AuthError ? err.code : ''
  if (code.endsWith('.already_redeemed')) {
    return { message: 'This link has already been used.', offer: 'sign-in' }
  }
  if (code.endsWith('.superseded')) {
    return {
      message: 'A newer email has been sent. Open the most recent one instead.',
      offer: 'new-link',
    }
  }
  if (code.endsWith('.expired')) {
    return { message: 'This link has expired.', offer: 'new-link' }
  }
  return { message: 'This link is not valid.', offer: 'new-link' }
}

export function SetPasswordScreen({ mode, token }: { mode: Mode; token: string }) {
  const router = useRouter()
  const { hydrate } = useCurrentUser()
  // A reset link has nothing to look up — the API answers only for invitations,
  // so this starts straight on the form.
  const [screen, setScreen] = useState<Screen>(
    mode === 'invite' ? { status: 'checking' } : { status: 'form', greeting: null }
  )
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (mode !== 'invite') return
    let cancelled = false

    waitForMocking()
      .then(() => readInvitation(token))
      .then((invitation) => {
        if (!cancelled) setScreen({ status: 'form', greeting: invitation.name })
      })
      .catch((err) => {
        if (!cancelled) setScreen({ status: 'dead', ...refusal(err) })
      })

    return () => {
      cancelled = true
    }
  }, [mode, token])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (password.length < 8) {
      setProblem('Use at least 8 characters.')
      return
    }
    if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) {
      setProblem('That password is too long. Please choose a shorter one.')
      return
    }
    if (password !== confirmation) {
      setProblem('Those two do not match.')
      return
    }

    setProblem(null)
    setSaving(true)
    try {
      await waitForMocking()
      const session =
        mode === 'invite'
          ? await acceptInvitation(token, password)
          : await resetPassword(token, password)

      // Both return a live session, so they land signed in rather than being
      // sent to the login form to type what they just chose.
      await storeSession(session)
      const user = await getCurrentUser(session.access_token)
      hydrate(user)
      router.replace(landingRouteForRoles(user.roles))
    } catch (err) {
      // A link can go stale between opening the page and using it.
      if (err instanceof AuthError && (err.status === 404 || err.status === 410)) {
        setScreen({ status: 'dead', ...refusal(err) })
        return
      }
      setProblem('Something went wrong. Please try again.')
      setSaving(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-6">
      <div className="w-full max-w-sm">
        {screen.status === 'checking' && (
          <p className="text-center text-sm text-slate">Checking your link…</p>
        )}

        {screen.status === 'dead' && (
          <>
            <Alert>{screen.message}</Alert>
            {screen.offer === 'sign-in' ? (
              <Link href="/login" className="text-sm font-medium text-navy underline">
                Go to sign in
              </Link>
            ) : (
              <p className="text-sm text-slate">
                {mode === 'invite' ? (
                  'Ask an administrator to send you another.'
                ) : (
                  <Link href="/forgot-password" className="font-medium text-navy underline">
                    Ask for a new link
                  </Link>
                )}
              </p>
            )}
          </>
        )}

        {screen.status === 'form' && (
          <form onSubmit={submit} noValidate className="space-y-5">
            <div>
              <h1 className="text-2xl font-semibold leading-[120%] text-ink">
                {COPY[mode].heading}
              </h1>
              {screen.greeting && (
                <p className="mt-2 text-sm text-slate">
                  Hello {screen.greeting} — choose a password to finish.
                </p>
              )}
            </div>

            {problem && <Alert>{problem}</Alert>}

            <Input
              label="Password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              helperText="At least 8 characters."
            />
            <Input
              label="Confirm password"
              type="password"
              autoComplete="new-password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />

            <Button type="submit" isLoading={saving} loadingText={COPY[mode].working}>
              {COPY[mode].action}
            </Button>
          </form>
        )}
      </div>
    </main>
  )
}
