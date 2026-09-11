import { rest } from 'msw'
import type { Role } from '../lib/auth'
import type { InteractionDetail } from '../lib/interactions'
import type { QueueEntry } from '../lib/queue'
import type { QualificationCreateRequest, QualificationResponse } from '../lib/qualification'
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

// Seed the closer Active Call snapshot so /closer loads Figma-matching data
// without requiring a fronter save first.
;(() => {
  const now = new Date().toISOString()
  MOCK_QUALIFICATIONS.set('int-1001', {
    id: 'qual-seed-1001',
    interaction_id: 'int-1001',
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
      notes: 'Customer mentioned transmission noise',
      override: { applied: false, reason: '' },
      vehicle: '2019 Toyota Camry',
      mileage: '62,400',
      state: 'TX',
      warranty_status: 'Expired',
    } as QualificationResponse['snapshot_json'],
    consent_dnc: {
      consent_given: true,
      consent_captured_at: now,
      dnc_flagged: false,
      dnc_source: null,
    },
    created_at: now,
    updated_at: now,
  })

  MOCK_TRANSFERS.set('transfer-for-int-1001', {
    id: 'transfer-for-int-1001',
    interaction_id: 'int-1001',
    // Screen 6 opens on an already-accepted transfer.
    status: 'accepted',
    fronter_user_id: '1',
    closer_user_id: '2',
    created_at: now,
    updated_at: now,
  })
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
      return res(ctx.status(401), ctx.json({ detail: 'Incorrect email or password.' }))
    }

    const token = `mock-token-${user.id}-${Date.now()}`
    MOCK_TOKENS.set(token, user)

    return res(
      ctx.status(200),
      ctx.json({
        access_token: token,
        refresh_token: `mock-refresh-${user.id}`,
        token_type: 'bearer' as const,
        expires_in_min: 60,
      })
    )
  }),

  rest.get('/auth/me', (req, res, ctx) => {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace(/^Bearer\s+/i, '')
    const user = MOCK_TOKENS.get(token)

    if (!user) {
      return res(ctx.status(401), ctx.json({ detail: 'Not authenticated.' }))
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
