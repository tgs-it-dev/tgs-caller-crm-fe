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
import { CurrentUser, clearToken, getCurrentUser, readToken } from '@/lib/auth'
import { waitForMocking } from '@/lib/mockReady'

type CurrentUserState =
  | { status: 'loading'; user: null }
  | { status: 'ready'; user: CurrentUser }
  | { status: 'error'; user: null }

type CurrentUserContextValue = CurrentUserState & {
  refresh: () => Promise<void>
  signOut: () => void
}

const CurrentUserContext = createContext<CurrentUserContextValue | null>(null)

export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CurrentUserState>({ status: 'loading', user: null })

  const refresh = useCallback(async () => {
    const token = readToken()
    if (!token) {
      setState({ status: 'error', user: null })
      return
    }

    try {
      await waitForMocking()
      const user = await getCurrentUser(token)
      setState({ status: 'ready', user })
    } catch {
      setState({ status: 'error', user: null })
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const signOut = useCallback(() => {
    clearToken()
    setState({ status: 'error', user: null })
  }, [])

  const value = useMemo(
    () => ({
      ...state,
      refresh,
      signOut,
    }),
    [state, refresh, signOut]
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
