'use client'

import { ReactNode, useEffect } from 'react'
import { waitForMocking } from '@/lib/mockReady'

/**
 * Starts MSW only when `NEXT_PUBLIC_API_URL` is unset (see `waitForMocking`).
 * With a live API URL this unregisters any leftover mock service worker and
 * does not start MSW.
 */
export default function MockProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    void waitForMocking()
  }, [])

  return <>{children}</>
}
