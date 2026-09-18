'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ACCESS_TOKEN_KEY, EXPIRES_AT_KEY, readExpiresAt, readRefreshToken } from '@/lib/auth'
import { SESSION_ENDED, refreshSession } from '@/lib/session'

// Early enough that a request sent just before expiry never carries a token
// that dies in flight.
const RENEW_BEFORE_MS = 60_000
const RETRY_AFTER_MS = 15_000

/**
 * Keeps the stored access token fresh while a session exists, and sends the tab
 * to /login once the session ends — here or in another tab. Renders nothing.
 *
 * Every data call reads the token from storage when it sends, so renewing it
 * here is enough — none of them need to know about refresh tokens.
 */
export function SessionKeeper() {
  const router = useRouter()
  // Signing in happens in this tab without a storage event, so the navigation
  // that follows is the cue to start keeping the new session.
  const pathname = usePathname()

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    // A renewal can outlive the effect that started it; without this, its `then`
    // would schedule a second chain of timers nothing clears.
    let cancelled = false

    const tick = () => {
      if (cancelled) return
      clearTimeout(timer)
      const expiresAt = readExpiresAt()
      if (expiresAt === null || !readRefreshToken()) return

      const wait = expiresAt - RENEW_BEFORE_MS - Date.now()
      if (wait > 0) {
        timer = setTimeout(tick, wait)
        return
      }
      // A failed renewal that ended the session leaves nothing to retry: the
      // next tick sees no refresh token and stops.
      refreshSession().then(tick, () => {
        timer = setTimeout(tick, RETRY_AFTER_MS)
      })
    }

    // Timers don't run while a laptop sleeps; catch up when the page is back.
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick()
    }

    // Nothing may carry on without a session — an open socket least of all.
    const toLogin = () => router.replace('/login')

    const onStorage = (event: StorageEvent) => {
      const signedOut =
        event.key === null || (event.key === ACCESS_TOKEN_KEY && event.newValue === null)
      if (signedOut) {
        toLogin()
      } else if (event.key === EXPIRES_AT_KEY) {
        tick()
      }
    }

    tick()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', tick)
    window.addEventListener('storage', onStorage)
    window.addEventListener(SESSION_ENDED, toLogin)
    return () => {
      cancelled = true
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', tick)
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(SESSION_ENDED, toLogin)
    }
  }, [router, pathname])

  return null
}
