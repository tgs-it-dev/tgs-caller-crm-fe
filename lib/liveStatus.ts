import type { components } from '@/lib/generated/schema'
import { apiUrl, wsUrl } from '@/lib/apiUrl'
import { AuthError, authError } from '@/lib/auth'
import { waitForMocking } from '@/lib/mockReady'
import { withSession } from '@/lib/session'

export type LiveStatus = components['schemas']['LiveStatusResponse']
export type AgentLiveStatus = components['schemas']['AgentLiveStatus']
export type AgentStatus = AgentLiveStatus['status']
type Ticket = components['schemas']['TicketResponse']

/** What the socket sends. Sockets aren't in the OpenAPI document, so this is written by hand. */
type Frame = { type: 'live_status'; data: LiveStatus } | { type: 'ping' }

/** How often the server pushes a fresh snapshot. */
export const PUSH_INTERVAL_MS = 15_000
// The server pings after 20s with nothing to send, so a socket silent for longer
// than this has died without the browser noticing.
const SILENCE_LIMIT_MS = 45_000
const MAX_RETRY_DELAY_MS = 30_000

async function fetchLiveStatus(token: string): Promise<LiveStatus> {
  const res = await fetch(apiUrl('/reporting/live'), {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw await authError(res)
  return res.json() as Promise<LiveStatus>
}

async function mintTicket(token: string): Promise<Ticket> {
  const res = await fetch(apiUrl('/realtime/ticket'), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw await authError(res)
  return res.json() as Promise<Ticket>
}

function parseFrame(data: unknown): Frame | null {
  if (typeof data !== 'string') return null
  try {
    return JSON.parse(data) as Frame
  } catch {
    return null
  }
}

/**
 * Follow the live dashboard: the snapshot as it stands, then every one the
 * server pushes. Returns a function that stops watching.
 *
 * The socket doesn't replay what was sent before it opened, so every connection
 * is followed by a fresh read. A dropped socket reconnects by itself, backing
 * off, with a new ticket each time — a ticket is spent the moment it's used.
 */
export function watchLiveStatus({
  onSnapshot,
  onError,
}: {
  onSnapshot: (snapshot: LiveStatus) => void
  /** Watching has stopped for good: the session ended, or the role was taken away. */
  onError: (err: AuthError) => void
}): () => void {
  let stopped = false
  let socket: WebSocket | null = null
  let retryTimer: ReturnType<typeof setTimeout> | undefined
  let silenceTimer: ReturnType<typeof setTimeout> | undefined
  let attempt = 0
  let newest = 0

  const drop = (ws: WebSocket) => {
    ws.onopen = null
    ws.onmessage = null
    ws.onclose = null
    ws.close()
    if (socket === ws) socket = null
  }

  const stop = () => {
    stopped = true
    clearTimeout(retryTimer)
    clearTimeout(silenceTimer)
    if (socket) drop(socket)
  }

  const deliver = (snapshot: LiveStatus) => {
    // A reconnect's read and the first push can arrive in either order.
    const generatedAt = Date.parse(snapshot.generated_at)
    if (stopped || generatedAt <= newest) return
    newest = generatedAt
    onSnapshot(snapshot)
  }

  /** True when the error ends the watch — nothing a retry could fix. */
  const isFinal = (err: unknown) => {
    if (!(err instanceof AuthError) || (err.status !== 401 && err.status !== 403)) return false
    stop()
    onError(err)
    return true
  }

  // A read that fails for any other reason is left to the next push to make up.
  const read = () => withSession(fetchLiveStatus).then(deliver, isFinal)

  const address = wsUrl('/realtime/ws')
  if (!address) {
    // No socket to mock, so read at the rate the server would push.
    const poll = () => {
      if (stopped) return
      void read().finally(() => {
        if (!stopped) retryTimer = setTimeout(poll, PUSH_INTERVAL_MS)
      })
    }
    void waitForMocking().then(poll)
    return stop
  }

  const retry = () => {
    if (stopped) return
    clearTimeout(retryTimer)
    const delay = Math.min(1000 * 2 ** attempt, MAX_RETRY_DELAY_MS)
    attempt += 1
    retryTimer = setTimeout(connect, delay)
  }

  const open = (url: string) => {
    const ws = new WebSocket(url)
    socket = ws

    const heardFrom = () => {
      clearTimeout(silenceTimer)
      silenceTimer = setTimeout(() => {
        drop(ws)
        retry()
      }, SILENCE_LIMIT_MS)
    }

    heardFrom()
    ws.onmessage = (event) => {
      attempt = 0
      heardFrom()
      const frame = parseFrame(event.data)
      if (frame?.type === 'live_status') deliver(frame.data)
    }
    ws.onclose = () => {
      clearTimeout(silenceTimer)
      socket = null
      retry()
    }
  }

  const connect = async () => {
    let ticket: string
    try {
      ticket = (await withSession(mintTicket)).ticket
    } catch (err) {
      if (!isFinal(err)) retry()
      return
    }
    if (stopped) return

    open(`${address}?ticket=${encodeURIComponent(ticket)}`)
    void read()
  }

  void connect()
  return stop
}
