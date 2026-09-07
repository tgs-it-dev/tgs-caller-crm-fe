'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  AuthError,
  getCurrentUser,
  landingRouteForRoles,
  login,
  readToken,
  storeToken,
} from '@/lib/auth'
import { waitForMocking } from '@/lib/mockReady'

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path d="M10 3.5c-4.42 0-8.24 2.83-9.53 6.5 1.29 3.67 5.11 6.5 9.53 6.5s8.24-2.83 9.53-6.5C18.24 6.33 14.42 3.5 10 3.5zm0 10.83a4.33 4.33 0 110-8.66 4.33 4.33 0 010 8.66zm0-6.83a2.5 2.5 0 100 5 2.5 2.5 0 000-5z" />
    </svg>
  ) : (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path d="M2.28 2.22a.75.75 0 00-1.06 1.06l1.68 1.68C1.4 6.02.36 7.5.47 9.5 1.76 13.17 5.58 16 10 16c1.6 0 3.11-.37 4.44-1.03l1.78 1.78a.75.75 0 101.06-1.06L2.28 2.22zm5.4 5.4l4.2 4.2a2.5 2.5 0 01-4.2-4.2zM10 3.5c4.42 0 8.24 2.83 9.53 6.5a10.98 10.98 0 01-2.6 3.86l-1.62-1.62a4.33 4.33 0 00-5.75-5.75L7.98 4.9A9.9 9.9 0 0110 3.5z" />
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4">
      <path
        fill="#4285F4"
        d="M19.6 10.23c0-.68-.06-1.32-.17-1.95H10v3.7h5.38a4.6 4.6 0 01-2 3.02v2.5h3.23c1.9-1.75 2.99-4.32 2.99-7.27z"
      />
      <path
        fill="#34A853"
        d="M10 20c2.7 0 4.96-.89 6.62-2.42l-3.23-2.5c-.9.6-2.05.96-3.39.96-2.6 0-4.81-1.76-5.6-4.12H1.06v2.59A10 10 0 0010 20z"
      />
      <path
        fill="#FBBC05"
        d="M4.4 11.92a5.99 5.99 0 010-3.84V5.49H1.06a10 10 0 000 9.02l3.34-2.59z"
      />
      <path
        fill="#EA4335"
        d="M10 3.96c1.47 0 2.79.5 3.83 1.5l2.87-2.87C14.95.99 12.7 0 10 0 6.09 0 2.71 2.24 1.06 5.49l3.34 2.59C5.19 5.72 7.4 3.96 10 3.96z"
      />
    </svg>
  )
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Already signed in? Skip the form and land straight on the workspace.
  useEffect(() => {
    const token = readToken()
    if (!token) return

    waitForMocking()
      .then(() => getCurrentUser(token))
      .then((user) => router.replace(landingRouteForRoles(user.roles)))
      .catch(() => {
        // stale/invalid token — let the user sign in again
      })
  }, [router])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const { access_token } = await login({ email, password })
      storeToken(access_token)

      const user = await getCurrentUser(access_token)
      router.push(landingRouteForRoles(user.roles))
    } catch (err) {
      setError(
        err instanceof AuthError
          ? err.message
          : 'Unable to reach the server. Please check your connection and try again.'
      )
      setIsSubmitting(false)
    }
  }

  return (
    <main className="relative flex h-screen items-center justify-end overflow-hidden bg-ink px-6 py-6 lg:px-16">
      <img
        src="/hero-section-login.jpg"
        alt=""
        aria-hidden
        className="fixed inset-0 h-screen w-screen object-cover"
        style={{ objectPosition: '50% 78%' }}
      />
      <div aria-hidden className="fixed inset-0 bg-ink/30" />

      <div className="relative z-10 max-h-full w-full max-w-lg overflow-y-auto rounded-2xl bg-paper p-8 shadow-2xl sm:p-10">
        <div className="mb-4 h-14 w-14 rounded-xl bg-slate/15" aria-hidden />

        <h1 className="text-2xl font-semibold tracking-tight text-ink">Welcome Back</h1>
        <p className="mt-1 text-sm text-slate">
          Enter your call center credentials to reach your desk
        </p>

        <form onSubmit={handleSubmit} noValidate className="mt-6">
          {error && <Alert>{error}</Alert>}

          <div className="mb-4">
            <Input
              label="Email"
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
            />
          </div>

          <div className="mb-4">
            <Input
              label="Password"
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              endAdornment={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="text-slate transition-colors hover:text-ink"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <EyeIcon open={showPassword} />
                </button>
              }
            />
          </div>

          <div className="mb-6 flex items-center justify-between">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-dimgray">
              <input
                type="checkbox"
                className="h-4 w-4 cursor-pointer rounded border-slate/40 accent-navy transition-colors hover:border-ink focus:ring-2 focus:ring-navy/30"
              />
              Remember me
            </label>
            <a href="#" className="text-sm font-medium text-accent-blue transition-colors hover:underline">
              Forgot Password?
            </a>
          </div>

          <Button type="submit" isLoading={isSubmitting} loadingText="Signing in…">
            Login
          </Button>
        </form>

        <div className="my-6 flex items-center gap-3 text-xs text-slate">
          <div className="h-px flex-1 bg-slate/30" />
          or
          <div className="h-px flex-1 bg-slate/30" />
        </div>

        <Button type="button" variant="secondary" className="gap-2 !font-medium">
          <GoogleIcon />
          Continue with Google
        </Button>

        <p className="mt-6 text-center text-sm text-slate">
          Don&apos;t have an account?{' '}
          <a href="#" className="font-medium text-navy transition-colors hover:text-ink hover:underline">
            Sign up here
          </a>
        </p>
      </div>
    </main>
  )
}
