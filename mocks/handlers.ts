import { rest } from 'msw'
import type { Role } from '../lib/auth'
import { CLOSER_DESK_SEEDS } from '../lib/closer'
import type { InteractionDetail } from '../lib/interactions'
import { PUSH_INTERVAL_MS, type AgentStatus, type LiveStatus } from '../lib/liveStatus'
import type { QueueEntry } from '../lib/queue'
import type { QualificationCreateRequest, QualificationResponse } from '../lib/qualification'
import type { HistoricalFunnel } from '../lib/reporting'
import type { TransferCreateRequest, TransferResponse } from '../lib/transfers'

type MockUser = {
  id: string
  email: string
  password: string
  name: string
  roles: Role[]
}

// Demo accounts for local/dev use only, until the real /auth endpoints ship (week 2).
const MOCK_USERS: MockUser[] = [
  { id: '1', email: 'fronter@tgs.com', password: 'password1', name: 'Fiona Fronter', roles: ['fronter'] },
  { id: '2', email: 'closer@tgs.com', password: 'password1', name: 'Carl Closer', roles: ['closer'] },
  { id: '3', email: 'admin@tgs.com', password: 'password1', name: 'Ana Admin', roles: ['administrator'] },
]

const MOCK_TOKENS = new Map<string, MockUser>()
// Rotated like the real API's: each refresh token works once.
const MOCK_REFRESH_TOKENS = new Map<string, MockUser>()

// The real API's error envelope, with the same codes, so error handling behaves
// the same against mocks as against it.
function authErrorBody(detail: string, code: string) {
  return { detail, code }
}

// Not crypto.randomUUID(): it doesn't exist outside a secure context, and the
// dev server is reachable over the network by plain http.
let issued = 0

function issueMockTokens(user: MockUser) {
  const serial = ++issued
  const accessToken = `mock-token-${user.id}-${serial}`
  const refreshToken = `mock-refresh-${user.id}-${serial}`
  MOCK_TOKENS.set(accessToken, user)
  MOCK_REFRESH_TOKENS.set(refreshToken, user)
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: 'bearer' as const,
    expires_in_min: 15,
  }
}

// The live dashboard's agents, in name order as the API sends them. Each steps
// to its next status every push interval, so mock mode shows the page updating.
const MOCK_AGENTS: { id: string; name: string; role: 'fronter' | 'closer' }[] = [
  { id: '5a1f0c3e-0001-4000-8000-000000000001', name: 'Carl Closer', role: 'closer' },
  { id: '5a1f0c3e-0002-4000-8000-000000000002', name: 'Dana Reyes', role: 'fronter' },
  { id: '5a1f0c3e-0003-4000-8000-000000000003', name: 'Eli Brooks', role: 'closer' },
  { id: '5a1f0c3e-0004-4000-8000-000000000004', name: 'Fiona Fronter', role: 'fronter' },
  { id: '5a1f0c3e-0005-4000-8000-000000000005', name: 'Gwen Park', role: 'fronter' },
]

const STATUS_CYCLE: Record<'fronter' | 'closer', AgentStatus[]> = {
  fronter: ['available', 'in_qualification', 'available', 'offline'],
  closer: ['available', 'on_call', 'on_call', 'offline'],
}

const isBusy = (status: AgentStatus) => status === 'on_call' || status === 'in_qualification'

function mockLiveStatus(): LiveStatus {
  const tick = Math.floor(Date.now() / PUSH_INTERVAL_MS)
  // Every fourth push nobody is on a call, so the quiet dashboard shows up too.
  const quiet = tick % 4 === 0
  const since = new Date(tick * PUSH_INTERVAL_MS).toISOString()
  const agents = MOCK_AGENTS.map((agent, index) => {
    const cycle = STATUS_CYCLE[agent.role]
    const next = cycle[(tick + index) % cycle.length]
    const status = quiet && isBusy(next) ? 'available' : next
    return {
      user_id: agent.id,
      name: agent.name,
      role: agent.role,
      status,
      current_interaction_id: isBusy(status) ? `5a1f0c3e-1000-4000-8000-00000000000${index}` : null,
      since,
    }
  })

  return {
    generated_at: new Date().toISOString(),
    timezone: 'America/New_York',
    agents,
    active_calls: agents.filter((agent) => isBusy(agent.status)).length,
    pending_transfers: tick % 3,
    funnel_today: {
      leads: 26 + (tick % 20),
      interactions: 30 + (tick % 20),
      qualifications: 12 + (tick % 7),
      transfers_initiated: 8 + (tick % 5),
      transfers_accepted: 5 + (tick % 3),
      transfers_rejected: 1 + (tick % 2),
      sales: 2 + (tick % 2),
    },
  }
}

/** Why an administrator-only route would turn this request away, or null. */
function adminRefusal(authorization: string | null) {
  const user = MOCK_TOKENS.get((authorization || '').replace(/^Bearer\s+/i, ''))
  if (!user) {
    return {
      status: 401,
      body: authErrorBody('Could not validate credentials', 'auth.not_authenticated'),
    }
  }
  if (!user.roles.includes('administrator')) {
    return {
      status: 403,
      body: authErrorBody('Insufficient role for this operation', 'auth.forbidden'),
    }
  }
  return null
}

/**
 * Funnel counts for a window, worked out from the window itself so the same
 * dates always answer the same figures and a different range visibly moves them.
 */
function mockFunnel(start: string, end: string): HistoricalFunnel {
  const days = Math.max(1, Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000) + 1)
  const attempts = days * 40 + (Number(start.replace(/-/g, '')) % 97)
  const connects = Math.round(attempts * 0.67)
  const qualified = Math.round(connects * 0.62)

  return {
    start,
    end,
    timezone: 'America/New_York',
    attempts,
    connects,
    qualified,
    transfer_attempts: Math.round(qualified * 0.48),
  }
}

// Seed data for the fronter workspace screen (FE-02). Standing in for the
// backend's `/interactions`, `/qualification`, and `/transfers` endpoints,
// none of which are implemented yet (interactions/dispositions aren't even
// contract-frozen). Swap this block out with no frontend code changes once
// those ship for real.
const MOCK_INTERACTIONS: Record<string, InteractionDetail> = {
  'int-1001': {
    id: 'int-1001',
    status: 'active',
    started_at: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    lead: {
      id: 'lead-1',
      phone_normalized: '+13235550142',
      source: 'vicidial',
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
    },
  },
  'int-1002': {
    id: 'int-1002',
    status: 'active',
    started_at: new Date(Date.now() - 90 * 1000).toISOString(),
    lead: {
      id: 'lead-2',
      phone_normalized: '+14085550199',
      source: 'ghl',
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString(),
    },
  },
  'int-1102': {
    id: 'int-1102',
    status: 'active',
    started_at: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
    lead: {
      id: 'lead-1102',
      phone_normalized: '+13105550188',
      source: 'vicidial',
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    },
  },
  'int-1103': {
    id: 'int-1103',
    status: 'active',
    started_at: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    lead: {
      id: 'lead-1103',
      phone_normalized: '+18135550177',
      source: 'ghl',
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 8).toISOString(),
    },
  },
}

// Seed for the fronter Queue screen. Deterministic rather than randomised so
// the table, wait times, and pagination look identical on every reload, and so
// nothing depends on ordering luck. `/queue` doesn't exist on the backend yet —
// see the contract note in lib/queue.ts.
const QUEUE_LEAD_NAMES = [
  'Mubeen N.',
  'Alicia R.',
  'Devon M.',
  'Priya S.',
  'Marcus T.',
  'Elena V.',
  'Jordan K.',
  'Sofia L.',
]

const QUEUE_CAMPAIGNS = [
  'Auto Warranty — Q3',
  'Extended Coverage',
  'Renewal Outreach',
  'Mileage Expiry',
]

const QUEUE_SEEDED_AT = Date.now()

// 48 rows so the 5-per-page table paginates across 10 pages like the design.
const MOCK_QUEUE: QueueEntry[] = Array.from({ length: 48 }, (_, index) => ({
  id: `int-${2000 + index}`,
  lead_name: QUEUE_LEAD_NAMES[index % QUEUE_LEAD_NAMES.length],
  lead_phone: `+1323555${(1000 + index).toString().slice(-4)}`,
  campaign_name: QUEUE_CAMPAIGNS[index % QUEUE_CAMPAIGNS.length],
  // Staggered so the top of the queue has waited longest (first row = 03:12).
  queued_at: new Date(QUEUE_SEEDED_AT - (192 - index * 4) * 1000).toISOString(),
  status: index % 7 === 0 ? 'ringing' : 'waiting',
}))

const MOCK_QUALIFICATIONS = new Map<string, QualificationResponse>()
let qualificationSeq = 0
let transferSeq = 0

const MOCK_TRANSFERS = new Map<string, TransferResponse>()

// Seed Today's Disposition rows so each closer workspace link has a matching
// qualification + already-accepted transfer. Keep in sync with CLOSER_DESK_SEEDS.
;(() => {
  const now = new Date().toISOString()
  for (const seed of CLOSER_DESK_SEEDS) {
    MOCK_QUALIFICATIONS.set(seed.interaction_id, {
      id: `qual-seed-${seed.interaction_id}`,
      interaction_id: seed.interaction_id,
      version: 1,
      // Closer snapshot fields live alongside the fronter checklist until BE
      // freezes a dedicated closer read DTO.
      snapshot_json: {
        checklist: {
          identityVerified: true,
          vehicleDetailsConfirmed: true,
          warrantyNeedConfirmed: true,
          budgetDiscussed: true,
          decisionMakerConfirmed: true,
        },
        disposition: 'qualified',
        notes: seed.snapshot.notes,
        override: { applied: false, reason: '' },
        vehicle: seed.snapshot.vehicle,
        mileage: seed.snapshot.mileage,
        state: seed.snapshot.state,
        warranty_status: seed.snapshot.warranty_status,
      } as QualificationResponse['snapshot_json'],
      consent_dnc: {
        consent_given: seed.consent_given,
        consent_captured_at: seed.consent_given ? now : null,
        dnc_flagged: seed.dnc_flagged,
        dnc_source: null,
      },
      created_at: now,
      updated_at: now,
    })

    MOCK_TRANSFERS.set(seed.transfer_id, {
      id: seed.transfer_id,
      interaction_id: seed.interaction_id,
      // Screen 6 opens on an already-accepted transfer.
      status: 'accepted',
      fronter_user_id: '1',
      closer_user_id: '2',
      created_at: now,
      updated_at: now,
    })
  }
})()

type MockDisposition = {
  id: string
  label: string
  stage: 'fronter' | 'closer'
}

type MockInteractionDisposition = {
  id: string
  interaction_id: string
  disposition_id: string
  label: string
  stage: 'fronter' | 'closer'
  actor_user_id: string
  version: number
  created_at: string
}

const MOCK_DISPOSITION_CATALOG: MockDisposition[] = [
  { id: 'disp-closer-sale', label: 'Sale completed', stage: 'closer' },
  { id: 'disp-closer-callback', label: 'Callback requested', stage: 'closer' },
  { id: 'disp-closer-not-interested', label: 'Not interested', stage: 'closer' },
  { id: 'disp-closer-dnc', label: 'Do not call', stage: 'closer' },
  { id: 'disp-fronter-qualified', label: 'Qualified — ready to transfer', stage: 'fronter' },
]

const MOCK_INTERACTION_DISPOSITIONS = new Map<string, MockInteractionDisposition[]>()
let interactionDispositionSeq = 0

export const handlers = [
  rest.get('http://localhost:4000/health', (req, res, ctx) => {
    return res(ctx.status(200), ctx.json({ status: 'ok' }))
  }),
  // Example: health from relative path
  rest.get('/health', (req, res, ctx) => {
    return res(ctx.status(200), ctx.json({ status: 'ok' }))
  }),

  rest.post('/auth/login', async (req, res, ctx) => {
    const { email, password } = await req.json()
    const user = MOCK_USERS.find((u) => u.email === email && u.password === password)

    if (!user) {
      return res(
        ctx.status(401),
        ctx.json(authErrorBody('Incorrect email or password', 'auth.invalid_credentials'))
      )
    }

    return res(ctx.status(200), ctx.json(issueMockTokens(user)))
  }),

  rest.post('/auth/refresh', async (req, res, ctx) => {
    const { refresh_token } = await req.json()
    const user = MOCK_REFRESH_TOKENS.get(refresh_token)

    if (!user) {
      return res(
        ctx.status(401),
        ctx.json(authErrorBody('Invalid refresh token', 'auth.invalid_refresh_token'))
      )
    }

    MOCK_REFRESH_TOKENS.delete(refresh_token)
    return res(ctx.status(200), ctx.json(issueMockTokens(user)))
  }),

  rest.post('/auth/logout', async (req, res, ctx) => {
    const { refresh_token } = await req.json()
    MOCK_REFRESH_TOKENS.delete(refresh_token)
    return res(ctx.status(204))
  }),

  rest.get('/auth/me', (req, res, ctx) => {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace(/^Bearer\s+/i, '')
    const user = MOCK_TOKENS.get(token)

    if (!user) {
      return res(
        ctx.status(401),
        ctx.json(authErrorBody('Could not validate credentials', 'auth.not_authenticated'))
      )
    }

    return res(
      ctx.status(200),
      ctx.json({
        id: user.id,
        email: user.email,
        name: user.name,
        active: true,
        roles: user.roles,
        created_at: new Date().toISOString(),
      })
    )
  }),

  rest.get('/reporting/live', (req, res, ctx) => {
    const refused = adminRefusal(req.headers.get('authorization'))
    if (refused) return res(ctx.status(refused.status), ctx.json(refused.body))

    return res(ctx.status(200), ctx.json(mockLiveStatus()))
  }),

  rest.get('/reporting/funnel', (req, res, ctx) => {
    const refused = adminRefusal(req.headers.get('authorization'))
    if (refused) return res(ctx.status(refused.status), ctx.json(refused.body))

    const start = req.url.searchParams.get('start')
    const end = req.url.searchParams.get('end')
    if (!start || !end) {
      return res(ctx.status(422), ctx.json(authErrorBody('Field required', 'validation_error')))
    }

    return res(ctx.status(200), ctx.json(mockFunnel(start, end)))
  }),

  rest.get('/interactions', (req, res, ctx) => {
    return res(ctx.status(200), ctx.json(Object.values(MOCK_INTERACTIONS)))
  }),

  rest.get('/queue', (req, res, ctx) => {
    return res(ctx.status(200), ctx.json(MOCK_QUEUE))
  }),

  rest.get('/interactions/:interactionId', (req, res, ctx) => {
    const interaction = MOCK_INTERACTIONS[req.params.interactionId as string]
    if (!interaction) {
      return res(ctx.status(404), ctx.json({ detail: 'Interaction not found.' }))
    }
    return res(ctx.status(200), ctx.json(interaction))
  }),

  rest.get('/qualification/:interactionId', (req, res, ctx) => {
    const saved = MOCK_QUALIFICATIONS.get(req.params.interactionId as string)
    if (!saved) {
      return res(ctx.status(404), ctx.json({ detail: 'No qualification saved yet.' }))
    }
    return res(ctx.status(200), ctx.json(saved))
  }),

  rest.post('/qualification', async (req, res, ctx) => {
    const body = (await req.json()) as QualificationCreateRequest
    const existing = MOCK_QUALIFICATIONS.get(body.interaction_id)
    const now = new Date().toISOString()

    const record: QualificationResponse = {
      id: existing?.id ?? `qual-${++qualificationSeq}`,
      interaction_id: body.interaction_id,
      version: (existing?.version ?? 0) + 1,
      snapshot_json: body.snapshot_json,
      consent_dnc: body.consent_dnc,
      created_at: existing?.created_at ?? now,
      updated_at: now,
    }
    MOCK_QUALIFICATIONS.set(body.interaction_id, record)

    return res(ctx.status(201), ctx.json(record))
  }),

  rest.post('/transfers', async (req, res, ctx) => {
    const body = (await req.json()) as TransferCreateRequest
    const now = new Date().toISOString()

    const transfer: TransferResponse = {
      id: `transfer-${++transferSeq}`,
      interaction_id: body.interaction_id,
      status: 'offered',
      fronter_user_id: body.fronter_user_id,
      closer_user_id: null,
      created_at: now,
      updated_at: now,
    }
    MOCK_TRANSFERS.set(transfer.id, transfer)

    return res(ctx.status(201), ctx.json(transfer))
  }),

  // Accept/reject offer UI is out of scope for FE-03 / Screen 6 (workspace
  // assumes an already-accepted transfer). Keep these routes for a later
  // closer-offer screen rather than inventing that UI here.
  rest.post('/transfers/:transferId/accept', async (req, res, ctx) => {
    const transferId = req.params.transferId as string
    const body = (await req.json()) as { closer_user_id: string }
    const existing = MOCK_TRANSFERS.get(transferId)
    const now = new Date().toISOString()

    const transfer: TransferResponse = {
      id: transferId,
      interaction_id: existing?.interaction_id ?? 'int-1001',
      status: 'accepted',
      fronter_user_id: existing?.fronter_user_id ?? '1',
      closer_user_id: body.closer_user_id,
      created_at: existing?.created_at ?? now,
      updated_at: now,
    }
    MOCK_TRANSFERS.set(transferId, transfer)

    return res(ctx.status(200), ctx.json(transfer))
  }),

  rest.post('/transfers/:transferId/reject', async (req, res, ctx) => {
    const transferId = req.params.transferId as string
    const body = (await req.json()) as { closer_user_id: string }
    const existing = MOCK_TRANSFERS.get(transferId)
    const now = new Date().toISOString()

    const transfer: TransferResponse = {
      id: transferId,
      interaction_id: existing?.interaction_id ?? 'int-1001',
      status: 'rejected',
      fronter_user_id: existing?.fronter_user_id ?? '1',
      closer_user_id: body.closer_user_id,
      created_at: existing?.created_at ?? now,
      updated_at: now,
    }
    MOCK_TRANSFERS.set(transferId, transfer)

    return res(ctx.status(200), ctx.json(transfer))
  }),

  rest.get('/transfers/:transferId', (req, res, ctx) => {
    const transfer = MOCK_TRANSFERS.get(req.params.transferId as string)
    if (!transfer) {
      return res(ctx.status(404), ctx.json({ detail: 'Transfer not found.' }))
    }
    return res(ctx.status(200), ctx.json(transfer))
  }),

  rest.get('/dispositions', (req, res, ctx) => {
    const stage = req.url.searchParams.get('stage')
    const items =
      stage === 'fronter' || stage === 'closer'
        ? MOCK_DISPOSITION_CATALOG.filter((d) => d.stage === stage)
        : MOCK_DISPOSITION_CATALOG
    return res(ctx.status(200), ctx.json({ items }))
  }),

  rest.get('/interactions/:interactionId/dispositions', (req, res, ctx) => {
    const interactionId = req.params.interactionId as string
    const items = MOCK_INTERACTION_DISPOSITIONS.get(interactionId) ?? []
    return res(ctx.status(200), ctx.json({ items }))
  }),

  rest.post('/interactions/:interactionId/dispositions', async (req, res, ctx) => {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace(/^Bearer\s+/i, '')
    const actor = MOCK_TOKENS.get(token)
    if (!actor) {
      return res(ctx.status(401), ctx.json({ detail: 'Not authenticated.' }))
    }

    const interactionId = req.params.interactionId as string
    const body = (await req.json()) as { disposition_id: string }
    const catalog = MOCK_DISPOSITION_CATALOG.find((d) => d.id === body.disposition_id)
    if (!catalog) {
      return res(ctx.status(422), ctx.json({ detail: 'Unknown disposition.' }))
    }

    const existing = MOCK_INTERACTION_DISPOSITIONS.get(interactionId) ?? []
    const stageVersions = existing.filter((d) => d.stage === catalog.stage)
    const version = (stageVersions.at(-1)?.version ?? 0) + 1
    const now = new Date().toISOString()

    const record: MockInteractionDisposition = {
      id: `int-disp-${++interactionDispositionSeq}`,
      interaction_id: interactionId,
      disposition_id: catalog.id,
      label: catalog.label,
      stage: catalog.stage,
      actor_user_id: actor.id,
      version,
      created_at: now,
    }
    MOCK_INTERACTION_DISPOSITIONS.set(interactionId, [...existing, record])

    return res(ctx.status(201), ctx.json(record))
  }),
]
