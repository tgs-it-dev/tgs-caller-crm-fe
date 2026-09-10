"use client"
import { useEffect } from 'react'
import { waitForMocking } from '@/lib/mockReady'

export default function MockProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Kick off MSW early so the first authenticated fetch after a reload
    // doesn't race worker registration. waitForMocking() is safe to call
    // repeatedly — it shares one in-flight start and re-activates if needed.
    void waitForMocking()
  }, [])

  return <>{children}</>
}
