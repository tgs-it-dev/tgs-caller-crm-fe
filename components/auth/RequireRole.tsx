'use client'

import { ReactNode, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { clearToken, getCurrentUser, readToken, Role } from '@/lib/auth'
import { waitForMocking } from '@/lib/mockReady'

type Status = 'checking' | 'authorized'

function useAuthorization(isAllowed: (roles: Role[]) => boolean) {
  const router = useRouter()
  const [status, setStatus] = useState<Status>('checking')

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
        if (!isAllowed(user.roles)) {
          router.replace('/login')
          return
        }
        setStatus('authorized')
      })
      .catch(() => {
        if (cancelled) return
        clearToken()
        router.replace('/login')
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  return status
}

export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const status = useAuthorization((roles) => roles.includes(role))
  if (status !== 'authorized') return null
  return <>{children}</>
}

// For screens any signed-in agent may view, regardless of role.
export function RequireAuth({ children }: { children: ReactNode }) {
  const status = useAuthorization(() => true)
  if (status !== 'authorized') return null
  return <>{children}</>
}
