// Waits for MSW's browser worker (registered by app/providers/MockProvider.tsx)
// to finish starting before the caller makes its first request. Only
// meaningful when there's no real backend configured — once
// NEXT_PUBLIC_API_URL points at one, there's no mock worker to wait for.
//
// Also re-activates the current browsing context when the service worker has
// dropped it from activeClientIds (common after App Router client navigations).
// Without that, API fetches fall through to Next.js and 404.

let readyPromise: Promise<void> | null = null

async function startMockWorker(): Promise<void> {
  const { worker } = await import('../mocks/browser')
  await worker.start({ onUnhandledRequest: 'bypass' })
}

export async function waitForMocking(): Promise<void> {
  if (typeof window === 'undefined') return
  if (process.env.NEXT_PUBLIC_API_URL) return

  if (!readyPromise) {
    readyPromise = startMockWorker().catch((err) => {
      readyPromise = null
      throw err
    })
  }
  await readyPromise

  // Probe a known mock route. If the SW no longer treats this client as
  // active, the request reaches Next.js (404) and we must re-send
  // MOCK_ACTIVATE via worker.start().
  const probe = await fetch('/health')
  if (probe.ok) return

  readyPromise = startMockWorker().catch((err) => {
    readyPromise = null
    throw err
  })
  await readyPromise
}
