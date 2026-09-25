import { rest } from 'msw'
import type { FieldError } from '../lib/apiError'
import type { Role } from '../lib/auth'
import { CLOSER_DESK_SEEDS } from '../lib/closer'
import type { ReconciliationException } from '../lib/exceptions'
import type { CallLeg, InteractionEvent, InteractionTransfer } from '../lib/interactionDetail'
import type { InteractionDetailResponse } from '../lib/interactions'
import type { LeadResponse } from '../lib/leads'
import { PUSH_INTERVAL_MS, type AgentStatus, type LiveStatus } from '../lib/liveStatus'
import type { CloserQueueEntry, FronterQueueEntry } from '../lib/queue'
import type { QualificationCreateRequest, QualificationResponse } from '../lib/qualification'
import type { HistoricalFunnel } from '../lib/reporting'
import type { TransferCreateRequest, TransferResponse } from '../lib/transfers'

type MockUser = {
  id: string
  email: string
  password: string | null
  name: string
  roles: Role[]
  active: boolean
  created_at: string
}

const SEEDED_AT = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString()

// Demo accounts for local/dev use only, until the real /auth endpoints ship (week 2).
// The admin console reads and writes this same list, so a user added there can
// sign in, and one deactivated there stops being able to.
const MOCK_USERS: MockUser[] = [
  { id: '1', email: 'fronter@tgs.com', password: 'password1', name: 'Fiona Fronter', roles: ['fronter'], active: true, created_at: SEEDED_AT },
  // Second fronter — proves /me/stats/today is scoped per logged-in user (FE-08 AC).
  { id: '4', email: 'fronter2@tgs.com', password: 'password1', name: 'Frank Fronter', roles: ['fronter'], active: true, created_at: SEEDED_AT },
  { id: '2', email: 'closer@tgs.com', password: 'password1', name: 'Carl Closer', roles: ['closer'], active: true, created_at: SEEDED_AT },
  { id: '3', email: 'admin@tgs.com', password: 'password1', name: 'Ana Admin', roles: ['administrator'], active: true, created_at: SEEDED_AT },
  // Deactivated, so the list has something to show in that state from the start.
  { id: '5', email: 'former@tgs.com', password: 'password1', name: 'Nadia Former', roles: ['closer'], active: false, created_at: SEEDED_AT },
  // Multi-role, so the sidebar's desk switcher is reachable locally: every other
  // account here holds exactly one role, which is the case that hides it.
  { id: '6', email: 'everything@tgs.com', password: 'password1', name: 'Mo Everything', roles: ['administrator', 'closer', 'fronter'], active: true, created_at: SEEDED_AT },
  // Two desks and no admin — the switcher without an Administrator entry.
  { id: '7', email: 'both@tgs.com', password: 'password1', name: 'Bea Both', roles: ['fronter', 'closer'], active: true, created_at: SEEDED_AT },
]

const KNOWN_ROLES: Role[] = ['fronter', 'closer', 'administrator']

type MockLink = { token: string; userId: string; purpose: 'invite' | 'reset'; state: 'live' | 'used' | 'superseded' | 'expired' }

const MOCK_LINKS: MockLink[] = [
  // Fixed tokens, openable by hand — mock state lives in the page and does not
  // survive a reload, so a freshly issued link cannot be followed here:
  //   /invite/?token=live-link  /invite/?token=expired-link
  //   /invite/?token=used-link  /invite/?token=superseded-link
  { token: 'live-link', userId: '1', purpose: 'invite', state: 'live' },
  { token: 'expired-link', userId: '1', purpose: 'invite', state: 'expired' },
  { token: 'used-link', userId: '1', purpose: 'invite', state: 'used' },
  { token: 'superseded-link', userId: '1', purpose: 'invite', state: 'superseded' },
]

let linkSeq = 0

function issueMockLink(userId: string, purpose: 'invite' | 'reset'): string {
  for (const link of MOCK_LINKS) {
    if (link.userId === userId && link.purpose === purpose && link.state === 'live') {
      link.state = 'superseded'
    }
  }
  const token = `mock-${purpose}-${++linkSeq}`
  MOCK_LINKS.push({ token, userId, purpose, state: 'live' })
  // Mock mode has no mail server, so the link goes where the backend's "log"
  // transport puts it — somewhere a developer can read it.
  const path = purpose === 'invite' ? 'invite' : 'reset-password'
  // Query token so the static S3 export can open the shell without a pre-built path.
  console.info(`[mock email] ${window.location.origin}/${path}/?token=${encodeURIComponent(token)}`)
  return token
}

/**
 * A link ready to be spent, or why it cannot be — in the API's own codes.
 *
 * Returns the link itself so the caller spends the one that was checked, rather
 * than looking it up a second time by a looser key.
 */
function openLink(token: string, purpose: 'invite' | 'reset') {
  const refuse = (status: number, detail: string, reason: string) => ({
    refused: { status, body: authErrorBody(detail, `${purpose}.${reason}`) },
  })
  const link = MOCK_LINKS.find((l) => l.token === token && l.purpose === purpose)
  if (!link) return refuse(404, 'no such link', 'not_found')
  if (link.state === 'used') return refuse(410, 'already used', 'already_redeemed')
  if (link.state === 'superseded') return refuse(410, 'superseded', 'superseded')
  if (link.state === 'expired') return refuse(410, 'expired', 'expired')
  return { link }
}

/** The address as the API stores and matches it, everywhere it handles one. */
function normalizeEmail(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
}

/**
 * The API's 8–72 rule, refused as it would refuse it.
 *
 * The floor counts characters and the ceiling counts bytes, because that is
 * what the two constraints behind it count: a Pydantic `min_length` and
 * bcrypt's own limit.
 */
function passwordRefusal(value: string, field: string) {
  const message =
    value.length < 8
      ? 'String should have at least 8 characters'
      : new TextEncoder().encode(value).length > 72
        ? 'password must be at most 72 bytes'
        : null
  if (!message) return null
  return {
    status: 422,
    body: authErrorBody(message, 'validation_error', [{ field, in: 'body' as const, message }]),
  }
}

let userSeq = MOCK_USERS.length

/** What the API would refuse about a new user, or null. */
function describeUser(body: { email?: string; name?: string; password?: string; roles?: Role[] }) {
  const problem = (field: string, message: string) => ({
    status: 422,
    body: authErrorBody(message, 'validation_error', [{ field, in: 'body' as const, message }]),
  })

  if (!body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    return problem('email', 'value is not a valid email address')
  }
  if (!body.name || !body.name.trim()) return problem('name', 'String should have at least 1 character')
  // Optional now: without one the new user is emailed a link instead.
  if (body.password !== undefined) {
    const refused = passwordRefusal(body.password, 'password')
    if (refused) return refused
  }
  if (!body.roles || body.roles.length === 0) {
    return problem('roles', 'List should have at least 1 item')
  }
  const unknown = body.roles.filter((role) => !KNOWN_ROLES.includes(role))
  if (unknown.length > 0) {
    return {
      status: 422,
      body: authErrorBody(`unknown roles: ${unknown.join(', ')}`, 'user.unknown_roles', [
        { field: 'roles', in: 'body' as const, message: 'unknown role' },
      ]),
    }
  }
  return null
}

/** The wire shape of a user — the mock list carries a password the API never returns. */
function userBody(user: MockUser) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    active: user.active,
    roles: user.roles,
    created_at: user.created_at,
  }
}

const MOCK_TOKENS = new Map<string, MockUser>()
// Rotated like the real API's: each refresh token works once.
const MOCK_REFRESH_TOKENS = new Map<string, MockUser>()

// The real API's error envelope, with the same codes, so error handling behaves
// the same against mocks as against it. `fields` names the input at fault —
// without it a form has nothing to put its message beside.
function authErrorBody(detail: string, code: string, fields?: FieldError[]) {
  return fields ? { detail, code, fields } : { detail, code }
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
  if (!user || !user.active) {
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
// Thin BE interaction detail + separate leads. Queue workspace links use
// `int-2000+` / closer seeds — synthesize anything not listed explicitly.
const MOCK_LEADS: Record<string, LeadResponse> = {
  'lead-1': {
    id: 'lead-1',
    phone_normalized: '+13235550142',
    source: 'vicidial',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
    updated_at: new Date().toISOString(),
  },
  'lead-2': {
    id: 'lead-2',
    phone_normalized: '+14085550199',
    source: 'ghl',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString(),
    updated_at: new Date().toISOString(),
  },
  'lead-1102': {
    id: 'lead-1102',
    phone_normalized: '+13105550188',
    source: 'vicidial',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    updated_at: new Date().toISOString(),
  },
  'lead-1103': {
    id: 'lead-1103',
    phone_normalized: '+18135550177',
    source: 'ghl',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 8).toISOString(),
    updated_at: new Date().toISOString(),
  },
}

const MOCK_INTERACTIONS: Record<string, InteractionDetailResponse> = {
  'int-1001': {
    id: 'int-1001',
    lead_id: 'lead-1',
    created_at: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
    qualification: null,
  },
  'int-1002': {
    id: 'int-1002',
    lead_id: 'lead-2',
    created_at: new Date(Date.now() - 90 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
    qualification: null,
  },
  'int-1102': {
    id: 'int-1102',
    lead_id: 'lead-1102',
    created_at: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
    qualification: null,
  },
  'int-1103': {
    id: 'int-1103',
    lead_id: 'lead-1103',
    created_at: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
    qualification: null,
  },
}

function synthesizeLead(interactionId: string): LeadResponse {
  const leadId = `lead-for-${interactionId}`
  const existing = MOCK_LEADS[leadId]
  if (existing) return existing
  const digits = interactionId.replace(/\D/g, '').slice(-4).padStart(4, '0')
  const lead: LeadResponse = {
    id: leadId,
    phone_normalized: `+1323555${digits}`,
    source: Number(digits) % 2 === 0 ? 'vicidial' : 'ghl',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    updated_at: new Date().toISOString(),
  }
  MOCK_LEADS[leadId] = lead
  return lead
}

function interactionDetail(interactionId: string): InteractionDetailResponse | null {
  const known = MOCK_INTERACTIONS[interactionId]
  if (known) return known
  // Queue rows and unknown workspace ids still need a usable Active Call shell.
  if (!interactionId) return null
  const lead = synthesizeLead(interactionId)
  return {
    id: interactionId,
    lead_id: lead.id,
    created_at: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
    qualification: null,
  }
}

// Seed for the fronter Queue screen. Deterministic rather than randomised so
// the table, wait times, and pagination look identical on every reload, and so
// nothing depends on ordering luck. `GET /queue?role=fronter|closer` is live on
// the backend; this mock keeps the fronter dialer shape for local UI work.
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
const MOCK_FRONTER_QUEUE: FronterQueueEntry[] = Array.from({ length: 48 }, (_, index) => ({
  id: `int-${2000 + index}`,
  lead_name: QUEUE_LEAD_NAMES[index % QUEUE_LEAD_NAMES.length],
  lead_phone: `+1323555${(1000 + index).toString().slice(-4)}`,
  campaign_name: QUEUE_CAMPAIGNS[index % QUEUE_CAMPAIGNS.length],
  // Staggered so the top of the queue has waited longest (first row = 03:12).
  queued_at: new Date(QUEUE_SEEDED_AT - (192 - index * 4) * 1000).toISOString(),
  status: index % 7 === 0 ? 'ringing' : 'waiting',
}))

const MOCK_CLOSER_QUEUE: CloserQueueEntry[] = Array.from({ length: 12 }, (_, index) => ({
  id: `transfer-${3000 + index}`,
  interaction_id: `int-${1100 + index}`,
  lead_phone: `+1323555${(2000 + index).toString().slice(-4)}`,
  fronter_user_id: index % 3 === 0 ? null : `fronter-${(index % 4) + 1}`,
  queued_at: new Date(QUEUE_SEEDED_AT - (120 - index * 5) * 1000).toISOString(),
  // Mix pending offers with this closer's open accepted call (index 1).
  status: index === 1 ? 'accepted' : index % 4 === 0 ? 'offered' : 'initiated',
}))

const MOCK_QUALIFICATIONS = new Map<string, QualificationResponse>()
let qualificationSeq = 0
let transferSeq = 0

const MOCK_TRANSFERS = new Map<string, TransferResponse>()

function seedCloserQualification(
  interactionId: string,
  snapshot: {
    vehicle: string
    mileage: string
    state: string
    warranty_status: string
    notes: string
  },
  consent: { consent_given: boolean; dnc_flagged: boolean }
) {
  const now = new Date().toISOString()
  MOCK_QUALIFICATIONS.set(interactionId, {
    id: `qual-seed-${interactionId}`,
    interaction_id: interactionId,
    version: 1,
    snapshot_json: {
      checklist: {
        identityVerified: true,
        vehicleDetailsConfirmed: true,
        warrantyNeedConfirmed: true,
        budgetDiscussed: true,
        decisionMakerConfirmed: true,
      },
      disposition: 'qualified',
      notes: snapshot.notes,
      override: { applied: false, reason: '' },
      vehicle: snapshot.vehicle,
      vehicle_year: snapshot.vehicle.split(/\s+/)[0] ?? '',
      vehicle_make: snapshot.vehicle.split(/\s+/)[1] ?? '',
      vehicle_model: snapshot.vehicle.split(/\s+/).slice(2).join(' '),
      mileage: snapshot.mileage.replace(/,/g, ''),
      state: snapshot.state,
      warranty_status: snapshot.warranty_status,
    } as QualificationResponse['snapshot_json'],
    consent_dnc: {
      consent_given: consent.consent_given,
      consent_captured_at: consent.consent_given ? now : null,
      dnc_flagged: consent.dnc_flagged,
      dnc_source: null,
    },
    created_at: now,
    updated_at: now,
  })
}

// Seed Today's Disposition rows so each closer workspace link has a matching
// qualification + already-accepted transfer. Keep in sync with CLOSER_DESK_SEEDS.
;(() => {
  const now = new Date().toISOString()
  for (const seed of CLOSER_DESK_SEEDS) {
    seedCloserQualification(seed.interaction_id, seed.snapshot, {
      consent_given: seed.consent_given,
      dnc_flagged: seed.dnc_flagged,
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

  // Pending/accepted closer queue rows — GET + accept must resolve these transfer ids.
  for (const entry of MOCK_CLOSER_QUEUE) {
    MOCK_TRANSFERS.set(entry.id, {
      id: entry.id,
      interaction_id: entry.interaction_id,
      status: entry.status,
      fronter_user_id: entry.fronter_user_id,
      closer_user_id: entry.status === 'accepted' ? '2' : null,
      created_at: entry.queued_at,
      updated_at: entry.queued_at,
    })
    seedCloserQualification(
      entry.interaction_id,
      {
        vehicle: '2018 Nissan Altima',
        mileage: '71000',
        state: 'CA',
        warranty_status: 'Expired',
        notes: 'Queued transfer — fronter qualification snapshot',
      },
      { consent_given: true, dnc_flagged: false }
    )
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
  { id: 'disp-closer-sale', label: 'Sale', stage: 'closer' },
  { id: 'disp-closer-callback', label: 'Callback Scheduled', stage: 'closer' },
  { id: 'disp-closer-not-interested', label: 'Not Qualified', stage: 'closer' },
  { id: 'disp-closer-dnc', label: 'Do Not Call', stage: 'closer' },
  { id: 'disp-fronter-qualified', label: 'Qualified - Transferred', stage: 'fronter' },
  { id: 'disp-fronter-not-interested', label: 'Not interested', stage: 'fronter' },
  { id: 'disp-fronter-callback', label: 'Callback requested', stage: 'fronter' },
  { id: 'disp-fronter-dnc', label: 'Do not call', stage: 'fronter' },
  { id: 'disp-fronter-invalid', label: 'Invalid / wrong number', stage: 'fronter' },
]

const MOCK_INTERACTION_DISPOSITIONS = new Map<string, MockInteractionDisposition[]>()
let interactionDispositionSeq = 0

/** FE-08 My Stats — `/me/stats/today` seed, keyed by actor user id. */
type MyStatsDispositionSeed = {
  id: string
  interaction_id: string
  created_at: string
  label: string
  stage: 'fronter' | 'closer'
  actor_user_id: string
  lead_name: string
  lead_phone: string
}

const MY_STATS_LABELS = [
  'Qualified - Transferred',
  'Not Interested',
  'Callback Requested',
  'Do Not Call',
  'Wrong Number',
] as const

const CLOSER_STATS_LABELS = [
  'Sale',
  'Callback Scheduled',
  'Not Qualified',
  'Do Not Call',
] as const

/** Labels that match BE catalogue `counts_as_sale` for mock summary cards. */
const SALE_LABELS = new Set<string>(['Sale'])

const MY_STATS_LEADS = [
  'Mubeen N.',
  'Ayesha K.',
  'Omar R.',
  'Sara L.',
  'Daniel P.',
  'Nina V.',
  'Chris T.',
  'Elena M.',
  'Hassan J.',
  'Priya S.',
] as const

type MyStatsTodaySeed = {
  dispositions: MyStatsDispositionSeed[]
  transferred_interaction_ids: string[]
  sales: number
  calls_transferred: number
  calls_today: number
}

function seedMyStatsForUser(
  actorUserId: string,
  rowCount: number,
  leadOffset: number,
  stage: 'fronter' | 'closer' = 'fronter'
): MyStatsTodaySeed {
  const base = new Date()
  base.setHours(9, 0, 0, 0)
  const labels = stage === 'closer' ? CLOSER_STATS_LABELS : MY_STATS_LABELS

  const dispositions: MyStatsDispositionSeed[] = Array.from({ length: rowCount }, (_, index) => {
    const created = new Date(base.getTime() + index * 11 * 60_000)
    return {
      id: `idisp-${actorUserId}-${index + 1}`,
      interaction_id: `int-stats-${actorUserId}-${3000 + index}`,
      created_at: created.toISOString(),
      label: labels[index % labels.length],
      stage,
      actor_user_id: actorUserId,
      lead_name: MY_STATS_LEADS[(index + leadOffset) % MY_STATS_LEADS.length],
      lead_phone: `+9212345${actorUserId}${String(index).padStart(3, '0')}`,
    }
  })

  // Fronter: half of qualified calls transferred. Closer: every disposition was answered.
  const transferred_interaction_ids =
    stage === 'closer'
      ? dispositions.map((row) => row.interaction_id)
      : dispositions
          .filter((row) => row.label === 'Qualified - Transferred')
          .filter((_, i) => i % 2 === 0)
          .map((row) => row.interaction_id)

  const sales = dispositions.filter((row) => SALE_LABELS.has(row.label)).length
  const calls_transferred = transferred_interaction_ids.length
  // Closer calls_today includes accepted-but-not-dispositioned (+1 stand-in).
  const calls_today = stage === 'closer' ? dispositions.length + 1 : dispositions.length

  return {
    dispositions,
    transferred_interaction_ids,
    sales,
    calls_transferred,
    calls_today,
  }
}

const MOCK_MY_STATS_TODAY: Record<string, MyStatsTodaySeed> = {
  '1': seedMyStatsForUser('1', 50, 0, 'fronter'),
  '4': seedMyStatsForUser('4', 5, 3, 'fronter'),
  // Carl Closer — Active Call Today's Disposition + My Stats.
  '2': seedMyStatsForUser('2', 3, 1, 'closer'),
}

// Reconciliation exceptions, and the four detail panels behind them. Both
// reasons, resolved and unresolved rows, and one interaction with no legs and
// no events so that state — the expected one in production — is reachable here.
const HOURS_AGO = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString()

const MOCK_EXCEPTIONS: ReconciliationException[] = [
  {
    id: 'exc-1',
    interaction_id: 'int-exc-1',
    reason: 'multi_leg_without_transfer',
    details: { leg_count: 3 },
    detected_at: HOURS_AGO(2),
    resolved_at: null,
    resolved_by: null,
    resolution_note: null,
  },
  {
    id: 'exc-2',
    interaction_id: 'int-exc-2',
    reason: 'late_event_after_finalization',
    details: {
      finalized_at: HOURS_AGO(6),
      window_seconds: 300,
      late_event_ids: ['evt-exc-2-late-1', 'evt-exc-2-late-2'],
    },
    detected_at: HOURS_AGO(5),
    resolved_at: null,
    resolved_by: null,
    resolution_note: null,
  },
  {
    id: 'exc-3',
    interaction_id: 'int-exc-3',
    reason: 'multi_leg_without_transfer',
    details: { leg_count: 2 },
    detected_at: HOURS_AGO(30),
    resolved_at: HOURS_AGO(26),
    resolved_by: '3',
    resolution_note: 'Second leg was a callback the agent placed by hand. Nothing to transfer.',
  },
  {
    id: 'exc-4',
    interaction_id: 'int-exc-4',
    reason: 'late_event_after_finalization',
    details: { finalized_at: HOURS_AGO(20), window_seconds: 300, late_event_ids: [] },
    detected_at: HOURS_AGO(19),
    resolved_at: null,
    resolved_by: null,
    resolution_note: null,
  },
  // Enough further rows that the queue pages, and that resolving the last row
  // on a page has somewhere to step back to.
  ...Array.from({ length: 12 }, (_, index): ReconciliationException => ({
    id: `exc-${index + 5}`,
    interaction_id: `int-exc-bulk-${index + 1}`,
    reason: index % 3 === 0 ? 'late_event_after_finalization' : 'multi_leg_without_transfer',
    details:
      index % 3 === 0
        ? {
            finalized_at: HOURS_AGO(40 + index),
            window_seconds: 300,
            late_event_ids: [`evt-bulk-${index + 1}`],
          }
        : { leg_count: 2 + (index % 3) },
    detected_at: HOURS_AGO(38 + index),
    resolved_at: null,
    resolved_by: null,
    resolution_note: null,
  })),
]

// Registered into the same tables the workspace routes already read, so an
// exception's interaction is a known one rather than a synthesized shell.
//
// The lead goes in too: `lead_id` is a foreign key on the real API, and
// `listInteractions` expands every row through `GET /leads/{id}` under one
// Promise.all — an interaction pointing at a lead that does not exist would
// reject the whole list rather than just its own row.
for (const [index, exception] of MOCK_EXCEPTIONS.entries()) {
  const leadId = `lead-${exception.interaction_id}`
  MOCK_LEADS[leadId] = {
    id: leadId,
    phone_normalized: `+1323555${String(4000 + index).slice(-4)}`,
    source: index % 2 === 0 ? 'vicidial' : 'ghl',
    created_at: HOURS_AGO(72),
    updated_at: HOURS_AGO(2),
  }
  MOCK_INTERACTIONS[exception.interaction_id] = {
    id: exception.interaction_id,
    lead_id: leadId,
    created_at: HOURS_AGO(48),
    updated_at: HOURS_AGO(2),
    qualification: null,
  }
}

function mockLeg(interactionId: string, index: number, minutesAgo: number): CallLeg {
  const started = new Date(Date.now() - minutesAgo * 60_000)
  return {
    id: `leg-${interactionId}-${index}`,
    vicidial_call_id: `VD-${interactionId.slice(-4)}-${index}`,
    started_at: started.toISOString(),
    ended_at: new Date(started.getTime() + 3 * 60_000 + index * 40_000).toISOString(),
    created_at: started.toISOString(),
  }
}

// int-exc-4 is absent on purpose: an interaction with no legs at all.
const MOCK_CALL_LEGS: Record<string, CallLeg[]> = {
  'int-exc-1': [
    mockLeg('int-exc-1', 1, 130),
    mockLeg('int-exc-1', 2, 124),
    // A leg the dialer never timed — the column reads "Not recorded", not a date.
    { ...mockLeg('int-exc-1', 3, 118), started_at: null, ended_at: null },
  ],
  'int-exc-2': [mockLeg('int-exc-2', 1, 380)],
  'int-exc-3': [mockLeg('int-exc-3', 1, 1800), mockLeg('int-exc-3', 2, 1794)],
}

const MOCK_INTERACTION_TRANSFERS: Record<string, InteractionTransfer[]> = {
  'int-exc-2': [
    {
      id: 'tr-exc-2-1',
      status: 'rejected',
      fronter_user_id: '1',
      fronter_name: 'Fiona Fronter',
      closer_user_id: '5',
      closer_name: 'Nadia Former',
      created_at: HOURS_AGO(6.4),
      updated_at: HOURS_AGO(6.3),
    },
    {
      id: 'tr-exc-2-2',
      status: 'accepted',
      fronter_user_id: '1',
      fronter_name: 'Fiona Fronter',
      closer_user_id: '2',
      closer_name: 'Carl Closer',
      created_at: HOURS_AGO(6.2),
      updated_at: HOURS_AGO(6.1),
    },
  ],
  'int-exc-4': [
    // Never reached a closer, so there is no name to resolve and none invented.
    {
      id: 'tr-exc-4-1',
      status: 'timeout',
      fronter_user_id: '1',
      fronter_name: 'Fiona Fronter',
      closer_user_id: null,
      closer_name: null,
      created_at: HOURS_AGO(20.5),
      updated_at: HOURS_AGO(20.4),
    },
  ],
}

function mockEvent(id: string, minutesAgo: number, payload: Record<string, unknown>): InteractionEvent {
  return {
    id,
    source: 'vicidial',
    event_id: `vd-${id}`,
    payload,
    received_at: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
    processed_at: new Date(Date.now() - (minutesAgo - 1) * 60_000).toISOString(),
    skipped_reason: null,
    error: null,
  }
}

const MOCK_RAW_EVENTS: Record<string, InteractionEvent[]> = {
  'int-exc-1': [
    mockEvent('evt-exc-1-1', 131, { event: 'call_start', call_id: 'VD-xc-1-1', phone: '+13235550142' }),
    { ...mockEvent('evt-exc-1-2', 125, { event: 'hangup', call_id: 'VD-xc-1-1' }), skipped_reason: 'duplicate event_id', processed_at: null },
  ],
  'int-exc-2': [
    mockEvent('evt-exc-2-late-1', 340, { event: 'call_end', call_id: 'VD-xc-2-1', duration: 214 }),
    { ...mockEvent('evt-exc-2-late-2', 336, { event: 'agent_wrapup', call_id: 'VD-xc-2-1' }), error: 'lead lookup failed: no match for +14085550199', processed_at: null },
  ],
}

// Snapshots for the Qualification panel, into the same map `/qualification/:id`
// already serves. int-exc-4 gets none, so "never saved" is reachable too.
;(() => {
  const seeds = [
    { id: 'int-exc-1', vehicle: '2016 Honda Accord', mileage: '92,400', state: 'TX', warranty_status: 'Expired', notes: 'Wants coverage before a long drive; call back after 5pm.', dnc: false },
    { id: 'int-exc-2', vehicle: '2019 Ford F-150', mileage: '61,880', state: 'OH', warranty_status: 'Expiring soon', notes: 'Asked for the powertrain tier in writing.', dnc: false },
    { id: 'int-exc-3', vehicle: '2013 Toyota Camry', mileage: '148,010', state: 'FL', warranty_status: 'Expired', notes: 'Flagged Do Not Call mid-conversation.', dnc: true },
  ]

  for (const seed of seeds) {
    const captured = HOURS_AGO(7)
    MOCK_QUALIFICATIONS.set(seed.id, {
      id: `qual-${seed.id}`,
      interaction_id: seed.id,
      version: 2,
      snapshot_json: {
        checklist: {
          identityVerified: true,
          vehicleDetailsConfirmed: true,
          warrantyNeedConfirmed: true,
          budgetDiscussed: !seed.dnc,
          decisionMakerConfirmed: true,
        },
        disposition: 'qualified',
        notes: seed.notes,
        override: { applied: false, reason: '' },
        vehicle: seed.vehicle,
        mileage: seed.mileage,
        state: seed.state,
        warranty_status: seed.warranty_status,
      } as QualificationResponse['snapshot_json'],
      consent_dnc: {
        consent_given: !seed.dnc,
        consent_captured_at: seed.dnc ? null : captured,
        dnc_flagged: seed.dnc,
        dnc_source: seed.dnc ? 'agent' : null,
      },
      created_at: captured,
      updated_at: captured,
    })
  }
})()

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
    // One message for a wrong password, an unknown address and a deactivated
    // account alike — anything more specific enumerates accounts.
    const user = MOCK_USERS.find(
      (u) =>
        u.email === normalizeEmail(email) &&
        u.password !== null &&
        u.password === password &&
        u.active
    )

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

    // Deactivation takes hold on the next request, as it does against the real
    // API: the account is read again rather than trusted from the token.
    if (!user || !user.active) {
      return res(
        ctx.status(401),
        ctx.json(authErrorBody('Could not validate credentials', 'auth.not_authenticated'))
      )
    }

    return res(ctx.status(200), ctx.json(userBody(user)))
  }),

  rest.post('/auth/invitations/lookup', async (req, res, ctx) => {
    const { token } = (await req.json()) as { token?: string }
    const opened = openLink(String(token), 'invite')
    if ('refused' in opened) return res(ctx.status(opened.refused.status), ctx.json(opened.refused.body))

    const user = MOCK_USERS.find((u) => u.id === opened.link.userId)!
    return res(ctx.status(200), ctx.json({ email: user.email, name: user.name }))
  }),

  rest.post('/auth/invitations/accept', async (req, res, ctx) => {
    const { token, password } = (await req.json()) as { token?: string; password?: string }
    const opened = openLink(String(token), 'invite')
    if ('refused' in opened) return res(ctx.status(opened.refused.status), ctx.json(opened.refused.body))

    const tooLong = passwordRefusal(String(password), 'password')
    if (tooLong) return res(ctx.status(tooLong.status), ctx.json(tooLong.body))

    const user = MOCK_USERS.find((u) => u.id === opened.link.userId)!
    user.password = String(password)
    opened.link.state = 'used'
    return res(ctx.status(200), ctx.json(issueMockTokens(user)))
  }),

  rest.post('/auth/password/forgot', async (req, res, ctx) => {
    const { email } = (await req.json()) as { email?: string }
    const user = MOCK_USERS.find((u) => u.email === normalizeEmail(email) && u.active)
    // Issued only for a real, active account — but the answer never says so.
    if (user) issueMockLink(user.id, 'reset')
    return res(ctx.status(202))
  }),

  rest.post('/auth/password/reset', async (req, res, ctx) => {
    const { token, new_password } = (await req.json()) as {
      token?: string
      new_password?: string
    }
    const opened = openLink(String(token), 'reset')
    if ('refused' in opened) return res(ctx.status(opened.refused.status), ctx.json(opened.refused.body))

    const tooLong = passwordRefusal(String(new_password), 'new_password')
    if (tooLong) return res(ctx.status(tooLong.status), ctx.json(tooLong.body))

    const user = MOCK_USERS.find((u) => u.id === opened.link.userId)!
    user.password = String(new_password)
    opened.link.state = 'used'
    return res(ctx.status(200), ctx.json(issueMockTokens(user)))
  }),

  rest.get('/auth/users', (req, res, ctx) => {
    const refused = adminRefusal(req.headers.get('authorization'))
    if (refused) return res(ctx.status(refused.status), ctx.json(refused.body))

    const params = req.url.searchParams
    const limit = Number(params.get('limit') ?? 50)
    const offset = Number(params.get('offset') ?? 0)
    const active = params.get('active')
    const role = params.get('role')
    const search = (params.get('search') ?? '').toLowerCase()

    const matching = MOCK_USERS.filter((user) => {
      if (active !== null && user.active !== (active === 'true')) return false
      if (role && !user.roles.includes(role as Role)) return false
      if (search && !`${user.name} ${user.email}`.toLowerCase().includes(search)) return false
      return true
    })

    return res(
      ctx.status(200),
      ctx.json({
        // The total counts the filters but not the paging, so a caller can tell
        // how many pages there are.
        items: matching.slice(offset, offset + limit).map(userBody),
        total: matching.length,
        limit,
        offset,
      })
    )
  }),

  rest.post('/auth/users', async (req, res, ctx) => {
    const refused = adminRefusal(req.headers.get('authorization'))
    if (refused) return res(ctx.status(refused.status), ctx.json(refused.body))

    const body = (await req.json()) as {
      email?: string
      name?: string
      password?: string
      roles?: Role[]
    }

    const invalid = describeUser(body)
    if (invalid) return res(ctx.status(invalid.status), ctx.json(invalid.body))

    const email = normalizeEmail(body.email)
    if (MOCK_USERS.some((user) => user.email === email)) {
      return res(
        ctx.status(409),
        ctx.json(
          authErrorBody(`user already exists: ${email}`, 'user.already_exists', [
            { field: 'email', in: 'body', message: 'already in use' },
          ])
        )
      )
    }

    const created: MockUser = {
      id: String(++userSeq),
      email,
      // null until they follow their invitation and choose one.
      password: body.password ? String(body.password) : null,
      name: String(body.name),
      roles: body.roles as Role[],
      active: true,
      created_at: new Date().toISOString(),
    }
    MOCK_USERS.push(created)
    if (!body.password) issueMockLink(created.id, 'invite')
    return res(ctx.status(201), ctx.json(userBody(created)))
  }),

  rest.patch('/auth/users/:userId', async (req, res, ctx) => {
    const authorization = req.headers.get('authorization')
    const refused = adminRefusal(authorization)
    if (refused) return res(ctx.status(refused.status), ctx.json(refused.body))

    const actor = MOCK_TOKENS.get((authorization || '').replace(/^Bearer\s+/i, ''))
    const user = MOCK_USERS.find((u) => u.id === req.params.userId)
    if (!user) {
      return res(ctx.status(404), ctx.json(authErrorBody('user not found', 'user.not_found')))
    }

    const body = (await req.json()) as { name?: string; roles?: Role[]; active?: boolean }

    if (body.roles) {
      const unknown = body.roles.filter((role) => !KNOWN_ROLES.includes(role))
      if (unknown.length > 0 || body.roles.length === 0) {
        return res(
          ctx.status(422),
          ctx.json(
            authErrorBody(`unknown roles: ${unknown.join(', ')}`, 'user.unknown_roles', [
              { field: 'roles', in: 'body', message: 'unknown role' },
            ])
          )
        )
      }
    }

    // The API refuses to let an administrator lock themselves out.
    const losingOwnAdmin = body.roles && !body.roles.includes('administrator')
    if (actor?.id === user.id && (body.active === false || losingOwnAdmin)) {
      return res(
        ctx.status(400),
        ctx.json(
          authErrorBody(
            'cannot deactivate yourself or drop your own administrator role',
            'user.cannot_demote_self'
          )
        )
      )
    }

    if (body.name !== undefined) user.name = body.name
    if (body.roles !== undefined) user.roles = body.roles
    if (body.active !== undefined) user.active = body.active

    return res(ctx.status(200), ctx.json(userBody(user)))
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

  rest.get('/interactions', (_req, res, ctx) => {
    return res(ctx.status(200), ctx.json(Object.values(MOCK_INTERACTIONS)))
  }),

  rest.get('/leads/:leadId', (req, res, ctx) => {
    const lead =
      MOCK_LEADS[req.params.leadId as string] ??
      Object.values(MOCK_LEADS).find((row) => row.id === req.params.leadId)
    if (!lead) {
      return res(
        ctx.status(404),
        ctx.json({ detail: 'Lead not found.', code: 'lead.not_found' })
      )
    }
    return res(ctx.status(200), ctx.json(lead))
  }),

  rest.get('/queue', (req, res, ctx) => {
    const role = req.url.searchParams.get('role')
    if (role === 'fronter') {
      return res(ctx.status(200), ctx.json(MOCK_FRONTER_QUEUE))
    }
    if (role === 'closer') {
      return res(ctx.status(200), ctx.json(MOCK_CLOSER_QUEUE))
    }
    return res(
      ctx.status(422),
      ctx.json({
        detail: 'role query param is required',
        code: 'validation_error',
        fields: [{ field: 'role', message: 'Input should be fronter or closer' }],
      })
    )
  }),

  // Agent-scoped My Stats — fronter or closer via ?stage=.
  rest.get('/me/stats/today', (req, res, ctx) => {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace(/^Bearer\s+/i, '')
    const user = MOCK_TOKENS.get(token)
    if (!user) {
      return res(
        ctx.status(401),
        ctx.json(authErrorBody('Could not validate credentials', 'auth.not_authenticated'))
      )
    }

    const roles = new Set(user.roles)
    const stageParam = req.url.searchParams.get('stage')
    let stage: 'fronter' | 'closer' | null =
      stageParam === 'fronter' || stageParam === 'closer' ? stageParam : null

    if (stage && !roles.has(stage)) {
      return res(
        ctx.status(403),
        ctx.json(authErrorBody('Insufficient role for this operation', 'auth.forbidden'))
      )
    }
    if (!stage) {
      const held = [...roles].filter((r): r is 'fronter' | 'closer' => r === 'fronter' || r === 'closer')
      if (held.length === 2) {
        return res(
          ctx.status(422),
          ctx.json({
            detail: 'stage is required when the caller holds both fronter and closer',
            code: 'validation.stage_required',
          })
        )
      }
      stage = held[0] === 'closer' ? 'closer' : 'fronter'
    }

    const empty: MyStatsTodaySeed = {
      dispositions: [],
      transferred_interaction_ids: [],
      sales: 0,
      calls_transferred: 0,
      calls_today: 0,
    }
    const payload = MOCK_MY_STATS_TODAY[user.id] ?? empty

    // Never leak another user's rows — seed is already keyed by actor, filter again.
    const dispositions = payload.dispositions.filter(
      (row) => row.actor_user_id === user.id && row.stage === stage
    )
    const transferred_interaction_ids = payload.transferred_interaction_ids.filter((id) =>
      stage === 'closer'
        ? true
        : dispositions.some((row) => row.interaction_id === id)
    )
    const sales = dispositions.filter((row) => SALE_LABELS.has(row.label)).length
    const calls_transferred = transferred_interaction_ids.length
    // Prefer the seeded calls_today so closer's accepted-without-disposition is visible.
    const calls_today =
      stage === payload.dispositions[0]?.stage
        ? payload.calls_today
        : stage === 'closer'
          ? calls_transferred
          : dispositions.length

    return res(
      ctx.status(200),
      ctx.json({
        dispositions,
        transferred_interaction_ids,
        sales,
        calls_transferred,
        calls_today,
      })
    )
  }),

  rest.get('/interactions/:interactionId', (req, res, ctx) => {
    const interaction = interactionDetail(req.params.interactionId as string)
    if (!interaction) {
      return res(
        ctx.status(404),
        ctx.json({ detail: 'Interaction not found.', code: 'interaction.not_found' })
      )
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
      snapshot_json: body.snapshot_json as QualificationResponse['snapshot_json'],
      consent_dnc: body.consent_dnc,
      created_at: existing?.created_at ?? now,
      updated_at: now,
    }
    MOCK_QUALIFICATIONS.set(body.interaction_id, record)

    return res(ctx.status(201), ctx.json(record))
  }),

  rest.get('/transfers/closers', (_req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        items: [
          {
            user_id: '5a1f0c3e-0001-4000-8000-000000000001',
            name: 'Carl Closer',
            status: 'available',
          },
          {
            user_id: '5a1f0c3e-0003-4000-8000-000000000003',
            name: 'Eli Brooks',
            status: 'on_call',
          },
        ],
      })
    )
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

  // Closer workspace accepts pending offers on open (queue → Active Call).
  rest.post('/transfers/:transferId/accept', async (req, res, ctx) => {
    const transferId = req.params.transferId as string
    const body = (await req.json()) as { closer_user_id: string }
    const existing = MOCK_TRANSFERS.get(transferId)
    if (!existing) {
      return res(
        ctx.status(404),
        ctx.json({ detail: 'transfer not found', code: 'transfer.not_found' })
      )
    }
    if (existing.status !== 'initiated' && existing.status !== 'offered') {
      return res(
        ctx.status(409),
        ctx.json({
          detail: `this transfer is already ${existing.status}`,
          code: 'transfer.not_answerable',
        })
      )
    }

    const now = new Date().toISOString()
    const transfer: TransferResponse = {
      ...existing,
      status: 'accepted',
      closer_user_id: body.closer_user_id,
      updated_at: now,
    }
    MOCK_TRANSFERS.set(transferId, transfer)

    // Accepted stays on the closer queue as "On Call" until dispositioned.
    const queueIdx = MOCK_CLOSER_QUEUE.findIndex((row) => row.id === transferId)
    if (queueIdx >= 0) {
      MOCK_CLOSER_QUEUE[queueIdx] = {
        ...MOCK_CLOSER_QUEUE[queueIdx],
        status: 'accepted',
      }
    }

    return res(ctx.status(200), ctx.json(transfer))
  }),

  rest.post('/transfers/:transferId/reject', async (req, res, ctx) => {
    const transferId = req.params.transferId as string
    const body = (await req.json()) as { closer_user_id: string }
    const existing = MOCK_TRANSFERS.get(transferId)
    if (!existing) {
      return res(
        ctx.status(404),
        ctx.json({ detail: 'transfer not found', code: 'transfer.not_found' })
      )
    }
    if (existing.status !== 'initiated' && existing.status !== 'offered') {
      return res(
        ctx.status(409),
        ctx.json({
          detail: `this transfer is already ${existing.status}`,
          code: 'transfer.not_answerable',
        })
      )
    }

    const now = new Date().toISOString()
    const transfer: TransferResponse = {
      ...existing,
      status: 'rejected',
      closer_user_id: body.closer_user_id,
      updated_at: now,
    }
    MOCK_TRANSFERS.set(transferId, transfer)

    const queueIdx = MOCK_CLOSER_QUEUE.findIndex((row) => row.id === transferId)
    if (queueIdx >= 0) MOCK_CLOSER_QUEUE.splice(queueIdx, 1)

    return res(ctx.status(200), ctx.json(transfer))
  }),

  rest.get('/transfers/:transferId', (req, res, ctx) => {
    const transfer = MOCK_TRANSFERS.get(req.params.transferId as string)
    if (!transfer) {
      return res(
        ctx.status(404),
        ctx.json({ detail: 'transfer not found', code: 'transfer.not_found' })
      )
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

  rest.get('/reconciliation/exceptions', (req, res, ctx) => {
    const refused = adminRefusal(req.headers.get('authorization'))
    if (refused) return res(ctx.status(refused.status), ctx.json(refused.body))

    const params = req.url.searchParams
    const limit = Number(params.get('limit') ?? 100)
    const offset = Number(params.get('offset') ?? 0)
    const resolution = params.get('resolution') ?? 'open'
    const reason = params.get('reason')

    const matching = MOCK_EXCEPTIONS.filter((row) => {
      if (resolution === 'open' && row.resolved_at) return false
      if (resolution === 'resolved' && !row.resolved_at) return false
      if (reason && row.reason !== reason) return false
      return true
    }).sort((a, b) => b.detected_at.localeCompare(a.detected_at) || a.id.localeCompare(b.id))

    return res(
      ctx.status(200),
      ctx.json({
        items: matching.slice(offset, offset + limit),
        total: matching.length,
        limit,
        offset,
      })
    )
  }),

  rest.patch('/reconciliation/exceptions/:exceptionId', async (req, res, ctx) => {
    const refused = adminRefusal(req.headers.get('authorization'))
    if (refused) return res(ctx.status(refused.status), ctx.json(refused.body))

    const row = MOCK_EXCEPTIONS.find((item) => item.id === req.params.exceptionId)
    if (!row) {
      return res(
        ctx.status(404),
        ctx.json(authErrorBody('no such exception', 'exception.not_found'))
      )
    }

    const actor = MOCK_TOKENS.get((req.headers.get('authorization') || '').replace(/^Bearer\s+/i, ''))
    const body = (await req.json()) as { resolved: boolean; note?: string | null }

    if (body.resolved) {
      row.resolved_at = new Date().toISOString()
      row.resolved_by = actor?.id ?? null
      row.resolution_note = body.note ?? null
    } else {
      // Reopening clears the note with the timestamp, as the API does.
      row.resolved_at = null
      row.resolved_by = null
      row.resolution_note = null
    }

    return res(ctx.status(200), ctx.json(row))
  }),

  rest.get('/interactions/:interactionId/call-legs', (req, res, ctx) => {
    const refused = adminRefusal(req.headers.get('authorization'))
    if (refused) return res(ctx.status(refused.status), ctx.json(refused.body))

    const interactionId = req.params.interactionId as string
    // The same answer `/interactions/:id` gives, so a panel never contradicts
    // the screen it sits on.
    if (!interactionDetail(interactionId)) {
      return res(ctx.status(404), ctx.json(authErrorBody('no such interaction', 'interaction.not_found')))
    }
    return res(ctx.status(200), ctx.json({ items: MOCK_CALL_LEGS[interactionId] ?? [] }))
  }),

  rest.get('/interactions/:interactionId/transfers', (req, res, ctx) => {
    const refused = adminRefusal(req.headers.get('authorization'))
    if (refused) return res(ctx.status(refused.status), ctx.json(refused.body))

    const interactionId = req.params.interactionId as string
    if (!interactionDetail(interactionId)) {
      return res(ctx.status(404), ctx.json(authErrorBody('no such interaction', 'interaction.not_found')))
    }
    return res(ctx.status(200), ctx.json({ items: MOCK_INTERACTION_TRANSFERS[interactionId] ?? [] }))
  }),

  rest.get('/interactions/:interactionId/events', (req, res, ctx) => {
    const refused = adminRefusal(req.headers.get('authorization'))
    if (refused) return res(ctx.status(refused.status), ctx.json(refused.body))

    const interactionId = req.params.interactionId as string
    if (!interactionDetail(interactionId)) {
      return res(ctx.status(404), ctx.json(authErrorBody('no such interaction', 'interaction.not_found')))
    }

    const limit = Number(req.url.searchParams.get('limit') ?? 50)
    const offset = Number(req.url.searchParams.get('offset') ?? 0)
    const all = MOCK_RAW_EVENTS[interactionId] ?? []

    return res(
      ctx.status(200),
      ctx.json({ items: all.slice(offset, offset + limit), total: all.length, limit, offset })
    )
  }),
]
