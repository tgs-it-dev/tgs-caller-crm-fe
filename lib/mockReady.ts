import { isLiveApi } from '@/lib/apiUrl'

// Waits for MSW's browser worker (registered by app/providers/MockProvider.tsx)
// to finish starting before the caller makes its first request. Only
// meaningful when there's no real backend configured — once
// NEXT_PUBLIC_API_URL points at one, there's no mock worker to wait for.
//
// Also re-activates the current browsing context when the service worker has
// dropped it from activeClientIds (common after App Router client navigations).
// Without that, API fetches fall through to Next.js and 404.

let readyPromise: Promise<void> | null = null
let isRestarting = false

async function startMockWorker(): Promise<void> {
  const { worker } = await import('../mocks/browser')
  await worker.start({ onUnhandledRequest: 'bypass' })
}

function startOrReuse(): Promise<void> {
  if (!readyPromise) {
    readyPromise = startMockWorker().catch((err) => {
      readyPromise = null
      throw err
    })
  }
  return readyPromise
}

async function unregisterLeftoverMockWorker(): Promise<void> {
  // A prior mock-mode session can leave mockServiceWorker.js registered even
  // after NEXT_PUBLIC_API_URL is set. It won't intercept cross-origin API
  // calls, but it can still answer same-origin probes / stray relative fetches.
  if (!('serviceWorker' in navigator)) return
  const regs = await navigator.serviceWorker.getRegistrations()
  await Promise.all(
    regs
      .filter((reg) => reg.active?.scriptURL.includes('mockServiceWorker'))
      .map((reg) => reg.unregister())
  )
}

export async function waitForMocking(): Promise<void> {
  if (typeof window === 'undefined') return
  // Live BE: never start MSW; clear any leftover worker from a prior mock session.
  if (isLiveApi()) {
    await unregisterLeftoverMockWorker()
    return
  }

  await startOrReuse()

  // Probe a known mock route. If the SW no longer treats this client as
  // active, the request reaches Next.js (404) and we must re-send
  // MOCK_ACTIVATE via worker.start().
  const probe = await fetch('/health')
  if (probe.ok) return

  // Same coalescing as initial startup: concurrent callers that all see a
  // failed probe must share one worker.start(), not race redundant restarts.
  if (!isRestarting) {
    isRestarting = true
    readyPromise = startMockWorker()
      .catch((err) => {
        readyPromise = null
        throw err
      })
      .finally(() => {
        isRestarting = false
      })
  }
  await readyPromise
}
