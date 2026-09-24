'use client'

import { ReactNode, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCurrentUser } from '@/components/auth/CurrentUserProvider'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { FullPageLoader } from '@/components/ui/FullPageLoader'
import { readToken, type Role } from '@/lib/auth'

type GateStatus = 'checking' | 'authorized' | 'error'

function useAuthorization(role?: Role): { status: GateStatus; retry: () => void } {
  const router = useRouter()
  const { status: userStatus, user, refresh } = useCurrentUser()

  useEffect(() => {
    if (!readToken()) {
      router.replace('/login')
      return
    }

    if (userStatus === 'error') {
      // No token left after a 401 wipe, or never had one.
      if (!readToken()) {
        router.replace('/login')
      }
      return
    }

    if (userStatus === 'ready' && role && !user.roles.includes(role)) {
      router.replace('/login')
    }
  }, [router, role, user, userStatus])

  // No token (never signed in, or wiped after 401): redirect is in flight.
  if (!readToken()) return { status: 'checking', retry: refresh }
  if (userStatus === 'loading') return { status: 'checking', retry: refresh }
  // Token still present → transient failure; Retry reuses the provider fetch.
  if (userStatus === 'error') return { status: 'error', retry: refresh }
  if (role && !user.roles.includes(role)) return { status: 'checking', retry: refresh }

  return { status: 'authorized', retry: refresh }
}

function AuthGate({
  status,
  onRetry,
  children,
}: {
  status: GateStatus
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
  return <FullPageLoader label="Checking session…" />
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
