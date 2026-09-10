'use client'

import { ReactNode, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { AuthError, clearToken, getCurrentUser, readToken, type Role } from '@/lib/auth'
import { waitForMocking } from '@/lib/mockReady'

type Status = 'checking' | 'authorized' | 'error'

function useAuthorization(role?: Role) {
  const router = useRouter()
  const [status, setStatus] = useState<Status>('checking')
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    const token = readToken()

    if (!token) {
      router.replace('/login')
      return
    }

    waitForMocking()
      .then(() => getCurrentUser(token))
      .then((user) => {
        if (cancelled) return
        if (role && !user.roles.includes(role)) {
          router.replace('/login')
          return
        }
        setStatus('authorized')
      })
      .catch((err) => {
        if (cancelled) return
        // Only treat a confirmed 401 as an invalid session. Network blips,
        // 5xx, and CORS failures must not wipe a still-valid token.
        if (err instanceof AuthError && err.status === 401) {
          clearToken()
          router.replace('/login')
          return
        }
        setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [router, role, retryKey])

  return { status, retry: () => setRetryKey((k) => k + 1) }
}

function AuthGate({
  status,
  onRetry,
  children,
}: {
  status: Status
  onRetry: () => void
  children: ReactNode
}) {
  if (status === 'authorized') return <>{children}</>
  if (status === 'error') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-paper px-6">
        <div className="w-full max-w-sm">
          <Alert>Unable to verify your session. Check your connection and try again.</Alert>
          <Button type="button" onClick={onRetry}>
            Retry
          </Button>
        </div>
      </main>
    )
  }
  return null
}

export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { status, retry } = useAuthorization(role)
  return (
    <AuthGate status={status} onRetry={retry}>
      {children}
    </AuthGate>
  )
}

// For screens any signed-in agent may view, regardless of role.
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status, retry } = useAuthorization()
  return (
    <AuthGate status={status} onRetry={retry}>
      {children}
    </AuthGate>
  )
}
