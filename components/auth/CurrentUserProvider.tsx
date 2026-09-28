'use client'

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  AuthError,
  CurrentUser,
  clearSession,
  getCurrentUser,
  readToken,
} from '@/lib/auth'
import { waitForMocking } from '@/lib/mockReady'
import { signOut as endSession, withSession } from '@/lib/session'

type CurrentUserState =
  | { status: 'loading'; user: null }
  | { status: 'ready'; user: CurrentUser }
  | { status: 'error'; user: null }

type CurrentUserContextValue = CurrentUserState & {
  /** Re-fetch `GET /auth/me` (busts the in-tab cache). */
  refresh: () => Promise<void>
  /** Seed profile from an already-fetched `/auth/me` payload (e.g. right after login). */
  hydrate: (user: CurrentUser) => void
  signOut: () => void
}

const CurrentUserContext = createContext<CurrentUserContextValue | null>(null)

/**
 * One `/auth/me` per tab until busted. Survives React Strict Mode remounts
 * (dev) and fast mock responses that would otherwise finish before the
 * remount and trigger a second network call.
 */
let cachedUser: Promise<CurrentUser> | null = null

function loadCurrentUser(bust = false): Promise<CurrentUser> {
  if (bust) cachedUser = null
  if (!cachedUser) {
    cachedUser = waitForMocking()
      .then(() => withSession(getCurrentUser))
      .catch((err) => {
        cachedUser = null
        throw err
      })
  }
  return cachedUser
}

function clearCachedUser() {
  cachedUser = null
}

async function resolveCurrentUser(bust = false): Promise<CurrentUserState> {
  if (!readToken()) return { status: 'error', user: null }

  try {
    const user = await loadCurrentUser(bust)
    return { status: 'ready', user }
  } catch (err) {
    // Only a confirmed 401 means the session is gone. Network blips and 5xx
    // leave the token so Retry can try again.
    if (err instanceof AuthError && err.status === 401) {
      await clearSession()
    }
    return { status: 'error', user: null }
  }
}

/**
 * App-wide profile from `GET /auth/me` — name, email, roles, id, active.
 * Mount once in AppProviders; desk layouts and login consume via `useCurrentUser`.
 */
export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CurrentUserState>({ status: 'loading', user: null })

  const refresh = useCallback(async () => {
    setState({ status: 'loading', user: null })
    setState(await resolveCurrentUser(true))
  }, [])

  const hydrate = useCallback((user: CurrentUser) => {
    cachedUser = Promise.resolve(user)
    setState({ status: 'ready', user })
  }, [])

  useEffect(() => {
    let cancelled = false

    // resolveCurrentUser() itself resolves to the 'error' state when there's
    // no token, so a duplicate synchronous check isn't needed here.
    void resolveCurrentUser().then((next) => {
      if (!cancelled) setState(next)
    })

    return () => {
      cancelled = true
    }
  }, [])

  const signOut = useCallback(() => {
    clearCachedUser()
    endSession()
    setState({ status: 'error', user: null })
  }, [])

  const value = useMemo(
    () => ({
      ...state,
      refresh,
      hydrate,
      signOut,
    }),
    [state, refresh, hydrate, signOut]
  )

  return <CurrentUserContext.Provider value={value}>{children}</CurrentUserContext.Provider>
}

export function useCurrentUser() {
  const ctx = useContext(CurrentUserContext)
  if (!ctx) {
    throw new Error('useCurrentUser must be used within CurrentUserProvider')
  }
  return ctx
}
