import { rest } from 'msw'
import type { FieldError } from '../lib/apiError'
import { roleSatisfies, type Role } from '../lib/auth'
import type { CallbackRequestItem, FronterDetails } from '../lib/callbacks'
import { CLOSER_DESK_SEEDS } from '../lib/closer'
import type { ReconciliationException } from '../lib/exceptions'
import type { CallLeg, InteractionEvent, InteractionTransfer } from '../lib/interactionDetail'
import type { InteractionDetailResponse } from '../lib/interactions'
import type { LeadBulkRow, LeadHistory, LeadHistoryEvent, LeadResponse } from '../lib/leads'
import type { PaidUpload, PolicyLookup } from '../lib/policies'
import type {
  RetentionSale,
  RetentionSaleDetail,
  RetentionStatusEvent,
  RetentionUploadCheck,
} from '../lib/retention'
import type { QaAgent, QaHistoryEvent, QaItem, QaStatus, QaTeamSummary } from '../lib/qa'
import { PUSH_INTERVAL_MS, type AgentStatus, type LiveStatus } from '../lib/liveStatus'
import type { CloserCallbackEntry, CloserQueueEntry, FronterQueueEntry } from '../lib/queue'
import {
  checkCart,
  digitsOf,
  visibleTail,
  type CartResponse,
  type CartSaveRequest,
} from '../lib/cart'
import type {
  QualificationCreateRequest,
  QualificationCustomer,
  QualificationResponse,
} from '../lib/qualification'
import type {
  AgentLeadItem,
  AgentPeriod,
  AgentSaleItem,
  AgentSaleKind,
  AgentStats,
  AgentTargets,
} from '../lib/agentStats'
import { BUSINESS_TIMEZONE, TIME_ZONES, type TimeZoneName } from '../lib/format'
import type {
  FunnelLeadList,
  FunnelStage,
  HistoricalFunnel,
  SaleItem,
  SalesReport,
  TeamFigures,
  TeamStats,
  TeamStatsReport,
} from '../lib/reporting'
import { businessDay } from '../lib/reporting'
import type {
  AvailableCloserItem,
  TransferCreateRequest,
  TransferResponse,
} from '../lib/transfers'

type MockUser = {
  id: string
  email: string
  password: string | null
  name: string
  roles: Role[]
  active: boolean
  created_at: string
  /** Super Admin has no team pin; everyone else belongs to the mock team. */
  team_id: string | null
  /** The zone their times are drawn in; Eastern until they choose another. */
  timezone?: TimeZoneName
}

const SEEDED_AT = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString()

/** Seeded teams so Super Admin can group the Users tab by team_id. */
const MOCK_TEAM_EAST = '11111111-1111-1111-1111-111111111111'
const MOCK_TEAM_WEST = '22222222-2222-2222-2222-222222222222'
const MOCK_TEAM_DEFAULT = '00000000-0000-0000-0000-000000000001'
/** Default pin for newly created non–Super Admin accounts. */
const MOCK_TEAM_ID = MOCK_TEAM_EAST

/** Locked name — rename / deactivate refused with `team.default_locked`. */
const DEFAULT_TEAM_NAME = 'Default Team'

type MockTeam = {
  id: string
  name: string
  active: boolean
  created_at: string
  updated_at: string
}

const MOCK_TEAMS: MockTeam[] = [
  {
    id: MOCK_TEAM_DEFAULT,
    name: DEFAULT_TEAM_NAME,
    active: true,
    created_at: SEEDED_AT,
    updated_at: SEEDED_AT,
  },
  {
    id: MOCK_TEAM_EAST,
    name: 'East Coast',
    active: true,
    created_at: SEEDED_AT,
    updated_at: SEEDED_AT,
  },
  {
    id: MOCK_TEAM_WEST,
    name: 'West Coast',
    active: true,
    created_at: SEEDED_AT,
    updated_at: SEEDED_AT,
  },
]

type MockCampaign = {
  id: string
  name: string
  match_type: 'campaign' | 'list' | 'did' | null
  match_value: string | null
  team_ids: string[]
  active: boolean
  created_at: string
  updated_at: string
}

function seededCampaign(id: string, name: string, teamIds: string[], active = true): MockCampaign {
  return {
    id,
    name,
    match_type: null,
    match_value: null,
    team_ids: teamIds,
    active,
    created_at: SEEDED_AT,
    updated_at: SEEDED_AT,
  }
}

/** One campaign per seeded team, one both teams work, and one retired with none. */
const MOCK_CAMPAIGNS: MockCampaign[] = [
  seededCampaign('33333333-3333-4333-8333-000000000001', 'East Inbound', [MOCK_TEAM_EAST]),
  seededCampaign('33333333-3333-4333-8333-000000000002', 'West Inbound', [MOCK_TEAM_WEST]),
  seededCampaign('33333333-3333-4333-8333-000000000003', 'Shared overflow', [
    MOCK_TEAM_EAST,
    MOCK_TEAM_WEST,
  ]),
  seededCampaign('33333333-3333-4333-8333-000000000004', 'Spring promo', [], false),
]

// A counter rather than crypto.randomUUID(), which a plain-http dev server lacks.
let issuedCampaigns = MOCK_CAMPAIGNS.length

function nextCampaignId(): string {
  issuedCampaigns += 1
  return `33333333-3333-4333-8333-${String(issuedCampaigns).padStart(12, '0')}`
}

/** Deduplicated and sorted, the way the API returns a campaign's teams. */
function campaignTeamIds(ids: string[] | null | undefined): string[] {
  return [...new Set(ids ?? [])].sort()
}

function isUnknownTeam(id: string): boolean {
  return !MOCK_TEAMS.some((team) => team.id === id)
}

function campaignNameTaken(name: string) {
  return authErrorBody(`campaign already exists: ${name}`, 'campaign.already_exists', [
    { field: 'name', in: 'body', message: 'already in use' },
  ])
}

// Demo accounts for local/dev use only, until the real /auth endpoints ship (week 2).
// The admin console reads and writes this same list, so a user added there can
// sign in, and one deactivated there stops being able to.
const MOCK_USERS: MockUser[] = [
  { id: '1', email: 'fronter@tgs.com', password: 'password1', name: 'Fiona Fronter', roles: ['fronter'], active: true, created_at: SEEDED_AT, team_id: MOCK_TEAM_EAST },
  // Second fronter — proves /me/stats/today is scoped per logged-in user (FE-08 AC).
  { id: '4', email: 'fronter2@tgs.com', password: 'password1', name: 'Frank Fronter', roles: ['fronter'], active: true, created_at: SEEDED_AT, team_id: MOCK_TEAM_WEST },
  { id: '2', email: 'closer@tgs.com', password: 'password1', name: 'Carl Closer', roles: ['closer'], active: true, created_at: SEEDED_AT, team_id: MOCK_TEAM_WEST },
  { id: '3', email: 'admin@tgs.com', password: 'password1', name: 'Ana Admin', roles: ['administrator'], active: true, created_at: SEEDED_AT, team_id: MOCK_TEAM_EAST },
  // Deactivated, so the list has something to show in that state from the start.
  { id: '5', email: 'former@tgs.com', password: 'password1', name: 'Nadia Former', roles: ['closer'], active: false, created_at: SEEDED_AT, team_id: MOCK_TEAM_EAST },
  // Multi-role, so the sidebar's desk switcher is reachable locally: every other
  // account here holds exactly one role, which is the case that hides it.
  { id: '6', email: 'everything@tgs.com', password: 'password1', name: 'Mo Everything', roles: ['administrator', 'closer', 'fronter'], active: true, created_at: SEEDED_AT, team_id: MOCK_TEAM_EAST },
  // Two desks and no admin — the switcher without a Team Admin entry.
  { id: '7', email: 'both@tgs.com', password: 'password1', name: 'Bea Both', roles: ['fronter', 'closer'], active: true, created_at: SEEDED_AT, team_id: MOCK_TEAM_WEST },
  // Company-wide admin — no team pin; inherits every Team Admin surface.
  { id: '8', email: 'super@tgs.com', password: 'password1', name: 'Sam Super', roles: ['super_admin'], active: true, created_at: SEEDED_AT, team_id: null },
  // QA desk demos, matching the backend seed: QA covers every team, so none has
  // one. Leo was a QA Lead until that role was merged into QA Agent.
  { id: '9', email: 'quinn.qa@tgs.com', password: 'password1', name: 'Quinn QA', roles: ['qa_manager'], active: true, created_at: SEEDED_AT, team_id: null },
  { id: '10', email: 'aria.agent@tgs.com', password: 'password1', name: 'Aria Agent', roles: ['qa_agent'], active: true, created_at: SEEDED_AT, team_id: null },
  { id: '11', email: 'leo.lead@tgs.com', password: 'password1', name: 'Leo Lead', roles: ['qa_agent'], active: true, created_at: SEEDED_AT, team_id: null },
  // Retention covers every team too.
  { id: '12', email: 'rita.retention@tgs.com', password: 'password1', name: 'Rita Retention', roles: ['retention'], active: true, created_at: SEEDED_AT, team_id: null },
]

const KNOWN_ROLES: Role[] = [
  'fronter',
  'closer',
  'administrator',
  'qa_manager',
  'qa_agent',
  'retention',
  'super_admin',
]

/** Dialer agents a Team Admin may manage (besides self). */
const AGENT_ROLES: readonly Role[] = ['fronter', 'closer']
/** QA staff a QA Manager may manage, on no team (besides self). */
const QA_STAFF_ROLES: readonly Role[] = ['qa_agent']
/** Company-wide roles besides Super Admin: no team, and fixed when the account is made. */
const NO_TEAM_ROLES: readonly Role[] = ['qa_manager', 'qa_agent', 'retention']
const NO_TEAM_MESSAGE = 'QA and Retention accounts cover every team, so have no team'

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
    team_id: user.team_id,
    timezone: user.timezone ?? BUSINESS_TIMEZONE,
  }
}

/** The signed-in mock user behind an Authorization header, if any. */
function mockActor(authorization: string | null): MockUser | undefined {
  return MOCK_TOKENS.get((authorization || '').replace(/^Bearer\s+/i, ''))
}

/** Setting a password ends every refresh session the user has, as the API does. */
function endMockSessions(user: MockUser) {
  for (const [token, holder] of MOCK_REFRESH_TOKENS) {
    if (holder.id === user.id) MOCK_REFRESH_TOKENS.delete(token)
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

  const today = {
    leads: 26 + (tick % 20),
    interactions: 30 + (tick % 20),
    qualifications: 12 + (tick % 7),
    transfers_offered: 8 + (tick % 5),
    transfers_accepted: 5 + (tick % 3),
    transfers_rejected: 1 + (tick % 2),
    sales: 2 + (tick % 2),
  }
  // A Karachi day starts hours earlier, so it holds a different set of calls.
  const karachi = { ...today, transfers_offered: today.transfers_offered + 3 }

  return {
    generated_at: new Date().toISOString(),
    timezone: BUSINESS_TIMEZONE,
    agents,
    active_calls: agents.filter((agent) => isBusy(agent.status)).length,
    pending_transfers: tick % 3,
    funnel_today: today,
    funnel_today_by_timezone: [
      { timezone: 'America/New_York', funnel: today },
      { timezone: 'Asia/Karachi', funnel: karachi },
    ],
  }
}

/** Why an admin-only route would turn this request away, or null. */
function adminRefusal(authorization: string | null) {
  const user = MOCK_TOKENS.get((authorization || '').replace(/^Bearer\s+/i, ''))
  if (!user || !user.active) {
    return {
      status: 401,
      body: authErrorBody('Could not validate credentials', 'auth.not_authenticated'),
    }
  }
  // Super Admin inherits every Team Admin surface (same rule as RequireRole).
  // QA Manager is not Team Admin — user-admin routes use userAdminRefusal.
  if (!roleSatisfies(user.roles, 'administrator')) {
    return {
      status: 403,
      body: authErrorBody('Insufficient role for this operation', 'auth.forbidden'),
    }
  }
  return null
}

/**
 * User administration: Team Admin (SA inherits) or QA Manager.
 * Does not open reporting / campaigns / teams chrome to a QA Manager.
 */
function userAdminRefusal(authorization: string | null) {
  const user = MOCK_TOKENS.get((authorization || '').replace(/^Bearer\s+/i, ''))
  if (!user || !user.active) {
    return {
      status: 401,
      body: authErrorBody('Could not validate credentials', 'auth.not_authenticated'),
    }
  }
  if (
    !roleSatisfies(user.roles, 'administrator') &&
    !user.roles.includes('qa_manager')
  ) {
    return {
      status: 403,
      body: authErrorBody('Insufficient role for this operation', 'auth.forbidden'),
    }
  }
  return null
}

/** Why a Super Admin only route would turn this request away, or null. */
function superAdminRefusal(authorization: string | null) {
  const user = MOCK_TOKENS.get((authorization || '').replace(/^Bearer\s+/i, ''))
  if (!user || !user.active) {
    return {
      status: 401,
      body: authErrorBody('Could not validate credentials', 'auth.not_authenticated'),
    }
  }
  if (!user.roles.includes('super_admin')) {
    return {
      status: 403,
      body: authErrorBody('Insufficient role for this operation', 'auth.forbidden'),
    }
  }
  return null
}

/** Whether every role the target holds is one of these. */
function holdsOnly(target: MockUser, roles: readonly Role[]): boolean {
  return target.roles.every((role) => roles.includes(role))
}

/**
 * Whether this row is in the actor's Users list, as the API's grants decide:
 * themselves, a Team Admin's own team's agents, or QA staff on any team for a
 * QA Manager, who has no team.
 */
function isManageableBy(actor: MockUser, target: MockUser): boolean {
  if (actor.id === target.id) return true
  if (actor.roles.includes('super_admin')) return true
  if (
    actor.roles.includes('administrator') &&
    actor.team_id &&
    target.team_id === actor.team_id &&
    holdsOnly(target, AGENT_ROLES)
  ) {
    return true
  }
  return (
    actor.roles.includes('qa_manager') &&
    target.roles.includes('qa_agent') &&
    holdsOnly(target, QA_STAFF_ROLES)
  )
}

/**
 * 403 when the actor tries to grant above their ceiling, or a Team Admin onto
 * another team. A QA Manager grants QA Agents, who have no team.
 */
function grantCeilingRefusal(
  actor: MockUser,
  roles: Role[],
  teamId: string | null,
  target: MockUser | null = null,
) {
  if (actor.roles.includes('super_admin')) return null
  const current = new Set(target?.roles ?? [])
  const granted = roles.filter((role) => !current.has(role))
  const within = (allowed: readonly Role[]) => granted.every((role) => allowed.includes(role))
  if (
    actor.roles.includes('administrator') &&
    within(AGENT_ROLES) &&
    actor.team_id &&
    teamId === actor.team_id
  ) {
    return null
  }
  if (actor.roles.includes('qa_manager') && within(QA_STAFF_ROLES)) return null
  return {
    status: 403,
    body: authErrorBody('cannot grant roles above your ceiling', 'user.grant_forbidden'),
  }
}

function qaManagerHasNoTeam(field: 'team_id' | 'roles', message: string) {
  return authErrorBody(message, 'validation_error', [{ field, in: 'body', message }])
}

/** Default business day when the client leaves `timezone` off, matching the API. */
const MOCK_BUSINESS_TIMEZONE = BUSINESS_TIMEZONE

/**
 * How many leads came in over a window, worked out from the window itself so the
 * same dates always answer the same figures and a different range visibly moves
 * them.
 *
 * `timezone` is echoed so a deliberate region pick shows on the chart and list;
 * a different zone also nudges the count so mock mode can't hide a client that
 * forgot to pass the choice through.
 */
function mockWindow(start: string, end: string, timezone?: string | null) {
  const zone = timezone || MOCK_BUSINESS_TIMEZONE
  const days = Math.max(1, Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000) + 1)
  const zoneBias = zone.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % 11
  const leads = days * 40 + (Number(start.replace(/-/g, '')) % 97) + zoneBias
  return { start, end, timezone: zone, leads }
}

/**
 * The Reports funnel for a window and team, null for every team. Read off Team
 * stats' own total, so the two pages agree in mock mode.
 */
function mockFunnel(
  start: string,
  end: string,
  teamId: string | null,
  timezone?: string | null
): HistoricalFunnel {
  const { total, ...stats } = mockTeamStats(start, end, teamId, timezone)
  return {
    start: stats.start,
    end: stats.end,
    timezone: stats.timezone,
    leads: total.leads,
    qualified: total.qualified,
    transferred: total.transferred,
    sold: total.sold,
    // Inside Sold: the sold leads a monthly upload has marked Paid so far.
    paid: Math.round(total.sold * 0.6),
  }
}

/**
 * Every team's figures for a window, worked out from it the way `mockWindow` is
 * so other dates visibly move them. A team picked on its own keeps the figures it
 * had among the others. No answer, Callback and Qualified never add up past Leads,
 * and Sold sits inside Transferred inside Qualified, as the API's usually do.
 */
function mockTeamStats(
  start: string,
  end: string,
  teamId: string | null,
  timezone?: string | null
): TeamStatsReport {
  const base = mockWindow(start, end, timezone)
  const withRate = (counts: Omit<TeamFigures, 'conversion_rate'>): TeamFigures => ({
    ...counts,
    conversion_rate: counts.sales ? counts.paid / counts.sales : null,
  })
  // Paid counts on the 1st of its month, so dates that hold no 1st have none.
  const holdsAFirst = start.endsWith('-01') || start.slice(0, 7) !== end.slice(0, 7)

  const teams: TeamStats[] = [...MOCK_TEAMS]
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((team, index) => {
      // Inactive mock teams have no figures, so this is the API's listing rule.
      if (teamId ? team.id !== teamId : !team.active) return []
      const leads = team.active ? Math.round(base.leads / (index + 2)) : 0
      const qualified = Math.round(leads * 0.3)
      const transferred = Math.round(qualified * 0.6)
      const sales = Math.round(transferred * 0.55)
      const counts = {
        leads,
        no_answer: Math.round(leads * 0.35),
        callback: Math.round(leads * 0.15),
        qualified,
        transferred,
        sold: Math.round(transferred * 0.5),
        sales,
        // One team's old sales paid now outnumber its new ones, as the API allows.
        paid: holdsAFirst ? Math.round(sales * [1.08, 0.82, 0.64][index % 3]) : 0,
      }
      return [{ team_id: team.id, team_name: team.name, ...withRate(counts) }]
    })

  const sum = (pick: (row: TeamStats) => number) =>
    teams.reduce((total, row) => total + pick(row), 0)
  const total = withRate({
    leads: sum((row) => row.leads),
    no_answer: sum((row) => row.no_answer),
    callback: sum((row) => row.callback),
    qualified: sum((row) => row.qualified),
    transferred: sum((row) => row.transferred),
    sold: sum((row) => row.sold),
    sales: sum((row) => row.sales),
    paid: sum((row) => row.paid),
  })

  return { start: base.start, end: base.end, timezone: base.timezone, teams, total }
}

const MOCK_SALE_LEADS = [
  'Maria Lopez',
  'James Carter',
  'Priya Shah',
  'Tom Becker',
  'Lena Novak',
  'Omar Haddad',
  'Grace Kim',
]

type MockSalesQuery = {
  teamId: string | null
  closerId: string | null
  limit: number
  offset: number
}

/**
 * The sales made in a window, newest first, worked out from its days so the same
 * dates always list the same sales. Two or three a day across the seeded closers,
 * each selling for their own team, so a month fills more than one page. Every
 * ninth day's first sale has no cart.
 */
function mockSales(
  start: string,
  end: string,
  { teamId, closerId, limit, offset }: MockSalesQuery,
  timezone?: string | null
): SalesReport {
  const sellers = MOCK_USERS.flatMap((user) => {
    const team = MOCK_TEAMS.find((row) => row.id === user.team_id)
    return user.roles.includes('closer') && team ? [{ user, team }] : []
  })
  const days = Math.max(1, Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000) + 1)

  const thisMonth = new Date().toISOString().slice(0, 7)
  const monthAfter = (day: string) => {
    const [year, month] = day.split('-').map(Number)
    return new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10)
  }
  const made: SaleItem[] = []
  for (let day = days - 1; day >= 0; day--) {
    const date = new Date(Date.parse(start) + day * 86_400_000).toISOString().slice(0, 10)
    const seed = Number(date.replace(/-/g, ''))
    for (let n = 1 + (seed % 2); n >= 0; n--) {
      // Afternoon UTC, so the sale falls on the same day in Eastern and in Karachi.
      const soldAt = new Date(`${date}T${15 + n}:00:00Z`)
      if (soldAt.getTime() > Date.now()) continue
      const { user, team } = sellers[(seed + n) % sellers.length]
      const id = String(seed * 10 + n).padStart(12, '0')
      const total = 1800 + ((seed + n) % 7) * 300
      const down = total / 10
      const carted = seed % 9 !== 0 || n > 0
      made.push({
        interaction_id: `44444444-4444-4444-8444-${id}`,
        lead_id: `55555555-5555-4555-8555-${id}`,
        lead_name: MOCK_SALE_LEADS[(seed + n) % MOCK_SALE_LEADS.length],
        team_id: team.id,
        team_name: team.name,
        closer_user_id: user.id,
        closer_name: user.name,
        sold_at: soldAt.toISOString(),
        total_payment: carted ? total.toFixed(2) : null,
        down_payment: carted ? down.toFixed(2) : null,
        monthly_payment: carted ? ((total - down) / 24).toFixed(2) : null,
        // Most sales from before this month were paid the month after they were made.
        paid_month:
          carted && date.slice(0, 7) < thisMonth && seed % 4 !== 0 ? monthAfter(date) : null,
        policy_status: null,
      })
    }
  }

  const matching = made.filter(
    (sale) =>
      (!teamId || sale.team_id === teamId) && (!closerId || sale.closer_user_id === closerId)
  )
  // Summed in cents, so the totals match the rows to the penny.
  const sumOf = (pick: (sale: SaleItem) => string | null) =>
    (
      matching.reduce((sum, sale) => sum + Math.round(Number(pick(sale) ?? 0) * 100), 0) / 100
    ).toFixed(2)

  return {
    start,
    end,
    timezone: timezone || MOCK_BUSINESS_TIMEZONE,
    items: matching.slice(offset, offset + limit),
    total: matching.length,
    limit,
    offset,
    totals: {
      count: matching.length,
      total_payment: sumOf((sale) => sale.total_payment),
      down_payment: sumOf((sale) => sale.down_payment),
      monthly_payment: sumOf((sale) => sale.monthly_payment),
    },
  }
}

/** How far the nth newest lead of a funnel got. The newest are the furthest along. */
// Agent stats: each agent's figures worked out from who they are and the period,
// so the same period always answers the same figures and another visibly moves them.
const MOCK_AGENT_TARGETS = new Map<string, AgentTargets>()
const NO_MOCK_TARGETS: AgentTargets = { daily: null, weekly: null, monthly: null }
const MOCK_AGENT_PERIODS: readonly AgentPeriod[] = ['today', 'week', 'month']
const MOCK_TARGET_MAX = 100_000

type MockAgentWindow = { period: AgentPeriod; start: string; end: string; timezone: string }

function mockShiftDay(day: string, by: number): string {
  const date = new Date(`${day}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + by)
  return date.toISOString().slice(0, 10)
}

/** The day, the Monday-to-Sunday week or the calendar month holding `day`, as the API reads it. */
function mockPeriodWindow(period: AgentPeriod, day: string): { start: string; end: string } {
  if (period === 'today') return { start: day, end: day }
  if (period === 'week') {
    const start = mockShiftDay(day, -((new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7))
    return { start, end: mockShiftDay(start, 6) }
  }
  const [year, month] = day.split('-').map(Number)
  const start = `${day.slice(0, 7)}-01`
  return { start, end: new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10) }
}

function mockFieldRefusal(
  field: string,
  message: string,
  inWhere: 'query' | 'body' = 'query'
): MockRefusal {
  return {
    status: 422,
    body: authErrorBody(message, 'validation_error', [{ field, in: inWhere, message }]),
  }
}

/** The period asked for, or what the API refuses: a day after today, or no such period. */
function mockAgentWindow(
  params: URLSearchParams,
  actor: MockUser
): { window: MockAgentWindow } | { refused: MockRefusal } {
  const timezone = actor.timezone ?? MOCK_BUSINESS_TIMEZONE
  const asked = params.get('period') ?? 'today'
  if (!MOCK_AGENT_PERIODS.includes(asked as AgentPeriod)) {
    return { refused: mockFieldRefusal('period', "Input should be 'today', 'week' or 'month'") }
  }
  const period = asked as AgentPeriod
  const today = businessDay(new Date(), timezone)
  const day = params.get('date') ?? today
  if (day > today) {
    const message = 'date must not be after today'
    return {
      refused: {
        status: 422,
        body: authErrorBody(message, 'reporting.window_out_of_range', [
          { field: 'date', in: 'query', message },
        ]),
      },
    }
  }
  return { window: { period, ...mockPeriodWindow(period, day), timezone } }
}

function mockAgentSeed(text: string): number {
  return text.split('').reduce((sum, ch) => (sum * 31 + ch.charCodeAt(0)) % 9973, 7)
}

function mockAgentDays(window: MockAgentWindow): number {
  return Math.round((Date.parse(window.end) - Date.parse(window.start)) / 86_400_000) + 1
}

/** One agent's figures. An inactive agent did nothing, so is listed only by name. */
function mockAgentRow(user: MockUser, stage: 'fronter' | 'closer', window: MockAgentWindow): AgentStats {
  const seed = mockAgentSeed(`${user.id}:${stage}:${window.start}`)
  const days = mockAgentDays(window)
  const worked = user.active ? 1 : 0
  const monthly = window.period === 'month'
  const targets = MOCK_AGENT_TARGETS.get(`${user.id}:${stage}`) ?? NO_MOCK_TARGETS
  const target =
    window.period === 'today'
      ? targets.daily
      : window.period === 'week'
        ? targets.weekly
        : targets.monthly
  const team = MOCK_TEAMS.find((row) => row.id === user.team_id)
  const base = {
    user_id: user.id,
    name: user.name,
    active: user.active,
    team_id: team?.id ?? null,
    team_name: team?.name ?? null,
    stage,
    targets,
  }
  if (stage === 'fronter') {
    const qualifications = worked * (days * 3 + (seed % 4))
    return {
      ...base,
      fronter: {
        qualifications,
        transfers: Math.max(0, qualifications - (seed % 3)),
        callbacks: worked * (days * 2 + (seed % 3)),
        paid: monthly ? Math.floor(qualifications / 4) : null,
        target,
      },
      closer: null,
    }
  }
  const sold = worked * (days + (seed % 3))
  const paid = monthly ? Math.round(sold * 0.6) : null
  return {
    ...base,
    fronter: null,
    closer: {
      sold,
      paid,
      cancelled: Math.floor(sold / 6),
      retained: Math.floor(sold / 3),
      pending: Math.floor(sold / 4),
      conversion_rate: paid !== null && sold ? paid / sold : null,
      average_qa_score: sold ? 70 + (seed % 25) + 0.5 : null,
      target,
    },
  }
}

function mockAgentCounted(row: AgentStats): boolean {
  const figures = row.fronter ?? row.closer
  return Object.entries(figures ?? {}).some(
    ([name, value]) => name !== 'target' && name !== 'average_qa_score' && Boolean(value)
  )
}

/** How many sales stand behind one of an agent's figures. */
function mockAgentSaleCount(row: AgentStats, kind: AgentSaleKind): number {
  const sold = row.closer?.sold ?? Math.floor((row.fronter?.qualifications ?? 0) / 3)
  if (kind === 'cancelled') return row.closer?.cancelled ?? Math.floor(sold / 6)
  if (kind === 'paid') return row.closer?.paid ?? row.fronter?.paid ?? 0
  return sold
}

function mockAgentSales(
  row: AgentStats,
  window: MockAgentWindow,
  kind: AgentSaleKind,
  page: { limit: number; offset: number },
  amounts: boolean
) {
  const count = mockAgentSaleCount(row, kind)
  const statuses = [
    ...Array(row.closer?.cancelled ?? 0).fill('cancelled'),
    ...Array(row.closer?.retained ?? 0).fill('retained'),
    ...Array(row.closer?.pending ?? 0).fill('pending'),
  ]
  const opens = Date.parse(`${window.start}T15:00:00Z`)
  const items: AgentSaleItem[] = Array.from({ length: count }, (_, n) => {
    const nth = mockAgentSeed(`${row.user_id}:${kind}`) + n
    return {
      lead_id: `mock-agent-lead-${row.user_id}-${nth}`,
      interaction_id: `mock-agent-sale-${row.user_id}-${kind}-${window.start}-${n}`,
      lead_name: mockLeadName(nth),
      closer_name: row.stage === 'closer' ? row.name : 'Carl Closer',
      sold_at: new Date(opens + (count - n) * 3_600_000).toISOString(),
      policy_number: n % 5 === 4 ? null : `POL-${String(10_000 + nth).slice(-5)}`,
      policy_status:
        kind === 'cancelled' ? 'cancelled' : ((statuses[n] as AgentSaleItem['policy_status']) ?? null),
      paid_month: kind === 'paid' ? window.start.slice(0, 8) + '01' : null,
      qa_score: n % 3 === 2 ? null : 60 + (nth % 40),
      qa_note:
        n % 3 === 2 ? null : n % 2 === 0 ? 'Clean call, every disclosure read.' : 'Rushed the price.',
      total_payment: amounts ? '2400.00' : null,
      down_payment: amounts ? '400.00' : null,
      monthly_payment: amounts ? '100.00' : null,
    }
  })
  return {
    items: items.slice(page.offset, page.offset + page.limit),
    total: items.length,
    ...page,
  }
}

/** The leads an agent worked: ids the lead views open, on the agent's own team. */
function mockAgentLeads(row: AgentStats, window: MockAgentWindow, page: { limit: number; offset: number }) {
  const label = (id: string) => MOCK_DISPOSITION_CATALOG.find((entry) => entry.id === id)?.label ?? null
  const done = row.fronter
    ? row.fronter.qualifications + row.fronter.callbacks
    : (row.closer?.sold ?? 0) + 2
  const opens = Date.parse(`${window.start}T14:00:00Z`)
  const items: AgentLeadItem[] = Array.from({ length: done }, (_, n) => {
    const nth = mockAgentSeed(`${row.user_id}:leads`) + n
    const sold = row.closer ? n < row.closer.sold : false
    const qualified = row.fronter ? n < row.fronter.qualifications : false
    const stage: FunnelStage = sold ? 'sold' : qualified || row.closer ? 'transferred' : 'leads'
    const addedAt = opens + (done - n) * 3_600_000
    return {
      lead_id: mockLeadId(stage, nth, addedAt, row.team_id ?? MOCK_TEAM_ID),
      lead_name: mockLeadName(nth),
      lead_phone: mockLeadPhone(nth),
      outcome: row.fronter
        ? label(qualified ? 'disp-fronter-qualified' : 'disp-fronter-callback')
        : sold
          ? label('disp-closer-sale')
          : null,
      worked_at: new Date(addedAt + 30 * 60_000).toISOString(),
    }
  })
  return { items: items.slice(page.offset, page.offset + page.limit), total: items.length, ...page }
}

/** The agent an admin asked about, when they may see them; the API's 404 otherwise. */
function mockScopedAgent(
  authorization: string | null,
  userId: string
): { refused: MockRefusal } | { agent: MockUser; actor: MockUser } {
  const actor = mockActor(authorization)
  const agent = MOCK_USERS.find((row) => row.id === userId)
  if (!agent || !actor || (!actor.roles.includes('super_admin') && agent.team_id !== actor.team_id)) {
    return { refused: { status: 404, body: authErrorBody('user not found', 'user.not_found') } }
  }
  return { agent, actor }
}

function mockAgentStage(params: URLSearchParams): 'fronter' | 'closer' | null {
  const stage = params.get('stage')
  return stage === 'fronter' || stage === 'closer' ? stage : null
}

function mockAgentPage(params: URLSearchParams) {
  return { limit: Number(params.get('limit') ?? 50), offset: Number(params.get('offset') ?? 0) }
}

function mockSaleKind(params: URLSearchParams): AgentSaleKind | null {
  const kind = params.get('kind')
  return kind === 'sold' || kind === 'paid' || kind === 'cancelled' ? kind : null
}

const MOCK_PAID_NEEDS_MONTH = mockFieldRefusal(
  'kind',
  'Paid is counted by month, so its sales are listed for a month only'
)

function mockReached(funnel: HistoricalFunnel, nth: number): FunnelStage {
  if (nth < funnel.paid) return 'paid'
  if (nth < funnel.sold) return 'sold'
  if (nth < funnel.transferred) return 'transferred'
  if (nth < funnel.qualified) return 'qualified'
  return 'leads'
}

function mockLeadPhone(nth: number) {
  return `+1555${String(2_000_000 + nth).slice(-7)}`
}

/** Every fourth lead has no name, so the phone stands in, as the API's does. */
function mockLeadName(nth: number) {
  return nth % 4 === 3 ? mockLeadPhone(nth) : QUEUE_LEAD_NAMES[nth % QUEUE_LEAD_NAMES.length]
}

/** A mock lead's id, carrying what its history needs to tell the same story. */
function mockLeadId(stage: FunnelStage, nth: number, addedAt: number, teamId: string) {
  return `mock-lead-${stage}-${nth}-${addedAt}-${teamId}`
}

/** The latest fronter and closer outcome of a lead that got this far. */
function mockLeadOutcomes(reached: FunnelStage, nth: number) {
  const label = (id: string) => MOCK_DISPOSITION_CATALOG.find((row) => row.id === id)?.label ?? null
  const handedOver = label('disp-fronter-qualified')
  if (reached === 'sold' || reached === 'paid') {
    return { fronter_outcome: handedOver, closer_outcome: label('disp-closer-sale') }
  }
  if (reached === 'transferred') {
    return {
      // Called back after the handoff, which doesn't undo it.
      fronter_outcome: nth % 3 === 0 ? label('disp-fronter-callback') : handedOver,
      closer_outcome: nth % 2 === 0 ? label('disp-closer-callback') : null,
    }
  }
  if (reached === 'qualified') return { fronter_outcome: handedOver, closer_outcome: null }
  const unworked = ['disp-fronter-callback', 'disp-fronter-not-interested', 'disp-fronter-invalid']
  return {
    fronter_outcome: nth % 4 === 0 ? null : label(unworked[nth % unworked.length]),
    closer_outcome: null,
  }
}

/**
 * One page of the leads behind a funnel number, newest first.
 *
 * `total` comes off `mockFunnel` so the footer count equals the bar above it,
 * and the nth lead is the same lead, at the same stage, in every list it is in.
 * Rows follow the offset, so paging never repeats a row.
 */
function mockFunnelStage(
  stage: FunnelStage,
  start: string,
  end: string,
  teamId: string | null,
  limit: number,
  offset: number,
  timezone?: string | null
): FunnelLeadList {
  const funnel = mockFunnel(start, end, teamId, timezone)
  const teams = [...MOCK_TEAMS]
    .filter((team) => (teamId ? team.id === teamId : team.active))
    .sort((a, b) => a.name.localeCompare(b.name))
  const total = funnel[stage]
  // Mid-afternoon on the window's last day, walked backwards, so rows read
  // newest first and stay inside the range in any plausible business zone.
  const latest = Date.parse(`${end}T17:00:00.000Z`)
  const span = Math.max(1, Date.parse(end) - Date.parse(start) + 86_400_000)

  return {
    items: Array.from({ length: Math.max(0, Math.min(limit, total - offset)) }, (_, index) => {
      const nth = offset + index
      const reached = mockReached(funnel, nth)
      const addedAt = latest - ((nth * 7 * 60_000) % span)
      const team = teams[nth % teams.length]
      return {
        lead_id: mockLeadId(reached, nth, addedAt, team.id),
        lead_name: mockLeadName(nth),
        lead_phone: mockLeadPhone(nth),
        team_id: team.id,
        team_name: team.name,
        created_at: new Date(addedAt).toISOString(),
        stage: reached,
        ...mockLeadOutcomes(reached, nth),
      }
    }),
    total,
    timezone: funnel.timezone,
    limit,
    offset,
  }
}

let issuedCalls = 0

/** The leads a mock fronter can work: their team's, plus the seeded callbacks. */
function mockWorkableLeads(teamId: string | null): LeadResponse[] {
  const team = MOCK_TEAM_LEADS.filter((lead) => teamId === null || lead.team_id === teamId)
  const callbacks = MOCK_FRONTER_CALLBACKS.map((row) => MOCK_LEADS[row.lead_id]).filter(Boolean)
  const seen = new Set<string>()
  return [...team.map(leadBody), ...callbacks].filter((lead) => {
    if (seen.has(lead.id)) return false
    seen.add(lead.id)
    return true
  })
}

/** A mock lead's calls, oldest first, with when each began. */
function mockCallsOf(leadId: string): { id: string; at: string }[] {
  const calls = new Map<string, string>()
  for (const interaction of Object.values(MOCK_INTERACTIONS)) {
    if (interaction.lead_id === leadId) calls.set(interaction.id, interaction.created_at)
  }
  for (const row of MOCK_FRONTER_CALLBACKS) {
    if (row.lead_id === leadId && !calls.has(row.id)) calls.set(row.id, row.dispositioned_at)
  }
  return [...calls].map(([id, at]) => ({ id, at })).sort((a, b) => a.at.localeCompare(b.at))
}

/** A call's fronter dispositions, oldest first; a seeded callback counts as one. */
function mockFronterDispositionsOn(callId: string): { id: string; label: string; at: string }[] {
  const recorded = (MOCK_INTERACTION_DISPOSITIONS.get(callId) ?? []).filter(
    (row) => row.stage === 'fronter'
  )
  if (recorded.length > 0) {
    return [...recorded]
      .sort((a, b) => a.version - b.version)
      .map((row) => ({ id: row.disposition_id, label: row.label, at: row.created_at }))
  }
  const seeded = MOCK_FRONTER_CALLBACKS.find((row) => row.id === callId)
  const callback = MOCK_DISPOSITION_CATALOG.find(
    (row) => row.stage === 'fronter' && row.label === 'Callback'
  )
  return seeded && callback
    ? [{ id: callback.id, label: seeded.disposition_label, at: seeded.dispositioned_at }]
    : []
}

/** The latest fronter disposition across a mock lead's calls, as the API reads it. */
function mockLatestDisposition(leadId: string) {
  let latest: { id: string; label: string; at: string } | null = null
  for (const call of mockCallsOf(leadId)) {
    for (const row of mockFronterDispositionsOn(call.id)) {
      if (!latest || row.at >= latest.at) latest = row
    }
  }
  return latest
}

/** Accepted by a closer, or sold, on any of its calls: no longer the fronter's to work. */
function mockWithACloser(leadId: string): boolean {
  const calls = new Set(mockCallsOf(leadId).map((call) => call.id))
  const accepted = [...MOCK_TRANSFERS.values()].some(
    (row) => row.status === 'accepted' && calls.has(row.interaction_id)
  )
  const sold = [...calls].some((id) => {
    const closer = (MOCK_INTERACTION_DISPOSITIONS.get(id) ?? []).filter((row) => row.stage === 'closer')
    return closer.sort((a, b) => b.version - a.version)[0]?.label === 'Sale'
  })
  return accepted || sold
}

/** The fronter roles and the team they read, or why the request is refused. */
function mockLeadWorker(authorization: string | null) {
  const actor = mockActor(authorization)
  if (!actor || !actor.active) {
    return {
      refused: {
        status: 401,
        body: authErrorBody('Could not validate credentials', 'auth.not_authenticated'),
      },
    }
  }
  const allowed = ['fronter', 'administrator', 'super_admin'] as const
  if (!actor.roles.some((role) => (allowed as readonly string[]).includes(role))) {
    return {
      refused: {
        status: 403,
        body: authErrorBody('Insufficient role for this operation', 'auth.forbidden'),
      },
    }
  }
  return { teamId: actor.roles.includes('super_admin') ? null : (actor.team_id ?? 'no-team') }
}

const MOCK_STAGE_ORDER: FunnelStage[] = ['leads', 'qualified', 'transferred', 'sold', 'paid']

/**
 * Everything behind a lead from a mock funnel list. It reaches the stage its id
 * names, with an edit, a correction, a turned-down transfer and, when sold, two
 * cart saves; its latest outcomes match its row in the list.
 */
function mockLeadHistory(leadId: string): LeadHistory | null {
  const parsed = /^mock-lead-(leads|qualified|transferred|sold|paid)-(\d+)-(\d+)-(.+)$/.exec(
    leadId
  )
  const team = parsed && MOCK_TEAMS.find((row) => row.id === parsed[4])
  if (!parsed || !team) return null
  const reached = parsed[1] as FunnelStage
  const nth = Number(parsed[2])
  const addedAt = Number(parsed[3])
  const depth = MOCK_STAGE_ORDER.indexOf(reached)
  const outcomes = mockLeadOutcomes(reached, nth)
  const at = (minutes: number) => new Date(addedAt + minutes * 60_000).toISOString()
  const fronter = 'Fiona Fronter'
  const closer = 'Carl Closer'
  const events: LeadHistoryEvent[] = []
  const add = (event: Omit<LeadHistoryEvent, 'changes'> & Partial<LeadHistoryEvent>) =>
    events.push({ changes: [], ...event })
  const onCall = (call: number, event: Omit<LeadHistoryEvent, 'changes'>) =>
    add({ ...event, call, interaction_id: `${leadId}-call-${call}` })
  const civic = nth % 2 === 0
  const skipped = nth % 5 === 0 ? 'Customer had to leave, mileage given verbally' : null
  const optedOut = nth % 7 === 6

  add({ kind: 'added', at: at(0), actor_name: fronter })
  if (civic) {
    add({
      kind: 'lead_edited',
      at: at(5),
      actor_name: fronter,
      changes: [{ field: 'vehicle_model', before: 'Accord', after: 'Civic' }],
    })
  }
  if (depth === 0 && outcomes.fronter_outcome) {
    onCall(1, { kind: 'fronter_outcome', at: at(10), actor_name: fronter, outcome: outcomes.fronter_outcome, version: 1 })
  }
  if (depth >= 1) {
    onCall(1, { kind: 'fronter_outcome', at: at(10), actor_name: fronter, outcome: 'Callback', version: 1 })
    onCall(1, {
      kind: 'fronter_outcome',
      at: at(12),
      actor_name: fronter,
      outcome: 'Transferred',
      version: 2,
      previous_outcome: 'Callback',
    })
    onCall(1, { kind: 'qualification', at: at(14), actor_name: fronter, version: 1 })
  }
  if (depth >= 2) {
    onCall(1, { kind: 'transfer_offered', at: at(15), actor_name: fronter, transfer_status: 'rejected', closer_name: 'Bea Both' })
    onCall(1, { kind: 'transfer_rejected', at: at(16), actor_name: 'Bea Both' })
    onCall(1, { kind: 'transfer_offered', at: at(17), actor_name: fronter, transfer_status: 'accepted', closer_name: closer, reason: skipped })
    onCall(1, { kind: 'transfer_accepted', at: at(18), actor_name: closer })
  }
  const policy = `POL-${String(10_000 + nth).slice(-5)}`
  // An upload made in mock mode decides, then a lead the funnel listed as paid.
  const paidMonth =
    mockPaidMonth(`${leadId}-call-1`) ??
    (reached === 'paid' ? `${new Date(addedAt).toISOString().slice(0, 7)}-01` : null)
  if (depth >= 3) {
    onCall(1, {
      kind: 'cart_saved',
      at: at(28),
      actor_name: closer,
      amounts: { policy_number: policy, total_payment: '2000.00', down_payment: '400.00', monthly_payment: '66.67' },
    })
    onCall(1, {
      kind: 'cart_saved',
      at: at(30),
      actor_name: closer,
      amounts: { policy_number: policy, total_payment: '2400.00', down_payment: '400.00', monthly_payment: '83.33' },
    })
    onCall(1, { kind: 'closer_outcome', at: at(35), actor_name: closer, outcome: 'Sale', version: 1 })
    onCall(1, { kind: 'sold', at: at(35), actor_name: closer, outcome: 'Sale' })
  }
  if (depth === 2 && outcomes.closer_outcome) {
    onCall(1, { kind: 'closer_outcome', at: at(35), actor_name: closer, outcome: outcomes.closer_outcome, version: 1 })
  }
  // Called back after the handoff, on a call of its own.
  const calledBack = depth === 2 && outcomes.fronter_outcome === 'Callback'
  if (calledBack) {
    onCall(2, { kind: 'fronter_outcome', at: at(24 * 60), actor_name: fronter, outcome: 'Callback', version: 1 })
  }
  if (optedOut) {
    add({ kind: 'do_not_call', at: at(2 * 24 * 60), actor_name: fronter, reason: 'Asked not to be called again' })
  }

  const last = (kind: LeadHistoryEvent['kind']) => {
    const event = [...events].reverse().find((row) => row.kind === kind)
    return event ? { outcome: event.outcome ?? '', actor_name: event.actor_name ?? null, at: event.at } : null
  }
  const latestFronter = last('fronter_outcome')
  const onTheList = latestFronter?.outcome === 'Callback' && (depth === 0 || calledBack)

  return {
    lead: {
      id: leadId,
      lead_name: mockLeadName(nth),
      phone_no: mockLeadPhone(nth),
      vehicle_year: 2016 + (nth % 6),
      vehicle_make: civic ? 'Honda' : 'Toyota',
      vehicle_model: civic ? 'Civic' : 'Camry',
      vin: nth % 3 === 0 ? null : `1HGCM82633A${String(100_000 + nth).slice(-6)}`,
      license_plate: nth % 3 === 0 ? `TX-${String(1000 + nth).slice(-4)}` : null,
      team_id: team.id,
      team_name: team.name,
      source: 'manual',
      created_at: at(0),
      updated_at: civic ? at(5) : at(0),
      added_by_name: fronter,
    },
    status: {
      stage: depth >= 3 && paidMonth ? 'paid' : reached === 'paid' ? 'sold' : reached,
      calls: calledBack ? 2 : events.some((event) => event.call) ? 1 : 0,
      latest_fronter: latestFronter,
      latest_closer: last('closer_outcome'),
      callback: onTheList ? latestFronter : null,
      awaiting_closer: false,
      // Accepted with no closer outcome yet: the closer is still on the call.
      with_closer: depth === 2 && !outcomes.closer_outcome ? closer : null,
      do_not_call: optedOut,
    },
    form:
      depth >= 1
        ? {
            snapshot: { has_warranty: civic, best_time_to_call: 'Evenings', mileage: 84_000 },
            consent: { consent_given: true, consent_captured_at: at(13), dnc_flagged: false, dnc_source: null },
            version: 1,
            saved_at: at(14),
            saved_by: fronter,
          }
        : null,
    carts:
      depth >= 3
        ? [
            {
              interaction_id: `${leadId}-call-1`,
              account_last4: '1234',
              routing_last4: '0021',
              expiry: '11/29',
              policy_number: policy,
              total_payment: '2400.00',
              down_payment: '400.00',
              monthly_payment: '83.33',
              saved_by: closer,
              saved_at: at(30),
              paid_month: paidMonth,
              policy_status: mockCurrentStatus(`${leadId}-call-1`)?.status ?? null,
            },
          ]
        : [],
    events,
  }
}

/**
 * The team a report covers: a Super Admin's pick or every team, anyone else's
 * own. Naming another team is refused, as the API refuses it.
 */
function mockReportTeam(authorization: string | null, asked: string | null) {
  const actor = mockActor(authorization)
  if (actor?.roles.includes('super_admin')) return { teamId: asked }
  if (asked && asked !== actor?.team_id) {
    return {
      refused: {
        status: 403,
        body: authErrorBody('you can only see your own team', 'team.forbidden'),
      },
    }
  }
  // No team means no leads, never every team's.
  return { teamId: actor?.team_id ?? 'no-team' }
}

// Seed data for the fronter workspace screen (FE-02). Standing in for the
// Thin BE interaction detail + separate leads. Queue workspace links use
// `int-2000+` / closer seeds — synthesize anything not listed explicitly.
const MOCK_LEADS: Record<string, LeadResponse> = {
  'lead-1': {
    id: 'lead-1',
    phone_no: '+13235550142',
    source: 'vicidial',
    first_name: 'Jane',
    last_name: 'D.',
    vehicle_make: 'Toyota',
    vehicle_year: 2019,
    vehicle_model: 'Camry',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
    updated_at: new Date().toISOString(),
  },
  'lead-2': {
    id: 'lead-2',
    phone_no: '+14085550199',
    source: 'ghl',
    first_name: 'Sam',
    last_name: 'Nguyen',
    vehicle_make: 'Toyota',
    vehicle_year: 2019,
    vehicle_model: 'Camry',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString(),
    updated_at: new Date().toISOString(),
  },
  'lead-1102': {
    id: 'lead-1102',
    phone_no: '+13105550188',
    source: 'vicidial',
    first_name: 'Alex',
    last_name: 'R.',
    vehicle_make: 'Honda',
    vehicle_year: 2021,
    vehicle_model: 'Accord',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    updated_at: new Date().toISOString(),
  },
  'lead-1103': {
    id: 'lead-1103',
    phone_no: '+18135550177',
    source: 'ghl',
    first_name: 'Priya',
    last_name: 'S.',
    vehicle_make: 'Ford',
    vehicle_year: 2016,
    vehicle_model: 'F-150',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 8).toISOString(),
    updated_at: new Date().toISOString(),
  },
}

/** `own_sale_closer_id`: the closer who started the call on Own Sale, with no transfer. */
type MockInteraction = Omit<InteractionDetailResponse, 'own_sale'> & {
  own_sale_closer_id?: string
}

const MOCK_INTERACTIONS: Record<string, MockInteraction> = {
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
    phone_no: `+1323555${digits}`,
    source: Number(digits) % 2 === 0 ? 'vicidial' : 'ghl',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    updated_at: new Date().toISOString(),
  }
  MOCK_LEADS[leadId] = lead
  return lead
}

function interactionDetail(interactionId: string): InteractionDetailResponse | null {
  const known = MOCK_INTERACTIONS[interactionId]
  if (known) {
    const { own_sale_closer_id: ownSaleCloser, ...detail } = known
    return { ...detail, own_sale: Boolean(ownSaleCloser) }
  }
  // Queue rows and unknown workspace ids still need a usable Active Call shell.
  if (!interactionId) return null
  const lead = synthesizeLead(interactionId)
  return {
    id: interactionId,
    lead_id: lead.id,
    created_at: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
    qualification: null,
    own_sale: false,
  }
}

function customerFromLead(lead: LeadResponse): QualificationCustomer {
  return {
    lead_id: lead.id,
    phone_no: lead.phone_no,
    first_name: lead.first_name ?? null,
    last_name: lead.last_name ?? null,
    vehicle_make: lead.vehicle_make ?? null,
    vehicle_year: lead.vehicle_year ?? null,
    vehicle_model: lead.vehicle_model ?? null,
    vin: lead.vin ?? null,
    license_plate: lead.license_plate ?? null,
  }
}

function leadForInteraction(interactionId: string): LeadResponse {
  const interaction = interactionDetail(interactionId)
  if (!interaction) return synthesizeLead(interactionId)
  return MOCK_LEADS[interaction.lead_id] ?? synthesizeLead(interactionId)
}

// Closer transfer queue + fronter callback list (Callback only).
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

const QUEUE_SEEDED_AT = Date.now()

const MOCK_FRONTER_CALLBACKS: FronterQueueEntry[] = Array.from({ length: 6 }, (_, index) => {
  const leadId = `lead-cb-${2000 + index}`
  const phone = `+1323555${(1000 + index).toString().slice(-4)}`
  const name = QUEUE_LEAD_NAMES[index % QUEUE_LEAD_NAMES.length]
  const [first = name, ...rest] = name.split(' ')
  const last = rest.join(' ') || 'Callback'
  const at = new Date(QUEUE_SEEDED_AT - (index + 1) * 45 * 60 * 1000).toISOString()
  const lead: LeadResponse = {
    id: leadId,
    phone_no: phone,
    source: 'manual',
    first_name: first,
    last_name: last,
    vehicle_make: 'Toyota',
    vehicle_year: 2018,
    vehicle_model: 'Camry',
    vin: `VIN-CB-${2000 + index}`,
    created_at: at,
    updated_at: at,
  }
  MOCK_LEADS[leadId] = lead
  return {
    id: `int-cb-${2000 + index}`,
    lead_id: leadId,
    lead_name: name,
    lead_phone: phone,
    disposition_label: 'Callback',
    dispositioned_at: at,
    actor_user_id: '1',
  }
})

// Transfers only: an Own Sale row comes from the calls closers start.
const MOCK_CLOSER_QUEUE: (Omit<CloserQueueEntry, 'status'> & {
  status: 'initiated' | 'offered' | 'accepted'
})[] = Array.from({ length: 12 }, (_, index) => ({
  id: `transfer-${3000 + index}`,
  interaction_id: `int-${1100 + index}`,
  lead_name: QUEUE_LEAD_NAMES[index % QUEUE_LEAD_NAMES.length],
  lead_phone: `+1323555${(2000 + index).toString().slice(-4)}`,
  fronter_user_id: index % 3 === 0 ? null : `fronter-${(index % 4) + 1}`,
  queued_at: new Date(QUEUE_SEEDED_AT - (120 - index * 5) * 1000).toISOString(),
  // Mix pending offers with this closer's open accepted call (index 1).
  status: index === 1 ? 'accepted' : index % 4 === 0 ? 'offered' : 'initiated',
}))

// The Leads tab's view: leads by team. MOCK_LEADS stands in for the workspace's
// per-call lookups and carries no team, so it can't answer GET /leads alone.
type MockTeamLead = LeadResponse & { team_id: string }

function seededTeamLead(
  id: string,
  phone: string,
  source: LeadResponse['source'],
  teamId: string,
  daysAgo: number
): MockTeamLead {
  const at = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString()
  return { id, phone_no: phone, source, team_id: teamId, created_at: at, updated_at: at }
}

/** Newest first, as the API lists them. */
const MOCK_TEAM_LEADS: MockTeamLead[] = [
  seededTeamLead('lead-team-1', '+12125550134', 'manual', MOCK_TEAM_EAST, 1),
  seededTeamLead('lead-team-2', '+14155550110', 'manual', MOCK_TEAM_WEST, 2),
  seededTeamLead('lead-team-3', '+13235550155', 'vicidial', MOCK_TEAM_EAST, 4),
]

/** Stands in for the company do-not-call list. */
const MOCK_SUPPRESSED_PHONES = new Set(['+12125550000'])

let issuedLeads = 0

function leadBody(lead: MockTeamLead): LeadResponse {
  const { team_id: _teamId, ...body } = lead
  return body
}

/** A US-only stand-in for the API's normalizer: E.164, or null when unusable. */
function mockNormalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return null
}

function teamLeadFor(teamId: string, phone: string): MockTeamLead | undefined {
  return MOCK_TEAM_LEADS.find((lead) => lead.team_id === teamId && lead.phone_no === phone)
}

type LeadFormBody = {
  first_name?: string
  last_name?: string
  phone_no?: string
  vehicle_make?: string
  vehicle_year?: number
  vehicle_model?: string
  vin?: string | null
  license_plate?: string | null
}

function mockValidateLeadForm(body: LeadFormBody): FieldError[] {
  const fields: FieldError[] = []
  const need = (field: string, ok: boolean, message: string) => {
    if (!ok) fields.push({ field, in: 'body', message })
  }
  need('first_name', Boolean(body.first_name?.trim()), 'Enter a first name.')
  need('last_name', Boolean(body.last_name?.trim()), 'Enter a last name.')
  need('vehicle_make', Boolean(body.vehicle_make?.trim()), 'Enter the vehicle make.')
  need('vehicle_model', Boolean(body.vehicle_model?.trim()), 'Enter the vehicle model.')
  const year = body.vehicle_year
  need(
    'vehicle_year',
    typeof year === 'number' && Number.isInteger(year) && year >= 1900 && year <= 2100,
    'Enter a year between 1900 and 2100.'
  )
  const vin = body.vin?.trim()
  const plate = body.license_plate?.trim()
  if (!vin && !plate) {
    fields.push({ field: 'vin', in: 'body', message: 'provide vin and/or license_plate' })
    fields.push({
      field: 'license_plate',
      in: 'body',
      message: 'provide vin and/or license_plate',
    })
  }
  return fields
}

/** Form create: insert + mint interaction, or fill an existing phone match. */
function addMockFormLead(teamId: string, actorId: string, body: LeadFormBody): MockTeamLead {
  const phone = mockNormalizePhone(String(body.phone_no ?? ''))!
  const existing = teamLeadFor(teamId, phone)
  const now = new Date().toISOString()
  const formFields = {
    first_name: body.first_name!.trim(),
    last_name: body.last_name!.trim(),
    vehicle_make: body.vehicle_make!.trim(),
    vehicle_year: body.vehicle_year!,
    vehicle_model: body.vehicle_model!.trim(),
    vin: body.vin?.trim() || null,
    license_plate: body.license_plate?.trim() || null,
    fronter_id: actorId,
  }

  if (existing) {
    Object.assign(existing, formFields, { updated_at: now })
    MOCK_LEADS[existing.id] = leadBody(existing)
    let interactionId = existing.interaction_id
    if (!interactionId) {
      issuedLeads += 1
      interactionId = `int-manual-${issuedLeads}`
      existing.interaction_id = interactionId
      MOCK_INTERACTIONS[interactionId] = {
        id: interactionId,
        lead_id: existing.id,
        created_at: now,
        updated_at: now,
        qualification: null,
      }
      MOCK_LEADS[existing.id] = leadBody(existing)
    }
    return existing
  }

  issuedLeads += 1
  const interactionId = `int-manual-${issuedLeads}`
  const lead: MockTeamLead = {
    id: `lead-manual-${issuedLeads}`,
    phone_no: phone,
    source: 'manual',
    team_id: teamId,
    created_at: now,
    updated_at: now,
    interaction_id: interactionId,
    ...formFields,
  }
  MOCK_TEAM_LEADS.unshift(lead)
  MOCK_LEADS[lead.id] = leadBody(lead)
  MOCK_INTERACTIONS[interactionId] = {
    id: interactionId,
    lead_id: lead.id,
    created_at: now,
    updated_at: now,
    qualification: null,
  }
  return lead
}

/** Bulk CSV: phone-only row onto the team (no form fields, no interaction). */
function addMockLead(teamId: string, phone: string): MockTeamLead {
  issuedLeads += 1
  const now = new Date().toISOString()
  const lead: MockTeamLead = {
    id: `lead-manual-${issuedLeads}`,
    phone_no: phone,
    source: 'manual',
    team_id: teamId,
    created_at: now,
    updated_at: now,
  }
  MOCK_TEAM_LEADS.unshift(lead)
  MOCK_LEADS[lead.id] = leadBody(lead)
  return lead
}

/** The queue label for a team's new bulk leads, by the API's rule, or why it refuses. */
function mockCampaignFor(
  teamId: string,
  campaignId: string | null | undefined
): { name: string | null } | { status: number; body: ReturnType<typeof authErrorBody> } {
  const refusal = (status: number, detail: string, code: string) => ({
    status,
    body: authErrorBody(detail, code, [{ field: 'campaign_id', in: 'body', message: detail }]),
  })
  if (campaignId) {
    const campaign = MOCK_CAMPAIGNS.find((row) => row.id === campaignId)
    if (!campaign) return refusal(404, 'campaign not found', 'campaign.not_found')
    if (!campaign.active) return refusal(422, 'campaign is inactive', 'lead.campaign_inactive')
    if (!campaign.team_ids.includes(teamId)) {
      return refusal(422, 'campaign is not linked to this team', 'lead.campaign_not_on_team')
    }
    return { name: campaign.name }
  }
  const active = MOCK_CAMPAIGNS.filter((row) => row.active && row.team_ids.includes(teamId))
  if (active.length > 1) {
    return refusal(
      422,
      'this team has more than one active campaign; name one',
      'lead.campaign_required'
    )
  }
  return { name: active[0]?.name ?? null }
}

/** Admin-only routes refuse fronters; lead create allows fronter or administrator. */
function leadCreateRefusal(authorization: string | null) {
  const user = MOCK_TOKENS.get((authorization || '').replace(/^Bearer\s+/i, ''))
  if (!user || !user.active) {
    return {
      status: 401,
      body: authErrorBody('Could not validate credentials', 'auth.not_authenticated'),
    }
  }
  if (!user.roles.includes('fronter') && !roleSatisfies(user.roles, 'administrator')) {
    return {
      status: 403,
      body: authErrorBody('Insufficient role for this operation', 'auth.forbidden'),
    }
  }
  return null
}

/** Good enough for mock mode: no quoted commas. */
function splitCsvLine(line: string): string[] {
  return line.split(',').map((cell) => cell.trim().replace(/^"(.*)"$/, '$1'))
}

const MOCK_QUALIFICATIONS = new Map<string, QualificationResponse>()
let qualificationSeq = 0
let transferSeq = 0

const MOCK_TRANSFERS = new Map<string, TransferResponse>()

/** Shared by GET /transfers/closers and the POST /transfers closer check. */
const MOCK_AVAILABLE_CLOSERS: Omit<AvailableCloserItem, 'waiting'>[] = [
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
]

function seedCloserQualification(
  interactionId: string,
  snapshot: {
    first_name: string
    last_name: string
    phone_no: string
    vehicle_year: string
    vehicle_make: string
    vehicle_model: string
    vin: string
    license_plate: string
  },
  consent: { consent_given: boolean; dnc_flagged: boolean }
) {
  const now = new Date().toISOString()
  const lead = leadForInteraction(interactionId)
  // Keep lead fields in sync with the desk seed so GET /qualification returns them.
  lead.first_name = snapshot.first_name || lead.first_name
  lead.last_name = snapshot.last_name || lead.last_name
  lead.phone_no = snapshot.phone_no || lead.phone_no
  lead.vehicle_year = Number(snapshot.vehicle_year) || lead.vehicle_year
  lead.vehicle_make = snapshot.vehicle_make || lead.vehicle_make
  lead.vehicle_model = snapshot.vehicle_model || lead.vehicle_model
  if (snapshot.vin) lead.vin = snapshot.vin
  if (snapshot.license_plate) lead.license_plate = snapshot.license_plate

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
      override: { applied: false, reason: '' },
      vehicle_year: snapshot.vehicle_year,
      vehicle_make: snapshot.vehicle_make,
      vehicle_model: snapshot.vehicle_model,
    },
    consent_dnc: {
      consent_given: consent.consent_given,
      consent_captured_at: consent.consent_given ? now : null,
      dnc_flagged: consent.dnc_flagged,
      dnc_source: null,
    },
    created_at: now,
    customer: customerFromLead(lead),
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
        first_name: entry.lead_name.split(/\s+/)[0] ?? 'Queued',
        last_name: entry.lead_name.split(/\s+/).slice(1).join(' ') || 'Lead',
        phone_no: entry.lead_phone,
        vehicle_year: '2018',
        vehicle_make: 'Nissan',
        vehicle_model: 'Altima',
        vin: '',
        license_plate: '',
      },
      { consent_given: true, dnc_flagged: false }
    )
  }
})()

type MockDisposition = {
  id: string
  label: string
  stage: 'fronter' | 'closer'
  /** May this outcome be handed to a closer? Gates the Transfer button. */
  allows_transfer: boolean
  /** Does this outcome mean the lead qualified? Counted by the funnel. */
  counts_as_qualified: boolean
  /** Is this outcome a sale? It then needs a saved cart. */
  counts_as_sale: boolean
  /** Kept for the calls that name it, but no longer offered to agents. */
  retired?: boolean
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

/**
 * Labels and flags mirror `tgs-caller-crm-be/scripts/seed.py`. Only
 * "Transferred" carries either flag, because only that row is
 * confirmed — the rest of the taxonomy is the client's to settle, and a mock
 * that guessed would let the UI through a state the real API refuses.
 *
 * The fronter labels are capitalised to match the real catalogue: Active Call
 * matches "Do Not Call" to tick the DNC flag, so a mock-only spelling would
 * break that link in mock mode alone.
 */
const HANDS_OVER = { allows_transfer: true, counts_as_qualified: true, counts_as_sale: false }
const ENDS_THE_CALL = { allows_transfer: false, counts_as_qualified: false, counts_as_sale: false }

const MOCK_DISPOSITION_CATALOG: MockDisposition[] = [
  { id: 'disp-closer-sale', label: 'Sale', stage: 'closer', ...ENDS_THE_CALL, counts_as_sale: true },
  { id: 'disp-closer-callback', label: 'Callback Scheduled', stage: 'closer', ...ENDS_THE_CALL },
  { id: 'disp-closer-not-interested', label: 'Not Qualified', stage: 'closer', ...ENDS_THE_CALL },
  { id: 'disp-closer-dnc', label: 'Do Not Call', stage: 'closer', ...ENDS_THE_CALL },
  { id: 'disp-fronter-qualified', label: 'Transferred', stage: 'fronter', ...HANDS_OVER },
  { id: 'disp-fronter-not-interested', label: 'Not Interested', stage: 'fronter', ...ENDS_THE_CALL, retired: true },
  { id: 'disp-fronter-callback', label: 'Callback', stage: 'fronter', ...ENDS_THE_CALL },
  { id: 'disp-fronter-dnc', label: 'Do Not Call', stage: 'fronter', ...ENDS_THE_CALL, retired: true },
  { id: 'disp-fronter-invalid', label: 'Wrong Number', stage: 'fronter', ...ENDS_THE_CALL, retired: true },
]

const MOCK_INTERACTION_DISPOSITIONS = new Map<string, MockInteractionDisposition[]>()
// Only what the API keeps: last digits, never a full number or a CVV.
const MOCK_CARTS = new Map<string, CartResponse>()
let interactionDispositionSeq = 0

// A call the mock closer set as a callback yesterday, so their Callbacks table has a row.
;(() => {
  const interactionId = 'int-closer-cb-1'
  const at = new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString()
  MOCK_TRANSFERS.set('transfer-closer-cb-1', {
    id: 'transfer-closer-cb-1',
    interaction_id: interactionId,
    status: 'accepted',
    fronter_user_id: '1',
    closer_user_id: '2',
    created_at: at,
    updated_at: at,
  })
  seedCloserQualification(
    interactionId,
    {
      first_name: 'Marcus',
      last_name: 'T.',
      phone_no: '+13235550190',
      vehicle_year: '2019',
      vehicle_make: 'Toyota',
      vehicle_model: 'RAV4',
      vin: '',
      license_plate: '',
    },
    { consent_given: true, dnc_flagged: false }
  )
  MOCK_INTERACTION_DISPOSITIONS.set(interactionId, [
    {
      id: `int-disp-${++interactionDispositionSeq}`,
      interaction_id: interactionId,
      disposition_id: 'disp-closer-callback',
      label: 'Callback Scheduled',
      stage: 'closer',
      actor_user_id: '2',
      version: 1,
      created_at: at,
    },
  ])
})()

type MockCallbackRequest = {
  id: string
  interaction_id: string
  outcome_id: string
  status: CallbackRequestItem['status']
  requested_at: string
  decided_by_name: string | null
  decided_at: string | null
}

/** One per Callback Scheduled recorded by anyone but a Super Admin, as the API keeps them. */
const MOCK_CALLBACK_REQUESTS: MockCallbackRequest[] = []
let callbackRequestSeq = 0

const CLOSED_MESSAGES = {
  final: 'this call has its outcome and can no longer be changed',
  waiting: "this callback is waiting for a Super Admin's approval",
  rejected: 'a Super Admin rejected this callback',
} as const

/** Why the call is closed to its closer, from its latest closer outcome; a callback with no request counts as approved. */
function mockStanding(interactionId: string): {
  closed: keyof typeof CLOSED_MESSAGES | null
  callback_status: CallbackRequestItem['status'] | null
} {
  const latest = (MOCK_INTERACTION_DISPOSITIONS.get(interactionId) ?? [])
    .filter((row) => row.stage === 'closer')
    .at(-1)
  if (!latest) return { closed: null, callback_status: null }
  const status = MOCK_CALLBACK_REQUESTS.find((row) => row.outcome_id === latest.id)?.status ?? null
  if (latest.label !== 'Callback Scheduled') return { closed: 'final', callback_status: status }
  const closed = status === 'pending' ? 'waiting' : status === 'rejected' ? 'rejected' : null
  return { closed, callback_status: status }
}

function mockClosedRefusal(interactionId: string) {
  const { closed } = mockStanding(interactionId)
  return closed ? authErrorBody(CLOSED_MESSAGES[closed], 'interaction.locked') : null
}

/** A closer who is not also an admin: the one the lock applies to. */
function closerOnly(user: MockUser): boolean {
  return (
    user.roles.includes('closer') &&
    !user.roles.some((role) => role === 'administrator' || role === 'super_admin')
  )
}

/** The call's closer: who accepted its transfer, or who started it as an Own Sale. */
function acceptedCloser(interactionId: string): MockUser | undefined {
  const ownSaleCloser = MOCK_INTERACTIONS[interactionId]?.own_sale_closer_id
  if (ownSaleCloser) return MOCK_USERS.find((user) => user.id === ownSaleCloser)
  const transfer = [...MOCK_TRANSFERS.values()].find(
    (row) => row.interaction_id === interactionId && row.status === 'accepted'
  )
  return MOCK_USERS.find((user) => user.id === transfer?.closer_user_id)
}

function mockCallbackItem(request: MockCallbackRequest): CallbackRequestItem {
  const lead = leadForInteraction(request.interaction_id)
  const closer = acceptedCloser(request.interaction_id)
  return {
    id: request.id,
    interaction_id: request.interaction_id,
    lead_id: lead.id,
    lead_name: [lead.first_name, lead.last_name].filter(Boolean).join(' ').trim() || lead.phone_no,
    // Mock leads carry no team, so the closer's stands in for the lead's.
    team_name: MOCK_TEAMS.find((team) => team.id === closer?.team_id)?.name ?? DEFAULT_TEAM_NAME,
    closer_name: closer?.name ?? null,
    requested_at: request.requested_at,
    status: request.status,
    decided_by_name: request.decided_by_name,
    decided_at: request.decided_at,
  }
}

/** Accepted calls whose latest closer outcome is Callback Scheduled, oldest first. */
function mockCloserCallbacks(closerId: string | null): CloserCallbackEntry[] {
  const entries: CloserCallbackEntry[] = []
  for (const transfer of MOCK_TRANSFERS.values()) {
    if (transfer.status !== 'accepted' || !transfer.closer_user_id) continue
    if (closerId !== null && transfer.closer_user_id !== closerId) continue
    const latest = (MOCK_INTERACTION_DISPOSITIONS.get(transfer.interaction_id) ?? [])
      .filter((row) => row.stage === 'closer')
      .at(-1)
    if (latest?.label !== 'Callback Scheduled') continue
    const lead = leadForInteraction(transfer.interaction_id)
    const closer = MOCK_USERS.find((user) => user.id === transfer.closer_user_id)
    entries.push({
      interaction_id: transfer.interaction_id,
      transfer_id: transfer.id,
      lead_id: lead.id,
      lead_name: [lead.first_name, lead.last_name].filter(Boolean).join(' ').trim() || lead.phone_no,
      lead_phone: lead.phone_no,
      // Mock leads carry no team, so the closer's stands in for the lead's.
      team_name: MOCK_TEAMS.find((team) => team.id === closer?.team_id)?.name ?? DEFAULT_TEAM_NAME,
      closer_user_id: transfer.closer_user_id,
      closer_name: closer?.name ?? 'Closer',
      scheduled_at: latest.created_at,
      // Waiting and rejected ones stay listed, so the closer sees where they stand.
      callback_status: mockStanding(transfer.interaction_id).callback_status,
    })
  }
  for (const call of Object.values(MOCK_INTERACTIONS)) {
    const starter = call.own_sale_closer_id
    if (!starter || (closerId !== null && starter !== closerId)) continue
    const latest = (MOCK_INTERACTION_DISPOSITIONS.get(call.id) ?? [])
      .filter((row) => row.stage === 'closer')
      .at(-1)
    if (latest?.label !== 'Callback Scheduled') continue
    const lead = leadForInteraction(call.id)
    const closer = MOCK_USERS.find((user) => user.id === starter)
    entries.push({
      interaction_id: call.id,
      // Started on Own Sale: it opens by the call alone.
      transfer_id: null,
      lead_id: lead.id,
      lead_name: [lead.first_name, lead.last_name].filter(Boolean).join(' ').trim() || lead.phone_no,
      lead_phone: lead.phone_no,
      team_name: MOCK_TEAMS.find((team) => team.id === closer?.team_id)?.name ?? DEFAULT_TEAM_NAME,
      closer_user_id: starter,
      closer_name: closer?.name ?? 'Closer',
      scheduled_at: latest.created_at,
      callback_status: mockStanding(call.id).callback_status,
    })
  }
  return entries.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
}

/** Whether the closer has recorded an outcome on the call. */
function closerFinished(interactionId: string): boolean {
  return (MOCK_INTERACTION_DISPOSITIONS.get(interactionId) ?? []).some(
    (row) => row.stage === 'closer'
  )
}

/** Own Sale calls still waiting on their outcome. */
function openOwnSaleCalls(): MockInteraction[] {
  return Object.values(MOCK_INTERACTIONS).filter(
    (call) => call.own_sale_closer_id && !closerFinished(call.id)
  )
}

/** This closer's open Own Sale calls, as their queue lists them. */
function mockOwnSaleRows(closerId: string | null): CloserQueueEntry[] {
  return openOwnSaleCalls()
    .filter((call) => call.own_sale_closer_id === closerId)
    .map((call) => {
      const lead = leadForInteraction(call.id)
      return {
        id: call.id,
        interaction_id: call.id,
        lead_name:
          [lead.first_name, lead.last_name].filter(Boolean).join(' ').trim() || lead.phone_no,
        lead_phone: lead.phone_no,
        fronter_user_id: null,
        queued_at: call.created_at,
        status: 'own_sale' as const,
      }
    })
}

const OWN_SALE_BUSY = {
  waiting: 'this customer is waiting in a transfer to a closer',
  with_you: 'you already have this customer open in your Queue',
  with_another: 'this customer is on a call with another closer',
} as const

/** How the lead is being worked, or null when nothing is in progress on it. */
function mockOwnSaleBusy(leadId: string, closerId: string): keyof typeof OWN_SALE_BUSY | null {
  const calls = new Set(
    Object.values(MOCK_INTERACTIONS)
      .filter((call) => call.lead_id === leadId)
      .map((call) => call.id)
  )
  const transfers = [...MOCK_TRANSFERS.values()].filter((row) => calls.has(row.interaction_id))
  const closers = new Set<string>()
  for (const transfer of transfers) {
    if (transfer.status === 'accepted' && transfer.closer_user_id && !closerFinished(transfer.interaction_id)) {
      closers.add(transfer.closer_user_id)
    }
  }
  for (const call of openOwnSaleCalls()) {
    if (calls.has(call.id) && call.own_sale_closer_id) closers.add(call.own_sale_closer_id)
  }
  if (closers.has(closerId)) return 'with_you'
  if (transfers.some((row) => row.status === 'initiated' || row.status === 'offered')) return 'waiting'
  return closers.size > 0 ? 'with_another' : null
}

/** The Own Sale checks both routes share: the closer, their team, and the number. */
function mockOwnSaleCheck(
  authorization: string | null,
  raw: string,
  location: 'query' | 'body'
):
  | { refused: { status: number; body: ReturnType<typeof authErrorBody> } }
  | { actor: MockUser; teamId: string; phone: string; lead: MockTeamLead | undefined } {
  const actor = mockActor(authorization)
  if (!actor) {
    return {
      refused: {
        status: 401,
        body: authErrorBody('Could not validate credentials', 'auth.not_authenticated'),
      },
    }
  }
  if (!actor.roles.includes('closer')) {
    return {
      refused: {
        status: 403,
        body: authErrorBody('Insufficient role for this operation', 'auth.forbidden'),
      },
    }
  }
  if (!actor.team_id) {
    return {
      refused: {
        status: 422,
        body: authErrorBody('a team membership is required', 'lead.team_required'),
      },
    }
  }
  const phone = mockNormalizePhone(raw)
  if (!phone) {
    return {
      refused: {
        status: 422,
        body: authErrorBody(`not a usable phone number: '${raw}'`, 'lead.invalid_phone', [
          { field: 'phone_no', in: location, message: 'not a usable phone number' },
        ]),
      },
    }
  }
  if (MOCK_SUPPRESSED_PHONES.has(phone)) {
    const detail = 'this phone number is on the company do-not-call list'
    return {
      refused: {
        status: 422,
        body: authErrorBody(detail, 'lead.phone_suppressed', [
          { field: 'phone_no', in: location, message: detail },
        ]),
      },
    }
  }
  const lead = teamLeadFor(actor.team_id, phone)
  const busy = lead ? mockOwnSaleBusy(lead.id, actor.id) : null
  if (busy) {
    return { refused: { status: 409, body: authErrorBody(OWN_SALE_BUSY[busy], 'own_sale.lead_busy') } }
  }
  return { actor, teamId: actor.team_id, phone, lead }
}

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
  counts_as_qualified: boolean
}

const MY_STATS_LABELS = ['Transferred', 'Callback'] as const

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
      // Read off the catalogue, as the API does — My Stats counts Qualified
      // from this rather than matching the label.
      counts_as_qualified: Boolean(
        MOCK_DISPOSITION_CATALOG.find(
          (row) => row.label === labels[index % labels.length] && row.stage === stage
        )?.counts_as_qualified
      ),
    }
  })

  // Fronter: half of qualified calls transferred. Closer: every disposition was answered.
  const transferred_interaction_ids =
    stage === 'closer'
      ? dispositions.map((row) => row.interaction_id)
      : dispositions
          .filter((row) => row.label === 'Transferred')
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
    lead_name: QUEUE_LEAD_NAMES[1],
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
    lead_name: '',
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
    lead_name: QUEUE_LEAD_NAMES[3],
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
    lead_name: QUEUE_LEAD_NAMES[4],
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
    lead_name: QUEUE_LEAD_NAMES[(index + 5) % QUEUE_LEAD_NAMES.length],
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
    phone_no: `+1323555${String(4000 + index).slice(-4)}`,
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
    {
      id: 'int-exc-1',
      first_name: 'Alex',
      last_name: 'Rivera',
      phone_no: '+13235550142',
      vehicle_year: 2016,
      vehicle_make: 'Honda',
      vehicle_model: 'Accord',
      dnc: false,
    },
    {
      id: 'int-exc-2',
      first_name: 'Sam',
      last_name: 'Nguyen',
      phone_no: '+14085550199',
      vehicle_year: 2019,
      vehicle_make: 'Ford',
      vehicle_model: 'F-150',
      dnc: false,
    },
    {
      id: 'int-exc-3',
      first_name: 'Casey',
      last_name: 'Brooks',
      phone_no: '+13105550188',
      vehicle_year: 2013,
      vehicle_make: 'Toyota',
      vehicle_model: 'Camry',
      dnc: true,
    },
  ]

  for (const seed of seeds) {
    const captured = HOURS_AGO(7)
    const lead = leadForInteraction(seed.id)
    lead.first_name = seed.first_name
    lead.last_name = seed.last_name
    lead.phone_no = seed.phone_no
    lead.vehicle_year = seed.vehicle_year
    lead.vehicle_make = seed.vehicle_make
    lead.vehicle_model = seed.vehicle_model
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
        override: { applied: false, reason: '' },
        vehicle_year: String(seed.vehicle_year),
        vehicle_make: seed.vehicle_make,
        vehicle_model: seed.vehicle_model,
      },
      consent_dnc: {
        consent_given: !seed.dnc,
        consent_captured_at: seed.dnc ? null : captured,
        dnc_flagged: seed.dnc,
        dnc_source: seed.dnc ? 'agent' : null,
      },
      created_at: captured,
      customer: customerFromLead(lead),
    })
  }
})()

/** Who may reach the QA routes at all; each route narrows it further. */
const QA_ROLES: readonly Role[] = ['super_admin', 'qa_manager', 'qa_agent']
/** Who sees the counts and the agents, and hands sales out. */
const QA_OVERSEERS: readonly Role[] = ['super_admin', 'qa_manager']
/** Who moves a review: the agent closes or disputes it, a Super Admin resolves a dispute. */
const QA_MOVERS: readonly Role[] = ['super_admin', 'qa_agent']

/** Where each status may move next, as the API's flow allows. Closed and Resolve Dispute are final. */
const MOCK_QA_MOVES: Record<QaStatus, QaStatus[]> = {
  open: ['disputed', 'closed'],
  disputed: ['resolve_dispute'],
  resolve_dispute: [],
  closed: [],
}

/** The reviewer and when, which the API keeps on the item for the stats. */
type MockQaItem = Omit<QaItem, 'team_name' | 'assignee_name'> & {
  reviewed_by: string | null
  reviewed_at: string | null
}

/**
 * Five sold calls per team, one every twelve hours. Each lead id is one
 * mockLeadHistory reads as sold, so a sale opens onto its lead and cart. Aria
 * starts with two of Default Team's, one already disputed, and has closed one of
 * East Coast's, so every desk and the stats have something to show.
 */
const MOCK_QA_ITEMS: MockQaItem[] = MOCK_TEAMS.flatMap((team, t) =>
  Array.from({ length: 5 }, (_, i): MockQaItem => {
    const nth = t * 5 + i + 1
    const addedAt = Date.parse('2026-10-19T14:00:00Z') + (nth - 1) * 12 * 3_600_000
    const leadId = `mock-lead-sold-${nth}-${addedAt}-${team.id}`
    return {
      interaction_id: `${leadId}-call-1`,
      lead_id: leadId,
      lead_name: mockLeadName(nth),
      team_id: team.id,
      closer_name: 'Carl Closer',
      closer_outcome: 'Sale',
      closer_outcome_at: new Date(addedAt + 35 * 60_000).toISOString(),
      status: 'open',
      assignee_user_id: null,
      score: null,
      reviewed_by: null,
      reviewed_at: null,
    }
  })
)
// Reviewed this morning, so Today's stats have figures.
const REVIEWED_AT = new Date(Date.now() - 2 * 3_600_000).toISOString()
MOCK_QA_ITEMS[0].assignee_user_id = '10'
Object.assign(MOCK_QA_ITEMS[1], {
  assignee_user_id: '10',
  status: 'disputed',
  score: 55,
  reviewed_by: '10',
  reviewed_at: REVIEWED_AT,
})
Object.assign(MOCK_QA_ITEMS[7], {
  assignee_user_id: '10',
  status: 'closed',
  score: 92,
  reviewed_by: '10',
  reviewed_at: REVIEWED_AT,
})

/** Each sale's review, oldest first, as the API reads it back from the audit trail. */
const MOCK_QA_HISTORY = new Map<string, QaHistoryEvent[]>()

function recordQa(interactionId: string, event: QaHistoryEvent) {
  MOCK_QA_HISTORY.set(interactionId, [...(MOCK_QA_HISTORY.get(interactionId) ?? []), event])
}

function afterSale(item: MockQaItem, minutes: number) {
  return new Date(Date.parse(item.closer_outcome_at) + minutes * 60_000).toISOString()
}

for (const item of [MOCK_QA_ITEMS[0], MOCK_QA_ITEMS[1], MOCK_QA_ITEMS[7]]) {
  recordQa(item.interaction_id, {
    kind: 'assigned',
    at: afterSale(item, 60),
    actor_name: 'Quinn QA',
    assignee_name: 'Aria Agent',
  })
}
recordQa(MOCK_QA_ITEMS[1].interaction_id, {
  kind: 'status_changed',
  at: REVIEWED_AT,
  actor_name: 'Aria Agent',
  previous_status: 'open',
  status: 'disputed',
  note: 'The monthly payment was never read back to the customer.',
  score: 55,
})
recordQa(MOCK_QA_ITEMS[7].interaction_id, {
  kind: 'status_changed',
  at: REVIEWED_AT,
  actor_name: 'Aria Agent',
  previous_status: 'open',
  status: 'closed',
  note: null,
  score: 92,
})

function qaItemBody({ reviewed_by: _by, reviewed_at: _at, ...item }: MockQaItem): QaItem {
  return {
    ...item,
    team_name: MOCK_TEAMS.find((team) => team.id === item.team_id)?.name ?? '',
    assignee_name: MOCK_USERS.find((user) => user.id === item.assignee_user_id)?.name ?? null,
  }
}

type MockRefusal = { status: number; body: ReturnType<typeof authErrorBody> }

/** The signed-in user if they hold one of these roles, or why not. */
function qaActor(authorization: string | null, allowed: readonly Role[]): MockUser | MockRefusal {
  const user = mockActor(authorization)
  if (!user || !user.active) {
    return { status: 401, body: authErrorBody('Could not validate credentials', 'auth.not_authenticated') }
  }
  if (!user.roles.some((role) => allowed.includes(role))) {
    return { status: 403, body: authErrorBody('Insufficient role for this operation', 'auth.forbidden') }
  }
  return user
}

const isRefusal = (value: MockUser | MockRefusal): value is MockRefusal =>
  'status' in value && 'body' in value

function mockReviewsOwnOnly(user: MockUser): boolean {
  return !user.roles.some((role) => role === 'super_admin' || role === 'qa_manager')
}

/** The sale, if this user may see it: an agent only their own, and only while open. */
function mockQaItemFor(user: MockUser, interactionId: string): MockQaItem | null {
  const item = MOCK_QA_ITEMS.find((row) => row.interaction_id === interactionId)
  if (!item) return null
  if (mockReviewsOwnOnly(user) && (item.assignee_user_id !== user.id || item.status !== 'open')) {
    return null
  }
  return item
}

function qaInvalid(field: string, message: string) {
  return authErrorBody(message, 'validation_error', [{ field, in: 'body', message }])
}

const QA_ITEM_NOT_FOUND = authErrorBody('no such sale to review', 'interaction.not_found')

/**
 * Policy numbers POL-10001 to POL-10030, each sold once on one of the mock teams
 * in turn. Each lead id is one mockLeadHistory reads as sold, so a Super Admin
 * can open it.
 */
const MOCK_POLICY_SALES = Array.from({ length: 30 }, (_, i) => {
  const team = MOCK_TEAMS[i % MOCK_TEAMS.length]
  const nth = 100 + i
  const addedAt = Date.parse('2026-10-01T14:00:00Z') + i * 86_400_000
  const leadId = `mock-lead-sold-${nth}-${addedAt}-${team.id}`
  return {
    policy_number: `POL-${10_001 + i}`,
    lead_id: leadId,
    interaction_id: `${leadId}-call-1`,
    lead_name: mockLeadName(nth),
    lead_phone: mockLeadPhone(nth),
    team_id: team.id,
    team_name: team.name,
    closer_name: 'Carl Closer',
    sold_at: new Date(addedAt + 35 * 60_000).toISOString(),
    total_payment: (1800 + (i % 7) * 300).toFixed(2),
    down_payment: '200.00',
    monthly_payment: '75.00',
  }
})

function policyFileProblem(message: string) {
  return authErrorBody(message, 'validation_error', [{ field: 'file', in: 'body', message }])
}

/** Paid uploads made in mock mode, oldest first: the order decides a sale's paid month. */
const mockPaidUploads: { upload: PaidUpload; sales: string[] }[] = []

/** The month of the earliest upload still standing that matched the sale, as the API reads it. */
function mockPaidMonth(interactionId: string): string | null {
  const first = mockPaidUploads.find(
    ({ upload, sales }) => !upload.undone_at && sales.includes(interactionId)
  )
  return first?.upload.month ?? null
}

/**
 * A policy list read the way the API reads it, and the mock sales behind it.
 * `teams` limits it to a Team Admin's own, who never sees the amounts.
 */
async function mockPolicyLookup(
  file: File | undefined,
  teams: (string | null)[] | null
): Promise<{ problem: string } | { lookup: PolicyLookup }> {
  if (!(file instanceof File) || file.size === 0) return { problem: 'That file is empty.' }
  if (file.size > 1_048_576) return { problem: 'Up to 1 MB.' }
  const head = new Uint8Array(await file.slice(0, 2).arrayBuffer())
  // An Excel workbook is a zip, which the mock does not unpack: it answers a sample.
  const cells =
    head[0] === 0x50 && head[1] === 0x4b
      ? ['Policy number', 'POL-10001', 'POL-10004', 'POL-99999']
      : (await file.text())
          .replace(/^\uFEFF/, '')
          .split(/\r?\n/)
          .map((line) => (line.split(',')[0] ?? '').trim())

  const lookup: PolicyLookup = {
    matches: [],
    unmatched: [],
    skipped: [],
    summary: { rows: 0, matched: 0, unmatched: 0, skipped: 0 },
  }
  const firstRowOf = new Map<string, number>()
  let read = 0
  cells.forEach((value, index) => {
    const row = index + 1
    if (!value || (row === 1 && value.toLowerCase().includes('policy'))) return
    read += 1
    if (value.length > 64) {
      lookup.skipped.push({ row, value, reason: 'too_long', first_row: null })
      return
    }
    const key = value.toLowerCase()
    const first = firstRowOf.get(key)
    if (first !== undefined) {
      lookup.skipped.push({ row, value, reason: 'duplicate', first_row: first })
      return
    }
    firstRowOf.set(key, row)
    const found = MOCK_POLICY_SALES.filter(
      (sale) =>
        sale.policy_number.toLowerCase() === key && (!teams || teams.includes(sale.team_id))
    )
    if (found.length === 0) lookup.unmatched.push({ row, policy_number: value })
    const hidden = teams ? { total_payment: null, down_payment: null, monthly_payment: null } : {}
    for (const sale of found) {
      lookup.matches.push({
        ...sale,
        ...hidden,
        row,
        policy_number: value,
        paid_month: mockPaidMonth(sale.interaction_id),
        policy_status: mockCurrentStatus(sale.interaction_id)?.status ?? null,
      })
    }
  })
  if (read === 0) return { problem: 'That file has no policy numbers in it.' }
  if (read > 5000) return { problem: 'Up to 5,000 policy numbers at a time.' }
  lookup.summary = {
    rows: read,
    matched: read - lookup.unmatched.length - lookup.skipped.length,
    unmatched: lookup.unmatched.length,
    skipped: lookup.skipped.length,
  }
  return { lookup }
}

type PolicyStatus = RetentionStatusEvent['status']

/** Every status change made in mock mode, oldest first; the newest per sale is its status. */
const mockStatusChanges: (RetentionStatusEvent & { sale: string })[] = []

function recordStatus(
  sale: string,
  number: string,
  status: PolicyStatus,
  actorName: string,
  { note = null, fileName = null, at = new Date().toISOString() }: { note?: string | null; fileName?: string | null; at?: string } = {}
) {
  mockStatusChanges.push({
    sale,
    policy_number: number,
    status,
    note,
    file_name: fileName,
    actor_name: actorName,
    at,
  })
}

/** The one sale with this policy number, in any case, as the API finds it. */
function saleWithNumber(number: string): MockPolicySale | undefined {
  const key = number.trim().toLowerCase()
  return MOCK_POLICY_SALES.find((sale) => sale.policy_number.toLowerCase() === key)
}

// Something to work in mock mode: two policies being worked and one lost.
for (const [number, status, extra] of [
  ['POL-10002', 'pending', { note: 'Wants to cancel. Call back Friday.', at: '2026-11-02T15:00:00Z' }],
  ['POL-10003', 'pending', { at: '2026-11-03T16:30:00Z' }],
  ['POL-10005', 'cancelled', { fileName: 'carrier-october.csv', at: '2026-11-01T12:00:00Z' }],
] as const) {
  recordStatus(saleWithNumber(number)!.interaction_id, number, status, 'Rita Retention', extra)
}

function mockCurrentStatus(sale: string): (RetentionStatusEvent & { sale: string }) | null {
  for (let i = mockStatusChanges.length - 1; i >= 0; i--) {
    if (mockStatusChanges[i].sale === sale) return mockStatusChanges[i]
  }
  return null
}

function asEvent({ sale: _sale, ...change }: RetentionStatusEvent & { sale: string }): RetentionStatusEvent {
  return change
}

type MockPolicySale = (typeof MOCK_POLICY_SALES)[number]

function retentionSale(sale: MockPolicySale): RetentionSale {
  const current = mockCurrentStatus(sale.interaction_id)
  return {
    interaction_id: sale.interaction_id,
    policy_number: sale.policy_number,
    lead_name: sale.lead_name,
    team_name: sale.team_name,
    sold_at: sale.sold_at,
    status: current?.status ?? null,
    status_at: current?.at ?? null,
    status_by: current?.actor_name ?? null,
  }
}

function retentionDetail(sale: MockPolicySale): RetentionSaleDetail {
  const qa = MOCK_QA_ITEMS.find((item) => item.interaction_id === sale.interaction_id)
  return {
    ...retentionSale(sale),
    lead_phone: sale.lead_phone,
    vehicle_year: 2019,
    vehicle_make: 'Honda',
    vehicle_model: 'Civic',
    closer_name: sale.closer_name,
    history: mockStatusChanges
      .filter((change) => change.sale === sale.interaction_id)
      .reverse()
      .map(asEvent),
    qa: {
      status: qa?.status ?? 'open',
      score: qa?.score ?? null,
      history: MOCK_QA_HISTORY.get(sale.interaction_id) ?? [],
    },
  }
}

function retentionRefusal(authorization: string | null) {
  const user = MOCK_TOKENS.get((authorization || '').replace(/^Bearer\s+/i, ''))
  if (!user || !user.active) {
    return {
      status: 401,
      body: authErrorBody('Could not validate credentials', 'auth.not_authenticated'),
    }
  }
  if (!user.roles.includes('super_admin') && !user.roles.includes('retention')) {
    return {
      status: 403,
      body: authErrorBody('Insufficient role for this operation', 'auth.forbidden'),
    }
  }
  return null
}

const MOCK_STATUS_WORDS: Record<string, PolicyStatus> = {
  cancelled: 'cancelled',
  canceled: 'cancelled',
  retained: 'retained',
  retention: 'retained',
  pending: 'pending',
}

/** A status file read the way the API reads it, by its headings. Saves nothing. */
async function mockStatusCheck(
  file: File | undefined
): Promise<{ problem: string } | { check: RetentionUploadCheck }> {
  if (!(file instanceof File) || file.size === 0) return { problem: 'That file is empty.' }
  if (file.size > 1_048_576) return { problem: 'Up to 1 MB.' }
  const head = new Uint8Array(await file.slice(0, 2).arrayBuffer())
  // An Excel workbook is a zip, which the mock does not unpack: it answers a sample.
  const lines =
    head[0] === 0x50 && head[1] === 0x4b
      ? ['Policy number,Status', 'POL-10001,Pending', 'POL-10002,Retained', 'POL-99999,Cancelled']
      : (await file.text()).replace(/^\uFEFF/, '').split(/\r?\n/)
  const rows = lines.map((line) => line.split(',').map((cell) => cell.trim()))
  const headings = (rows[0] ?? []).map((cell) => cell.toLowerCase())
  const statusCol = headings.findIndex((cell) => cell.includes('status'))
  const numberCol = headings.findIndex((cell, i) => cell.includes('policy') && i !== statusCol)
  if (statusCol < 0 || numberCol < 0) {
    return { problem: 'The first row needs Policy number and Status columns. Download the template.' }
  }

  const check: RetentionUploadCheck = {
    changes: [],
    unchanged: [],
    unmatched: [],
    invalid: [],
    skipped: [],
    summary: { rows: 0, changes: 0, unchanged: 0, unmatched: 0, invalid: 0, skipped: 0 },
  }
  const firstRowOf = new Map<string, number>()
  let read = 0
  rows.slice(1).forEach((cells, index) => {
    const row = index + 2
    const value = cells[numberCol] ?? ''
    if (!value) return
    read += 1
    if (value.length > 64) {
      check.skipped.push({ row, value, reason: 'too_long', first_row: null })
      return
    }
    const key = value.toLowerCase()
    const first = firstRowOf.get(key)
    if (first !== undefined) {
      check.skipped.push({ row, value, reason: 'duplicate', first_row: first })
      return
    }
    firstRowOf.set(key, row)
    const written = cells[statusCol] ?? ''
    const status = MOCK_STATUS_WORDS[written.toLowerCase().replace(/\s+/g, '')]
    if (!status) {
      check.invalid.push({ row, policy_number: value, status: written })
      return
    }
    const sale = saleWithNumber(value)
    if (!sale) {
      check.unmatched.push({ row, policy_number: value })
      return
    }
    const current = mockCurrentStatus(sale.interaction_id)?.status ?? null
    const found = {
      row,
      policy_number: value,
      interaction_id: sale.interaction_id,
      status,
      current_status: current,
    }
    ;(current === status ? check.unchanged : check.changes).push(found)
  })
  if (read === 0) return { problem: 'That file has no policy numbers in it.' }
  if (read > 5000) return { problem: 'Up to 5,000 policy numbers at a time.' }
  check.summary = {
    rows: read,
    changes: check.changes.length,
    unchanged: check.unchanged.length,
    unmatched: check.unmatched.length,
    invalid: check.invalid.length,
    skipped: check.skipped.length,
  }
  return { check }
}

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

  rest.patch('/auth/me', async (req, res, ctx) => {
    const user = mockActor(req.headers.get('authorization'))
    if (!user || !user.active) {
      return res(
        ctx.status(401),
        ctx.json(authErrorBody('Could not validate credentials', 'auth.not_authenticated'))
      )
    }
    const body = (await req.json()) as { timezone?: string }
    const zone = TIME_ZONES.find((option) => option.value === body.timezone)?.value
    if (!zone) {
      return res(
        ctx.status(422),
        ctx.json(
          authErrorBody('not a time zone this CRM offers', 'validation_error', [
            { field: 'timezone', in: 'body', message: 'not a time zone this CRM offers' },
          ])
        )
      )
    }
    user.timezone = zone
    return res(ctx.status(200), ctx.json(userBody(user)))
  }),

  rest.post('/auth/password/change', async (req, res, ctx) => {
    const user = mockActor(req.headers.get('authorization'))
    if (!user || !user.active) {
      return res(
        ctx.status(401),
        ctx.json(authErrorBody('Could not validate credentials', 'auth.not_authenticated'))
      )
    }
    const body = (await req.json()) as { current_password?: string; new_password?: string }
    if (!body.new_password || body.new_password.length < 8) {
      return res(
        ctx.status(422),
        ctx.json(
          authErrorBody('String should have at least 8 characters', 'validation_error', [
            { field: 'new_password', in: 'body', message: 'String should have at least 8 characters' },
          ])
        )
      )
    }
    if (body.current_password !== user.password) {
      return res(
        ctx.status(422),
        ctx.json(
          authErrorBody('current password is incorrect', 'user.password_incorrect', [
            { field: 'current_password', in: 'body', message: 'incorrect' },
          ])
        )
      )
    }
    user.password = body.new_password
    endMockSessions(user)
    return res(ctx.status(200), ctx.json(issueMockTokens(user)))
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

  rest.get('/teams', (req, res, ctx) => {
    const refused = superAdminRefusal(req.headers.get('authorization'))
    if (refused) return res(ctx.status(refused.status), ctx.json(refused.body))
    const items = [...MOCK_TEAMS].sort((a, b) => a.name.localeCompare(b.name))
    return res(ctx.status(200), ctx.json({ items }))
  }),

  rest.post('/teams', async (req, res, ctx) => {
    const refused = superAdminRefusal(req.headers.get('authorization'))
    if (refused) return res(ctx.status(refused.status), ctx.json(refused.body))

    const body = (await req.json()) as { name?: string; active?: boolean }
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) {
      return res(
        ctx.status(422),
        ctx.json(
          authErrorBody('validation failed', 'validation_error', [
            { field: 'name', in: 'body', message: 'required' },
          ])
        )
      )
    }
    if (MOCK_TEAMS.some((team) => team.name === name)) {
      return res(
        ctx.status(409),
        ctx.json(
          authErrorBody(`team already exists: ${name}`, 'team.already_exists', [
            { field: 'name', in: 'body', message: 'already in use' },
          ])
        )
      )
    }

    const now = new Date().toISOString()
    const team: MockTeam = {
      id: crypto.randomUUID(),
      name,
      active: body.active !== false,
      created_at: now,
      updated_at: now,
    }
    MOCK_TEAMS.push(team)
    return res(ctx.status(201), ctx.json(team))
  }),

  rest.get('/teams/:team_id', (req, res, ctx) => {
    const refused = superAdminRefusal(req.headers.get('authorization'))
    if (refused) return res(ctx.status(refused.status), ctx.json(refused.body))

    const team = MOCK_TEAMS.find((row) => row.id === req.params.team_id)
    if (!team) {
      return res(ctx.status(404), ctx.json(authErrorBody('team not found', 'team.not_found')))
    }
    return res(ctx.status(200), ctx.json(team))
  }),

  rest.patch('/teams/:team_id', async (req, res, ctx) => {
    const refused = superAdminRefusal(req.headers.get('authorization'))
    if (refused) return res(ctx.status(refused.status), ctx.json(refused.body))

    const team = MOCK_TEAMS.find((row) => row.id === req.params.team_id)
    if (!team) {
      return res(ctx.status(404), ctx.json(authErrorBody('team not found', 'team.not_found')))
    }

    const body = (await req.json()) as { name?: string | null; active?: boolean | null }
    const nextName = typeof body.name === 'string' ? body.name.trim() : null
    const nextActive = typeof body.active === 'boolean' ? body.active : null
    if (nextName === null && nextActive === null) {
      return res(
        ctx.status(422),
        ctx.json(authErrorBody('at least one of name or active must be set', 'validation_error'))
      )
    }

    const renaming = nextName !== null && nextName !== team.name
    const deactivating = nextActive === false && team.active
    if (team.name === DEFAULT_TEAM_NAME && (renaming || deactivating)) {
      return res(
        ctx.status(400),
        ctx.json(
          authErrorBody('Default Team cannot be renamed or deactivated', 'team.default_locked')
        )
      )
    }

    if (renaming) {
      if (MOCK_TEAMS.some((row) => row.id !== team.id && row.name === nextName)) {
        return res(
          ctx.status(409),
          ctx.json(
            authErrorBody(`team already exists: ${nextName}`, 'team.already_exists', [
              { field: 'name', in: 'body', message: 'already in use' },
            ])
          )
        )
      }
      team.name = nextName
    }
    if (nextActive !== null) team.active = nextActive
    team.updated_at = new Date().toISOString()
    return res(ctx.status(200), ctx.json(team))
  }),

  rest.get('/campaigns', (req, res, ctx) => {
    const authorization = req.headers.get('authorization')
    const refused = adminRefusal(authorization)
    if (refused) return res(ctx.status(refused.status), ctx.json(refused.body))

    const actor = MOCK_TOKENS.get((authorization || '').replace(/^Bearer\s+/i, ''))!
    // A Team Admin sees the campaigns their own team works, shared ones included.
    const visible = actor.roles.includes('super_admin')
      ? MOCK_CAMPAIGNS
      : MOCK_CAMPAIGNS.filter(
          (campaign) => actor.team_id !== null && campaign.team_ids.includes(actor.team_id)
        )
    const items = [...visible].sort((a, b) => a.name.localeCompare(b.name))
    return res(ctx.status(200), ctx.json({ items }))
  }),

  rest.post('/campaigns', async (req, res, ctx) => {
    const refused = superAdminRefusal(req.headers.get('authorization'))
    if (refused) return res(ctx.status(refused.status), ctx.json(refused.body))

    const body = (await req.json()) as { name?: string; active?: boolean; team_ids?: string[] }
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) {
      return res(
        ctx.status(422),
        ctx.json(
          authErrorBody('validation failed', 'validation_error', [
            { field: 'name', in: 'body', message: 'required' },
          ])
        )
      )
    }
    if (MOCK_CAMPAIGNS.some((campaign) => campaign.name === name)) {
      return res(ctx.status(409), ctx.json(campaignNameTaken(name)))
    }
    const teamIds = campaignTeamIds(body.team_ids)
    if (teamIds.some(isUnknownTeam)) {
      return res(ctx.status(404), ctx.json(authErrorBody('team not found', 'team.not_found')))
    }

    const now = new Date().toISOString()
    const campaign: MockCampaign = {
      id: nextCampaignId(),
      name,
      match_type: null,
      match_value: null,
      team_ids: teamIds,
      active: body.active !== false,
      created_at: now,
      updated_at: now,
    }
    MOCK_CAMPAIGNS.push(campaign)
    return res(ctx.status(201), ctx.json(campaign))
  }),

  rest.patch('/campaigns/:campaign_id', async (req, res, ctx) => {
    const refused = superAdminRefusal(req.headers.get('authorization'))
    if (refused) return res(ctx.status(refused.status), ctx.json(refused.body))

    const campaign = MOCK_CAMPAIGNS.find((row) => row.id === req.params.campaign_id)
    if (!campaign) {
      return res(
        ctx.status(404),
        ctx.json(authErrorBody('campaign not found', 'campaign.not_found'))
      )
    }

    const body = (await req.json()) as {
      name?: string | null
      active?: boolean | null
      team_ids?: string[] | null
    }
    const nextName = typeof body.name === 'string' ? body.name.trim() : null
    if (body.name === null || nextName === '') {
      return res(
        ctx.status(422),
        ctx.json(
          authErrorBody('validation failed', 'validation_error', [
            { field: 'name', in: 'body', message: 'a campaign must keep a name' },
          ])
        )
      )
    }
    if (
      nextName !== null &&
      MOCK_CAMPAIGNS.some((row) => row.id !== campaign.id && row.name === nextName)
    ) {
      return res(ctx.status(409), ctx.json(campaignNameTaken(nextName)))
    }
    const nextTeams = Array.isArray(body.team_ids) ? campaignTeamIds(body.team_ids) : null
    if (nextTeams?.some(isUnknownTeam)) {
      return res(ctx.status(404), ctx.json(authErrorBody('team not found', 'team.not_found')))
    }

    // Applied only once every check has passed, so a refused edit changes nothing.
    if (nextName !== null) campaign.name = nextName
    if (typeof body.active === 'boolean') campaign.active = body.active
    if (nextTeams) campaign.team_ids = nextTeams
    campaign.updated_at = new Date().toISOString()
    return res(ctx.status(200), ctx.json(campaign))
  }),

  rest.get('/auth/users', (req, res, ctx) => {
    const authorization = req.headers.get('authorization')
    const refused = userAdminRefusal(authorization)
    if (refused) return res(ctx.status(refused.status), ctx.json(refused.body))

    const actor = MOCK_TOKENS.get((authorization || '').replace(/^Bearer\s+/i, ''))!
    const params = req.url.searchParams
    const limit = Number(params.get('limit') ?? 50)
    const offset = Number(params.get('offset') ?? 0)
    const active = params.get('active')
    const role = params.get('role')
    const search = (params.get('search') ?? '').toLowerCase()
    const teamId = params.get('team_id')

    const matching = MOCK_USERS.filter((user) => {
      // Super Admin accounts stay off the Users tab (and any team-scoped list).
      if (user.roles.includes('super_admin')) return false
      if (!isManageableBy(actor, user)) return false
      if (teamId && user.team_id !== teamId) return false
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
    const authorization = req.headers.get('authorization')
    const refused = userAdminRefusal(authorization)
    if (refused) return res(ctx.status(refused.status), ctx.json(refused.body))

    const body = (await req.json()) as {
      email?: string
      name?: string
      password?: string
      roles?: Role[]
      team_id?: string | null
    }

    const invalid = describeUser(body)
    if (invalid) return res(ctx.status(invalid.status), ctx.json(invalid.body))

    const actor = MOCK_TOKENS.get((authorization || '').replace(/^Bearer\s+/i, ''))!
    const roles = body.roles as Role[]

    const knownTeamIds = new Set(MOCK_TEAMS.map((team) => team.id))
    const requestedTeam =
      typeof body.team_id === 'string' && knownTeamIds.has(body.team_id) ? body.team_id : null
    // A Team Admin omits team_id and the API pins their own; Super Admin, QA and
    // Retention accounts cover every team, so get none.
    const qaStaff = roles.some((role) => NO_TEAM_ROLES.includes(role))
    const companyWide = roles.includes('super_admin') || qaStaff
    const teamId = companyWide ? null : (requestedTeam ?? actor.team_id)

    const ceiling = grantCeilingRefusal(actor, roles, teamId)
    if (ceiling) return res(ctx.status(ceiling.status), ctx.json(ceiling.body))

    if (qaStaff && !roles.includes('super_admin') && body.team_id) {
      return res(ctx.status(422), ctx.json(qaManagerHasNoTeam('team_id', NO_TEAM_MESSAGE)))
    }

    if (roles.includes('super_admin') && requestedTeam) {
      return res(
        ctx.status(403),
        ctx.json(
          authErrorBody(
            'super_admin accounts cannot be assigned to a team',
            'team.super_admin_forbidden'
          )
        )
      )
    }
    if (!companyWide && !teamId) {
      return res(
        ctx.status(422),
        ctx.json(
          authErrorBody('a team is required for this role', 'user.team_required', [
            { field: 'team_id', in: 'body', message: 'a team is required for this role' },
          ])
        )
      )
    }
    if (teamId && !knownTeamIds.has(teamId)) {
      return res(ctx.status(404), ctx.json(authErrorBody('team not found', 'team.not_found')))
    }

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
      roles,
      active: true,
      created_at: new Date().toISOString(),
      team_id: teamId,
    }
    MOCK_USERS.push(created)
    if (!body.password) issueMockLink(created.id, 'invite')
    return res(ctx.status(201), ctx.json(userBody(created)))
  }),

  rest.put('/auth/users/:userId/password', async (req, res, ctx) => {
    const authorization = req.headers.get('authorization')
    const refused = superAdminRefusal(authorization)
    if (refused) return res(ctx.status(refused.status), ctx.json(refused.body))

    const user = MOCK_USERS.find((u) => u.id === req.params.userId)
    if (!user) {
      return res(ctx.status(404), ctx.json(authErrorBody('user not found', 'user.not_found')))
    }
    if (mockActor(authorization)?.id === user.id) {
      return res(
        ctx.status(400),
        ctx.json(
          authErrorBody(
            'change your own password with /auth/password/change',
            'user.cannot_reset_own_password'
          )
        )
      )
    }
    const body = (await req.json()) as { password?: string }
    if (!body.password || body.password.length < 8) {
      return res(
        ctx.status(422),
        ctx.json(
          authErrorBody('String should have at least 8 characters', 'validation_error', [
            { field: 'password', in: 'body', message: 'String should have at least 8 characters' },
          ])
        )
      )
    }
    user.password = body.password
    endMockSessions(user)
    return res(ctx.status(204))
  }),

  rest.patch('/auth/users/:userId', async (req, res, ctx) => {
    const authorization = req.headers.get('authorization')
    const refused = userAdminRefusal(authorization)
    if (refused) return res(ctx.status(refused.status), ctx.json(refused.body))

    const actor = MOCK_TOKENS.get((authorization || '').replace(/^Bearer\s+/i, ''))!
    const user = MOCK_USERS.find((u) => u.id === req.params.userId)
    if (!user || !isManageableBy(actor, user)) {
      return res(ctx.status(404), ctx.json(authErrorBody('user not found', 'user.not_found')))
    }

    const body = (await req.json()) as {
      name?: string
      roles?: Role[]
      active?: boolean
      team_id?: string | null
    }

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
      const teamForGrant =
        typeof body.team_id === 'string' ? body.team_id : user.team_id
      const ceiling = grantCeilingRefusal(actor, body.roles, teamForGrant, user)
      if (ceiling) return res(ctx.status(ceiling.status), ctx.json(ceiling.body))
      // These decide whether the account has a team, so are fixed at creation.
      for (const fixed of NO_TEAM_ROLES) {
        if (body.roles.includes(fixed) !== user.roles.includes(fixed)) {
          return res(
            ctx.status(422),
            ctx.json(
              qaManagerHasNoTeam(
                'roles',
                `${fixed} cannot be added to or removed from an existing account`
              )
            )
          )
        }
      }
    }

    // The API refuses to let someone lock themselves out of their elevated role.
    // Super Admin, Team Admin and QA Manager are separate locks — each only protects its own.
    const losingOwnElevated =
      body.roles &&
      ((user.roles.includes('administrator') && !body.roles.includes('administrator')) ||
        (user.roles.includes('qa_manager') && !body.roles.includes('qa_manager')) ||
        (user.roles.includes('super_admin') && !body.roles.includes('super_admin')))
    if (actor.id === user.id && (body.active === false || losingOwnElevated)) {
      return res(
        ctx.status(400),
        ctx.json(
          authErrorBody(
            'cannot deactivate yourself or drop your own admin role',
            'user.cannot_demote_self'
          )
        )
      )
    }

    // Same rules as PUT /auth/users/{id}/team, checked before anything changes.
    if (typeof body.team_id === 'string') {
      if (!actor.roles.includes('super_admin')) {
        return res(
          ctx.status(403),
          ctx.json(authErrorBody("only a Super Admin can change a user's team", 'auth.forbidden'))
        )
      }
      if (user.roles.includes('super_admin') || body.roles?.includes('super_admin')) {
        return res(
          ctx.status(403),
          ctx.json(
            authErrorBody(
              'super_admin accounts cannot be assigned to a team',
              'team.super_admin_forbidden'
            )
          )
        )
      }
      if (user.roles.some((role) => NO_TEAM_ROLES.includes(role))) {
        return res(ctx.status(422), ctx.json(qaManagerHasNoTeam('team_id', NO_TEAM_MESSAGE)))
      }
      if (!MOCK_TEAMS.some((team) => team.id === body.team_id)) {
        return res(ctx.status(404), ctx.json(authErrorBody('team not found', 'team.not_found')))
      }
    }

    if (body.name !== undefined) user.name = body.name
    if (body.roles !== undefined) user.roles = body.roles
    if (body.active !== undefined) user.active = body.active
    if (typeof body.team_id === 'string') user.team_id = body.team_id

    return res(ctx.status(200), ctx.json(userBody(user)))
  }),

  rest.get('/qa/items', (req, res, ctx) => {
    const user = qaActor(req.headers.get('authorization'), QA_ROLES)
    if (isRefusal(user)) return res(ctx.status(user.status), ctx.json(user.body))
    const teamId = req.url.searchParams.get('team_id')

    // A QA Agent only ever gets their own open sales, whatever they ask for.
    const own = mockReviewsOwnOnly(user)
    const status = own ? 'open' : req.url.searchParams.get('status')
    const assignee = own ? user.id : req.url.searchParams.get('assignee')
    const limit = Number(req.url.searchParams.get('limit') ?? 20)
    const offset = Number(req.url.searchParams.get('offset') ?? 0)
    const matched = MOCK_QA_ITEMS.filter(
      (item) =>
        (!teamId || item.team_id === teamId) &&
        (!status || item.status === status) &&
        (!assignee ||
          (assignee === 'none'
            ? item.assignee_user_id === null && item.status === 'open'
            : item.assignee_user_id === assignee))
    ).sort(
      (a, b) =>
        a.closer_outcome_at.localeCompare(b.closer_outcome_at) ||
        a.interaction_id.localeCompare(b.interaction_id)
    )
    return res(
      ctx.status(200),
      ctx.json({
        items: matched.slice(offset, offset + limit).map(qaItemBody),
        total: matched.length,
        limit,
        offset,
      })
    )
  }),

  rest.get('/qa/items/:interactionId', (req, res, ctx) => {
    const user = qaActor(req.headers.get('authorization'), QA_ROLES)
    if (isRefusal(user)) return res(ctx.status(user.status), ctx.json(user.body))
    const item = mockQaItemFor(user, String(req.params.interactionId))
    const lead = item && mockLeadHistory(item.lead_id)
    if (!item || !lead) return res(ctx.status(404), ctx.json(QA_ITEM_NOT_FOUND))
    const history = MOCK_QA_HISTORY.get(item.interaction_id) ?? []
    // QA sees the lead's details and its carts, masked; nothing else from its record.
    return res(
      ctx.status(200),
      ctx.json({ item: qaItemBody(item), history, lead: { lead: lead.lead, carts: lead.carts } })
    )
  }),

  rest.get('/qa/summary', (req, res, ctx) => {
    const user = qaActor(req.headers.get('authorization'), QA_OVERSEERS)
    if (isRefusal(user)) return res(ctx.status(user.status), ctx.json(user.body))

    const teams: QaTeamSummary[] = MOCK_TEAMS.map((team) => {
      const items = MOCK_QA_ITEMS.filter((item) => item.team_id === team.id)
      const counted = (status: QaStatus) => items.filter((item) => item.status === status).length
      return {
        team_id: team.id,
        team_name: team.name,
        open: counted('open'),
        disputed: counted('disputed'),
        resolve_dispute: counted('resolve_dispute'),
        closed: counted('closed'),
        unassigned: items.filter((item) => item.status === 'open' && !item.assignee_user_id).length,
      }
    })
    return res(ctx.status(200), ctx.json({ teams }))
  }),

  rest.get('/qa/agents', (req, res, ctx) => {
    const user = qaActor(req.headers.get('authorization'), QA_OVERSEERS)
    if (isRefusal(user)) return res(ctx.status(user.status), ctx.json(user.body))

    const items: QaAgent[] = MOCK_USERS.filter(
      (agent) => agent.active && agent.roles.includes('qa_agent')
    )
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((agent) => ({ user_id: agent.id, name: agent.name }))
    return res(ctx.status(200), ctx.json({ items }))
  }),

  rest.get('/qa/stats', (req, res, ctx) => {
    const user = qaActor(req.headers.get('authorization'), QA_ROLES)
    if (isRefusal(user)) return res(ctx.status(user.status), ctx.json(user.body))
    const start = req.url.searchParams.get('start') ?? ''
    const end = req.url.searchParams.get('end') ?? ''

    // Days compared as UTC dates: close enough for the mock.
    const inWindow = (at: string | null) => at !== null && at.slice(0, 10) >= start && at.slice(0, 10) <= end
    const figures = (reviewed: MockQaItem[]) => {
      const closed = reviewed.filter((item) => item.status === 'closed').length
      return { reviewed: reviewed.length, closed, disputed: reviewed.length - closed }
    }
    const reviewedBy = (agentId: string) =>
      MOCK_QA_ITEMS.filter(
        (item) => item.reviewed_by === agentId && item.status !== 'open' && inWindow(item.reviewed_at)
      )
    const agents = MOCK_USERS.filter(
      (agent) =>
        agent.active &&
        agent.roles.includes('qa_agent') &&
        (!mockReviewsOwnOnly(user) || agent.id === user.id)
    )
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((agent) => ({ user_id: agent.id, name: agent.name, ...figures(reviewedBy(agent.id)) }))
    return res(
      ctx.status(200),
      ctx.json({ start, end, timezone: user.timezone ?? BUSINESS_TIMEZONE, agents })
    )
  }),

  rest.put('/qa/items/:interactionId/assignee', async (req, res, ctx) => {
    const user = qaActor(req.headers.get('authorization'), QA_OVERSEERS)
    if (isRefusal(user)) return res(ctx.status(user.status), ctx.json(user.body))
    const item = mockQaItemFor(user, String(req.params.interactionId))
    if (!item) return res(ctx.status(404), ctx.json(QA_ITEM_NOT_FOUND))

    const body = (await req.json()) as { assignee_user_id?: string | null }
    const next = body.assignee_user_id ?? null
    if (item.status !== 'open') {
      return res(
        ctx.status(422),
        ctx.json(qaInvalid('assignee_user_id', 'only an open sale can be assigned'))
      )
    }
    if (next) {
      const agent = MOCK_USERS.find((row) => row.id === next)
      if (!agent || !agent.active || !agent.roles.includes('qa_agent')) {
        return res(ctx.status(422), ctx.json(qaInvalid('assignee_user_id', 'not an active QA Agent')))
      }
    }
    if (item.assignee_user_id !== next) {
      item.assignee_user_id = next
      recordQa(item.interaction_id, {
        kind: 'assigned',
        at: new Date().toISOString(),
        actor_name: user.name,
        assignee_name: MOCK_USERS.find((row) => row.id === next)?.name ?? null,
      })
    }
    return res(ctx.status(200), ctx.json(qaItemBody(item)))
  }),

  rest.put('/qa/items/:interactionId/status', async (req, res, ctx) => {
    const user = qaActor(req.headers.get('authorization'), QA_MOVERS)
    if (isRefusal(user)) return res(ctx.status(user.status), ctx.json(user.body))
    const item = mockQaItemFor(user, String(req.params.interactionId))
    if (!item) return res(ctx.status(404), ctx.json(QA_ITEM_NOT_FOUND))

    const body = (await req.json()) as { status?: QaStatus; note?: string | null; score?: number | null }
    if (typeof body.note === 'string' && body.note.length > 2000) {
      return res(ctx.status(422), ctx.json(qaInvalid('note', 'String should have at most 2000 characters')))
    }
    const note = body.note?.trim() || null
    const score = body.score ?? null
    const to = body.status
    if (score !== null && (!Number.isInteger(score) || score < 0 || score > 100)) {
      return res(ctx.status(422), ctx.json(qaInvalid('score', 'a score is a whole number from 0 to 100')))
    }
    if (to === 'closed' && score === null) {
      return res(ctx.status(422), ctx.json(qaInvalid('score', 'a score from 0 to 100 is needed to close')))
    }
    if (to === 'resolve_dispute' && (score !== null || note)) {
      return res(ctx.status(422), ctx.json(qaInvalid('score', 'a dispute is resolved without a score or notes')))
    }
    if (to && to !== item.status) {
      if (!MOCK_QA_MOVES[item.status].includes(to)) {
        return res(ctx.status(422), ctx.json(qaInvalid('status', `cannot move from ${item.status} to ${to}`)))
      }
      const allowed =
        item.status === 'open'
          ? user.roles.includes('qa_agent') && item.assignee_user_id === user.id
          : user.roles.includes('super_admin')
      if (!allowed) {
        const message =
          'only the assigned QA Agent reviews an open sale, and only a Super Admin resolves a dispute'
        return res(ctx.status(403), ctx.json(authErrorBody(message, 'auth.forbidden')))
      }
      recordQa(item.interaction_id, {
        kind: 'status_changed',
        at: new Date().toISOString(),
        actor_name: user.name,
        previous_status: item.status,
        status: to,
        note,
        score,
      })
      if (item.status === 'open') {
        Object.assign(item, { score, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
      }
      item.status = to
    }
    return res(ctx.status(200), ctx.json(qaItemBody(item)))
  }),

  rest.post('/reporting/policy-lookup', async (req, res, ctx) => {
    const authorization = req.headers.get('authorization')
    const refused = adminRefusal(authorization)
    if (refused) return res(ctx.status(refused.status), ctx.json(refused.body))
    const actor = mockActor(authorization)!

    // Deprecated, but req.body is MSW 1.x's only multipart reader.
    const form = req.body as { file?: File }
    const read = await mockPolicyLookup(
      form.file,
      actor.roles.includes('super_admin') ? null : [actor.team_id]
    )
    if ('problem' in read) return res(ctx.status(422), ctx.json(policyFileProblem(read.problem)))
    return res(ctx.status(200), ctx.json(read.lookup))
  }),

  rest.post('/reporting/paid-uploads', async (req, res, ctx) => {
    const authorization = req.headers.get('authorization')
    const refused = superAdminRefusal(authorization)
    if (refused) return res(ctx.status(refused.status), ctx.json(refused.body))
    const actor = mockActor(authorization)!

    const form = req.body as { file?: File; month?: string }
    const month = typeof form.month === 'string' ? form.month : ''
    const monthProblem = !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)
      ? "String should match pattern '^\\d{4}-(0[1-9]|1[0-2])$'"
      : month > new Date().toISOString().slice(0, 7)
        ? 'month must not be after this month'
        : null
    if (monthProblem) {
      return res(
        ctx.status(422),
        ctx.json(
          authErrorBody(monthProblem, 'validation_error', [
            { field: 'month', in: 'body', message: monthProblem },
          ])
        )
      )
    }
    const read = await mockPolicyLookup(form.file, null)
    if ('problem' in read) return res(ctx.status(422), ctx.json(policyFileProblem(read.problem)))

    // A sale made after the month cannot have been paid in it.
    const kept = read.lookup.matches.filter((sale) => sale.sold_at.slice(0, 7) <= month)
    const sales = kept.map((sale) => sale.interaction_id)
    const upload = {
      id: `paid-upload-${mockPaidUploads.length + 1}`,
      month: `${month}-01`,
      file_name: form.file?.name ?? 'upload',
      rows: read.lookup.summary.rows,
      matched: sales.length,
      newly_paid: kept.filter((sale) => sale.paid_month === null).length,
      uploaded_by: actor.name,
      uploaded_at: new Date().toISOString(),
      undone_at: null,
      undone_by: null,
    }
    mockPaidUploads.push({ upload, sales })
    return res(ctx.status(201), ctx.json(upload))
  }),

  rest.get('/reporting/paid-uploads', (req, res, ctx) => {
    const refused = superAdminRefusal(req.headers.get('authorization'))
    if (refused) return res(ctx.status(refused.status), ctx.json(refused.body))
    const items = [...mockPaidUploads].reverse().map((row) => row.upload)
    return res(ctx.status(200), ctx.json({ items }))
  }),

  rest.post('/reporting/paid-uploads/:uploadId/undo', (req, res, ctx) => {
    const authorization = req.headers.get('authorization')
    const refused = superAdminRefusal(authorization)
    if (refused) return res(ctx.status(refused.status), ctx.json(refused.body))
    const found = mockPaidUploads.find((row) => row.upload.id === req.params.uploadId)
    if (!found) {
      return res(ctx.status(404), ctx.json(authErrorBody('paid upload not found', 'not_found')))
    }
    if (!found.upload.undone_at) {
      found.upload = {
        ...found.upload,
        undone_at: new Date().toISOString(),
        undone_by: mockActor(authorization)!.name,
      }
    }
    return res(ctx.status(200), ctx.json(found.upload))
  }),

  rest.get('/retention/pending', (req, res, ctx) => {
    const refused = retentionRefusal(req.headers.get('authorization'))
    if (refused) return res(ctx.status(refused.status), ctx.json(refused.body))
    const limit = Number(req.url.searchParams.get('limit') ?? 20)
    const offset = Number(req.url.searchParams.get('offset') ?? 0)
    const pending = MOCK_POLICY_SALES.map(retentionSale)
      .filter((sale) => sale.status === 'pending')
      .sort((a, b) => (a.status_at ?? '').localeCompare(b.status_at ?? ''))
    return res(
      ctx.status(200),
      ctx.json({ items: pending.slice(offset, offset + limit), total: pending.length, limit, offset })
    )
  }),

  rest.get('/retention/sales', (req, res, ctx) => {
    const refused = retentionRefusal(req.headers.get('authorization'))
    if (refused) return res(ctx.status(refused.status), ctx.json(refused.body))
    const number = req.url.searchParams.get('policy_number') ?? ''
    const sale = saleWithNumber(number)
    return res(ctx.status(200), ctx.json({ items: sale ? [retentionSale(sale)] : [] }))
  }),

  rest.get('/retention/sales/:interactionId', (req, res, ctx) => {
    const refused = retentionRefusal(req.headers.get('authorization'))
    if (refused) return res(ctx.status(refused.status), ctx.json(refused.body))
    const sale = MOCK_POLICY_SALES.find((row) => row.interaction_id === req.params.interactionId)
    if (!sale) {
      return res(
        ctx.status(404),
        ctx.json(authErrorBody('no such sale with a policy number', 'interaction.not_found'))
      )
    }
    return res(ctx.status(200), ctx.json(retentionDetail(sale)))
  }),

  rest.post('/retention/sales/:interactionId/status', async (req, res, ctx) => {
    const authorization = req.headers.get('authorization')
    const refused = retentionRefusal(authorization)
    if (refused) return res(ctx.status(refused.status), ctx.json(refused.body))
    const sale = MOCK_POLICY_SALES.find((row) => row.interaction_id === req.params.interactionId)
    if (!sale) {
      return res(
        ctx.status(404),
        ctx.json(authErrorBody('no such sale with a policy number', 'interaction.not_found'))
      )
    }
    const body = (await req.json()) as { status?: PolicyStatus; note?: string | null }
    const note = (body.note ?? '').trim() || null
    recordStatus(sale.interaction_id, sale.policy_number, body.status ?? 'pending', mockActor(authorization)!.name, { note })
    return res(ctx.status(201), ctx.json(asEvent(mockStatusChanges[mockStatusChanges.length - 1])))
  }),

  rest.post('/retention/uploads/check', async (req, res, ctx) => {
    const refused = retentionRefusal(req.headers.get('authorization'))
    if (refused) return res(ctx.status(refused.status), ctx.json(refused.body))
    // Deprecated, but req.body is MSW 1.x's only multipart reader.
    const read = await mockStatusCheck((req.body as { file?: File }).file)
    if ('problem' in read) return res(ctx.status(422), ctx.json(policyFileProblem(read.problem)))
    return res(ctx.status(200), ctx.json(read.check))
  }),

  rest.post('/retention/uploads', async (req, res, ctx) => {
    const authorization = req.headers.get('authorization')
    const refused = retentionRefusal(authorization)
    if (refused) return res(ctx.status(refused.status), ctx.json(refused.body))
    const file = (req.body as { file?: File }).file
    const read = await mockStatusCheck(file)
    if ('problem' in read) return res(ctx.status(422), ctx.json(policyFileProblem(read.problem)))
    const actor = mockActor(authorization)!.name
    for (const row of read.check.changes) {
      // The cart's own spelling, as a change typed in keeps.
      recordStatus(row.interaction_id, saleWithNumber(row.policy_number)!.policy_number, row.status, actor, {
        fileName: file?.name ?? 'upload',
      })
    }
    return res(ctx.status(201), ctx.json({ saved: read.check.changes.length }))
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

    const scope = mockReportTeam(
      req.headers.get('authorization'),
      req.url.searchParams.get('team_id')
    )
    if ('refused' in scope && scope.refused) {
      return res(ctx.status(scope.refused.status), ctx.json(scope.refused.body))
    }

    return res(
      ctx.status(200),
      ctx.json(
        mockFunnel(
          start,
          end,
          scope.teamId ?? null,
          req.url.searchParams.get('timezone') ??
            mockActor(req.headers.get('authorization'))?.timezone
        )
      )
    )
  }),

  rest.get('/reporting/funnel/:stage', (req, res, ctx) => {
    const refused = adminRefusal(req.headers.get('authorization'))
    if (refused) return res(ctx.status(refused.status), ctx.json(refused.body))

    const start = req.url.searchParams.get('start')
    const end = req.url.searchParams.get('end')
    if (!start || !end) {
      return res(ctx.status(422), ctx.json(authErrorBody('Field required', 'validation_error')))
    }

    const stage = req.params.stage as FunnelStage
    if (!MOCK_STAGE_ORDER.includes(stage)) {
      return res(ctx.status(422), ctx.json(authErrorBody('Input should be a stage', 'validation_error')))
    }
    const scope = mockReportTeam(
      req.headers.get('authorization'),
      req.url.searchParams.get('team_id')
    )
    if ('refused' in scope && scope.refused) {
      return res(ctx.status(scope.refused.status), ctx.json(scope.refused.body))
    }
    const limit = Number(req.url.searchParams.get('limit') ?? 50)
    const offset = Number(req.url.searchParams.get('offset') ?? 0)

    return res(
      ctx.status(200),
      ctx.json(
        mockFunnelStage(
          stage,
          start,
          end,
          scope.teamId ?? null,
          limit,
          offset,
          req.url.searchParams.get('timezone') ??
            mockActor(req.headers.get('authorization'))?.timezone
        )
      )
    )
  }),

  rest.get('/reporting/teams', (req, res, ctx) => {
    const refused = superAdminRefusal(req.headers.get('authorization'))
    if (refused) return res(ctx.status(refused.status), ctx.json(refused.body))

    const start = req.url.searchParams.get('start')
    const end = req.url.searchParams.get('end')
    if (!start || !end) {
      return res(ctx.status(422), ctx.json(authErrorBody('Field required', 'validation_error')))
    }

    return res(
      ctx.status(200),
      ctx.json(
        mockTeamStats(
          start,
          end,
          req.url.searchParams.get('team_id'),
          req.url.searchParams.get('timezone') ??
            mockActor(req.headers.get('authorization'))?.timezone
        )
      )
    )
  }),

  rest.get('/reporting/sales', (req, res, ctx) => {
    const refused = superAdminRefusal(req.headers.get('authorization'))
    if (refused) return res(ctx.status(refused.status), ctx.json(refused.body))

    const params = req.url.searchParams
    const start = params.get('start')
    const end = params.get('end')
    if (!start || !end) {
      return res(ctx.status(422), ctx.json(authErrorBody('Field required', 'validation_error')))
    }

    return res(
      ctx.status(200),
      ctx.json(
        mockSales(
          start,
          end,
          {
            teamId: params.get('team_id'),
            closerId: params.get('closer_id'),
            limit: Number(params.get('limit') ?? 50),
            offset: Number(params.get('offset') ?? 0),
          },
          params.get('timezone') ?? mockActor(req.headers.get('authorization'))?.timezone
        )
      )
    )
  }),

  rest.get('/reporting/agents', (req, res, ctx) => {
    const authorization = req.headers.get('authorization')
    const refused = adminRefusal(authorization)
    if (refused) return res(ctx.status(refused.status), ctx.json(refused.body))

    const actor = mockActor(authorization) as MockUser
    const params = req.url.searchParams
    const stage = mockAgentStage(params)
    if (!stage) {
      const bad = mockFieldRefusal('stage', 'Field required')
      return res(ctx.status(bad.status), ctx.json(bad.body))
    }
    const scope = mockReportTeam(authorization, params.get('team_id'))
    if ('refused' in scope && scope.refused) {
      return res(ctx.status(scope.refused.status), ctx.json(scope.refused.body))
    }
    const teamId = 'teamId' in scope ? scope.teamId : null
    const asked = mockAgentWindow(params, actor)
    if ('refused' in asked) return res(ctx.status(asked.refused.status), ctx.json(asked.refused.body))

    const agentId = params.get('agent_id')
    const agents = MOCK_USERS.filter(
      (user) =>
        user.roles.includes(stage) &&
        (!teamId || user.team_id === teamId) &&
        (!agentId || user.id === agentId)
    )
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((user) => mockAgentRow(user, stage, asked.window))
      .filter((row) => row.active || mockAgentCounted(row))
    const { period, start, end, timezone } = asked.window
    return res(ctx.status(200), ctx.json({ period, start, end, timezone, agents }))
  }),

  rest.get('/reporting/agents/:userId/sales', (req, res, ctx) => {
    const authorization = req.headers.get('authorization')
    const refused = adminRefusal(authorization)
    if (refused) return res(ctx.status(refused.status), ctx.json(refused.body))
    const found = mockScopedAgent(authorization, String(req.params.userId))
    if ('refused' in found) return res(ctx.status(found.refused.status), ctx.json(found.refused.body))

    const params = req.url.searchParams
    const stage = mockAgentStage(params)
    const kind = mockSaleKind(params)
    if (!stage || !kind) {
      const bad = mockFieldRefusal(stage ? 'kind' : 'stage', 'Field required')
      return res(ctx.status(bad.status), ctx.json(bad.body))
    }
    const asked = mockAgentWindow(params, found.actor)
    if ('refused' in asked) return res(ctx.status(asked.refused.status), ctx.json(asked.refused.body))
    if (kind === 'paid' && asked.window.period !== 'month') {
      return res(ctx.status(MOCK_PAID_NEEDS_MONTH.status), ctx.json(MOCK_PAID_NEEDS_MONTH.body))
    }
    const row = mockAgentRow(found.agent, stage, asked.window)
    const amounts = found.actor.roles.includes('super_admin')
    return res(
      ctx.status(200),
      ctx.json(mockAgentSales(row, asked.window, kind, mockAgentPage(params), amounts))
    )
  }),

  rest.get('/reporting/agents/:userId/leads', (req, res, ctx) => {
    const authorization = req.headers.get('authorization')
    const refused = adminRefusal(authorization)
    if (refused) return res(ctx.status(refused.status), ctx.json(refused.body))
    const found = mockScopedAgent(authorization, String(req.params.userId))
    if ('refused' in found) return res(ctx.status(found.refused.status), ctx.json(found.refused.body))

    const params = req.url.searchParams
    const stage = mockAgentStage(params)
    if (!stage) {
      const bad = mockFieldRefusal('stage', 'Field required')
      return res(ctx.status(bad.status), ctx.json(bad.body))
    }
    const asked = mockAgentWindow(params, found.actor)
    if ('refused' in asked) return res(ctx.status(asked.refused.status), ctx.json(asked.refused.body))
    const row = mockAgentRow(found.agent, stage, asked.window)
    return res(ctx.status(200), ctx.json(mockAgentLeads(row, asked.window, mockAgentPage(params))))
  }),

  rest.put('/reporting/agents/:userId/targets', async (req, res, ctx) => {
    const authorization = req.headers.get('authorization')
    const refused = adminRefusal(authorization)
    if (refused) return res(ctx.status(refused.status), ctx.json(refused.body))
    const found = mockScopedAgent(authorization, String(req.params.userId))
    if ('refused' in found) return res(ctx.status(found.refused.status), ctx.json(found.refused.body))

    const body = (await req.json()) as Partial<AgentTargets> & { stage?: string }
    const stage = body.stage === 'fronter' || body.stage === 'closer' ? body.stage : null
    if (!stage || !found.agent.roles.includes(stage)) {
      const bad = mockFieldRefusal('stage', `this user is not a ${body.stage ?? 'agent'}`, 'body')
      return res(ctx.status(bad.status), ctx.json(bad.body))
    }
    const targets: AgentTargets = { daily: null, weekly: null, monthly: null }
    for (const key of ['daily', 'weekly', 'monthly'] as const) {
      const value = body[key] ?? null
      if (value !== null && (!Number.isInteger(value) || value < 1 || value > MOCK_TARGET_MAX)) {
        const bad = mockFieldRefusal(key, `Input should be between 1 and ${MOCK_TARGET_MAX}`, 'body')
        return res(ctx.status(bad.status), ctx.json(bad.body))
      }
      targets[key] = value
    }
    MOCK_AGENT_TARGETS.set(`${found.agent.id}:${stage}`, targets)
    return res(ctx.status(200), ctx.json(targets))
  }),

  rest.get('/me/stats', (req, res, ctx) => {
    const user = mockActor(req.headers.get('authorization'))
    if (!user || !user.active) {
      return res(
        ctx.status(401),
        ctx.json(authErrorBody('Could not validate credentials', 'auth.not_authenticated'))
      )
    }
    const held = user.roles.filter((r): r is 'fronter' | 'closer' => r === 'fronter' || r === 'closer')
    const params = req.url.searchParams
    const askedStage = mockAgentStage(params)
    if (held.length === 0 || (askedStage && !held.includes(askedStage))) {
      return res(
        ctx.status(403),
        ctx.json(authErrorBody('Insufficient role for this operation', 'auth.forbidden'))
      )
    }
    if (!askedStage && held.length === 2) {
      return res(
        ctx.status(422),
        ctx.json(
          authErrorBody(
            'stage is required when the caller holds both fronter and closer',
            'validation.stage_required'
          )
        )
      )
    }
    const asked = mockAgentWindow(params, user)
    if ('refused' in asked) return res(ctx.status(asked.refused.status), ctx.json(asked.refused.body))
    const { period, start, end, timezone } = asked.window
    const agents = [mockAgentRow(user, askedStage ?? held[0], asked.window)]
    return res(ctx.status(200), ctx.json({ period, start, end, timezone, agents }))
  }),

  rest.get('/me/stats/sales', (req, res, ctx) => {
    const user = mockActor(req.headers.get('authorization'))
    if (!user || !user.active) {
      return res(
        ctx.status(401),
        ctx.json(authErrorBody('Could not validate credentials', 'auth.not_authenticated'))
      )
    }
    if (!user.roles.includes('closer')) {
      return res(
        ctx.status(403),
        ctx.json(authErrorBody('Insufficient role for this operation', 'auth.forbidden'))
      )
    }
    const params = req.url.searchParams
    const kind = mockSaleKind(params)
    if (!kind) {
      const bad = mockFieldRefusal('kind', 'Field required')
      return res(ctx.status(bad.status), ctx.json(bad.body))
    }
    const asked = mockAgentWindow(params, user)
    if ('refused' in asked) return res(ctx.status(asked.refused.status), ctx.json(asked.refused.body))
    if (kind === 'paid' && asked.window.period !== 'month') {
      return res(ctx.status(MOCK_PAID_NEEDS_MONTH.status), ctx.json(MOCK_PAID_NEEDS_MONTH.body))
    }
    const row = mockAgentRow(user, 'closer', asked.window)
    return res(
      ctx.status(200),
      ctx.json(mockAgentSales(row, asked.window, kind, mockAgentPage(params), false))
    )
  }),

  rest.get('/interactions', (_req, res, ctx) => {
    return res(ctx.status(200), ctx.json(Object.values(MOCK_INTERACTIONS)))
  }),

  // Open to anyone signed in, as the API's is; Team Admins see their own team.
  rest.get('/leads', (req, res, ctx) => {
    const actor = MOCK_TOKENS.get(
      (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
    )
    if (!actor || !actor.active) {
      return res(
        ctx.status(401),
        ctx.json(authErrorBody('Could not validate credentials', 'auth.not_authenticated'))
      )
    }

    const params = req.url.searchParams
    const limit = Number(params.get('limit') ?? 50)
    const offset = Number(params.get('offset') ?? 0)
    const raw = params.get('phone_no')
    const phone = raw === null ? null : mockNormalizePhone(raw)
    if (raw !== null && phone === null) {
      return res(
        ctx.status(422),
        ctx.json(
          authErrorBody(`not a usable phone number: '${raw}'`, 'lead.invalid_phone', [
            { field: 'phone_no', in: 'query', message: 'not a usable phone number' },
          ])
        )
      )
    }

    const everyTeam = actor.roles.includes('super_admin')
    const rows = MOCK_TEAM_LEADS.filter(
      (lead) =>
        (everyTeam || lead.team_id === actor.team_id) &&
        (phone === null || lead.phone_no === phone)
    )
    return res(
      ctx.status(200),
      ctx.json({
        items: rows.slice(offset, offset + limit).map(leadBody),
        total: rows.length,
        limit,
        offset,
      })
    )
  }),

  rest.post('/leads', async (req, res, ctx) => {
    const authorization = req.headers.get('authorization')
    const refused = leadCreateRefusal(authorization)
    if (refused) return res(ctx.status(refused.status), ctx.json(refused.body))

    const actor = MOCK_TOKENS.get((authorization || '').replace(/^Bearer\s+/i, ''))!
    if (!actor.team_id) {
      return res(
        ctx.status(422),
        ctx.json(
          authErrorBody('a team membership is required', 'lead.team_required', [
            { field: 'body', in: 'body', message: 'a team membership is required' },
          ])
        )
      )
    }

    const body = (await req.json()) as LeadFormBody
    const formErrors = mockValidateLeadForm(body)
    if (formErrors.length > 0) {
      return res(
        ctx.status(422),
        ctx.json(authErrorBody('validation failed', 'validation_error', formErrors))
      )
    }

    const phone = mockNormalizePhone(String(body.phone_no ?? ''))
    if (!phone) {
      return res(
        ctx.status(422),
        ctx.json(
          authErrorBody(`not a usable phone number: '${body.phone_no}'`, 'lead.invalid_phone', [
            { field: 'phone_no', in: 'body', message: 'not a usable phone number' },
          ])
        )
      )
    }

    const existing = teamLeadFor(actor.team_id, phone)
    if (!existing && MOCK_SUPPRESSED_PHONES.has(phone)) {
      const detail = 'this phone number is on the company do-not-call list'
      return res(
        ctx.status(422),
        ctx.json(
          authErrorBody(detail, 'lead.phone_suppressed', [
            { field: 'phone_no', in: 'body', message: detail },
          ])
        )
      )
    }

    const lead = addMockFormLead(actor.team_id, actor.id, { ...body, phone_no: phone })
    return res(ctx.status(201), ctx.json(leadBody(lead)))
  }),

  // Before /leads/:leadId, so own-sale is not read as a lead id.
  rest.get('/leads/own-sale', (req, res, ctx) => {
    const checked = mockOwnSaleCheck(
      req.headers.get('authorization'),
      req.url.searchParams.get('phone_no') ?? '',
      'query'
    )
    if ('refused' in checked) {
      return res(ctx.status(checked.refused.status), ctx.json(checked.refused.body))
    }
    const { phone, lead } = checked
    return res(
      ctx.status(200),
      ctx.json({
        phone_no: phone,
        lead: lead
          ? {
              id: lead.id,
              first_name: lead.first_name ?? null,
              last_name: lead.last_name ?? null,
              vehicle_make: lead.vehicle_make ?? null,
              vehicle_year: lead.vehicle_year ?? null,
              vehicle_model: lead.vehicle_model ?? null,
              vin: lead.vin ?? null,
              license_plate: lead.license_plate ?? null,
              created_at: lead.created_at,
            }
          : null,
      })
    )
  }),

  rest.post('/leads/own-sale', async (req, res, ctx) => {
    const body = (await req.json()) as LeadFormBody
    const checked = mockOwnSaleCheck(
      req.headers.get('authorization'),
      String(body.phone_no ?? ''),
      'body'
    )
    if ('refused' in checked) {
      return res(ctx.status(checked.refused.status), ctx.json(checked.refused.body))
    }
    const formErrors = mockValidateLeadForm(body)
    if (formErrors.length > 0) {
      return res(
        ctx.status(422),
        ctx.json(authErrorBody('validation failed', 'validation_error', formErrors))
      )
    }

    const { actor, teamId, phone } = checked
    const now = new Date().toISOString()
    const fields = {
      first_name: body.first_name!.trim(),
      last_name: body.last_name!.trim(),
      vehicle_make: body.vehicle_make!.trim(),
      vehicle_year: body.vehicle_year!,
      vehicle_model: body.vehicle_model!.trim(),
      vin: body.vin?.trim() || null,
      license_plate: body.license_plate?.trim() || null,
    }
    let lead = checked.lead
    if (lead) {
      Object.assign(lead, fields, { updated_at: now })
    } else {
      issuedLeads += 1
      // No fronter: the closer started it.
      lead = {
        id: `lead-own-sale-${issuedLeads}`,
        phone_no: phone,
        source: 'manual',
        team_id: teamId,
        created_at: now,
        updated_at: now,
        ...fields,
      }
      MOCK_TEAM_LEADS.unshift(lead)
    }
    MOCK_LEADS[lead.id] = leadBody(lead)

    issuedLeads += 1
    const interactionId = `int-own-sale-${issuedLeads}`
    MOCK_INTERACTIONS[interactionId] = {
      id: interactionId,
      lead_id: lead.id,
      created_at: now,
      updated_at: now,
      qualification: null,
      own_sale_closer_id: actor.id,
    }
    qualificationSeq += 1
    const vehicle = [fields.vehicle_year, fields.vehicle_make, fields.vehicle_model].join(' ')
    MOCK_QUALIFICATIONS.set(interactionId, {
      id: `qual-${qualificationSeq}`,
      interaction_id: interactionId,
      version: 1,
      snapshot_json: { ...fields, phone_no: phone, vehicle },
      consent_dnc: {
        consent_given: true,
        consent_captured_at: now,
        dnc_flagged: false,
        dnc_source: null,
      },
      customer: customerFromLead(MOCK_LEADS[lead.id]),
      created_at: now,
    })
    return res(ctx.status(201), ctx.json({ interaction_id: interactionId, lead_id: lead.id }))
  }),

  rest.post('/leads/bulk', async (req, res, ctx) => {
    const authorization = req.headers.get('authorization')
    const refused = adminRefusal(authorization)
    if (refused) return res(ctx.status(refused.status), ctx.json(refused.body))

    const actor = MOCK_TOKENS.get((authorization || '').replace(/^Bearer\s+/i, ''))!
    const teamId = actor.team_id
    if (!teamId) {
      return res(
        ctx.status(422),
        ctx.json(
          authErrorBody('a team is required', 'lead.team_required', [
            { field: 'team_id', in: 'body', message: 'a team is required' },
          ])
        )
      )
    }

    const fileRefusal = (detail: string, code: string) =>
      res(
        ctx.status(422),
        ctx.json(authErrorBody(detail, code, [{ field: 'file', in: 'body', message: detail }]))
      )

    // Deprecated, but req.body is MSW 1.x's only multipart reader: fields, and the upload as a File.
    const form = req.body as { file?: File; campaign_id?: string }
    if (!(form.file instanceof File)) return fileRefusal('the file is empty', 'lead.bulk_empty')
    if (form.file.size > 1_048_576) {
      return fileRefusal('the file is too large', 'lead.bulk_too_large')
    }

    const lines = (await form.file.text()).replace(/^﻿/, '').split(/\r?\n/)
    const header = splitCsvLine(lines[0] ?? '').map((cell) => cell.toLowerCase())
    const phoneAt = header.indexOf('phone')
    const nameAt = header.indexOf('name')
    if (phoneAt < 0) return fileRefusal('no phone column', 'lead.bulk_bad_header')

    // Line numbers as the file has them: the header is line 1.
    const candidates = lines
      .map((line, index) => ({ line, row: index + 1 }))
      .slice(1)
      .filter(({ line }) => line.trim() !== '')
      .map(({ line, row }) => {
        const cells = splitCsvLine(line)
        const raw = cells[phoneAt] ?? ''
        return {
          row,
          raw,
          phone: raw ? mockNormalizePhone(raw) : null,
          name: nameAt >= 0 ? (cells[nameAt] ?? '') : '',
        }
      })
    if (candidates.length === 0) return fileRefusal('the file has no rows', 'lead.bulk_empty')
    if (candidates.length > 1000) return fileRefusal('too many rows', 'lead.bulk_too_large')

    // Like the API, a campaign is needed only when some row would be new.
    let campaignName: string | null = null
    if (candidates.some(({ phone }) => phone && !teamLeadFor(teamId, phone))) {
      const campaign = mockCampaignFor(teamId, form.campaign_id)
      if ('status' in campaign) return res(ctx.status(campaign.status), ctx.json(campaign.body))
      campaignName = campaign.name
    }

    const seen = new Set<string>()
    const rows: LeadBulkRow[] = candidates.map(({ row, raw, phone, name }) => {
      if (!phone) {
        return {
          row,
          phone: raw || null,
          status: 'invalid',
          lead_id: null,
          error: 'not a usable phone number',
        }
      }
      if (seen.has(phone)) {
        return {
          row,
          phone,
          status: 'duplicate_in_file',
          lead_id: null,
          error: 'repeats an earlier row',
        }
      }
      seen.add(phone)
      const existing = teamLeadFor(teamId, phone)
      if (existing) return { row, phone, status: 'existing', lead_id: existing.id, error: null }
      if (MOCK_SUPPRESSED_PHONES.has(phone)) {
        return { row, phone, status: 'suppressed', lead_id: null, error: 'on the do-not-call list' }
      }
      const lead = addMockLead(teamId, phone)
      void name
      void campaignName
      return { row, phone, status: 'created', lead_id: lead.id, error: null }
    })

    const created = rows.filter((row) => row.status === 'created').length
    const existing = rows.filter((row) => row.status === 'existing').length
    return res(
      ctx.status(200),
      ctx.json({
        summary: { created, existing, failed: rows.length - created - existing },
        rows,
      })
    )
  }),

  // Before /leads/:leadId, which would otherwise read "search" as a lead id.
  rest.get('/leads/search', (req, res, ctx) => {
    const worker = mockLeadWorker(req.headers.get('authorization'))
    if ('refused' in worker && worker.refused) {
      return res(ctx.status(worker.refused.status), ctx.json(worker.refused.body))
    }
    const params = req.url.searchParams
    const q = (params.get('q') ?? '').trim()
    const disposition = params.get('disposition')
    const limit = Number(params.get('limit') ?? 20)
    const offset = Number(params.get('offset') ?? 0)
    const digits = q.replace(/\D/g, '')

    const rows = mockWorkableLeads(worker.teamId ?? null)
      .filter((lead) => !mockWithACloser(lead.id))
      .map((lead) => ({
        lead,
        name: [lead.first_name, lead.last_name].filter(Boolean).join(' ').trim() || lead.phone_no,
        latest: mockLatestDisposition(lead.id),
      }))
      .filter(({ lead, name }) => {
        if (!q) return true
        // Names always, and phones too when the search is a number.
        const byName = name.toLowerCase().includes(q.toLowerCase())
        const byPhone = digits !== '' && !/\p{L}/u.test(q) && lead.phone_no.includes(digits)
        return byName || byPhone
      })
      .filter(({ latest }) => {
        if (!disposition) return true
        return disposition === 'none' ? latest === null : latest?.id === disposition
      })
      .sort((a, b) =>
        (a.latest?.at ?? a.lead.created_at).localeCompare(b.latest?.at ?? b.lead.created_at)
      )

    return res(
      ctx.status(200),
      ctx.json({
        items: rows.slice(offset, offset + limit).map(({ lead, name, latest }) => ({
          lead_id: lead.id,
          lead_name: name,
          phone_no: lead.phone_no,
          created_at: lead.created_at,
          latest_disposition: latest?.label ?? null,
          latest_disposition_at: latest?.at ?? null,
        })),
        total: rows.length,
        limit,
        offset,
      })
    )
  }),

  // The API's rule: the latest call while nothing is on it or it waits on a
  // callback, otherwise a new one.
  rest.post('/leads/:leadId/calls', (req, res, ctx) => {
    const worker = mockLeadWorker(req.headers.get('authorization'))
    if ('refused' in worker && worker.refused) {
      return res(ctx.status(worker.refused.status), ctx.json(worker.refused.body))
    }
    const leadId = String(req.params.leadId)
    if (!mockWorkableLeads(worker.teamId ?? null).some((lead) => lead.id === leadId)) {
      return res(ctx.status(404), ctx.json(authErrorBody('lead not found', 'lead.not_found')))
    }

    const latest = mockCallsOf(leadId).at(-1)
    if (latest) {
      const fronter = mockFronterDispositionsOn(latest.id).at(-1)
      const anything =
        (MOCK_INTERACTION_DISPOSITIONS.get(latest.id) ?? []).length > 0 ||
        fronter !== undefined ||
        [...MOCK_TRANSFERS.values()].some((row) => row.interaction_id === latest.id)
      if (fronter?.label === 'Callback' || !anything) {
        return res(ctx.status(200), ctx.json({ interaction_id: latest.id }))
      }
    }

    issuedCalls += 1
    const id = `int-call-${issuedCalls}`
    const now = new Date().toISOString()
    MOCK_INTERACTIONS[id] = { id, lead_id: leadId, created_at: now, updated_at: now, qualification: null }
    return res(ctx.status(200), ctx.json({ interaction_id: id }))
  }),

  rest.get('/leads/:leadId/summary', (req, res, ctx) => {
    const authorization = req.headers.get('authorization')
    const refused = adminRefusal(authorization)
    if (refused) return res(ctx.status(refused.status), ctx.json(refused.body))

    const actor = mockActor(authorization)
    const history = mockLeadHistory(String(req.params.leadId))
    const allowed = actor?.roles.includes('super_admin') || history?.lead.team_id === actor?.team_id
    if (!history || !allowed) {
      return res(ctx.status(404), ctx.json(authErrorBody('lead not found', 'lead.not_found')))
    }

    const sold = [...history.events].reverse().find((event) => event.kind === 'sold')
    const cart = history.carts.find((row) => row.interaction_id === sold?.interaction_id)
    // No amounts and nothing from the payment, as the API sends a Team Admin.
    const sale = sold ? { sold_at: sold.at, policy_number: cart?.policy_number ?? null } : null
    return res(
      ctx.status(200),
      ctx.json({ lead: history.lead, status: history.status, form: history.form, sale })
    )
  }),

  rest.get('/leads/:leadId/history', (req, res, ctx) => {
    const refused = superAdminRefusal(req.headers.get('authorization'))
    if (refused) return res(ctx.status(refused.status), ctx.json(refused.body))

    const history = mockLeadHistory(String(req.params.leadId))
    if (!history) {
      return res(ctx.status(404), ctx.json(authErrorBody('lead not found', 'lead.not_found')))
    }
    return res(ctx.status(200), ctx.json(history))
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

  rest.patch('/leads/:leadId', async (req, res, ctx) => {
    const authorization = req.headers.get('authorization')
    const refused = leadCreateRefusal(authorization)
    if (refused) return res(ctx.status(refused.status), ctx.json(refused.body))

    const leadId = req.params.leadId as string
    const existing =
      MOCK_LEADS[leadId] ?? Object.values(MOCK_LEADS).find((row) => row.id === leadId)
    if (!existing) {
      return res(
        ctx.status(404),
        ctx.json({ detail: 'Lead not found.', code: 'lead.not_found' })
      )
    }

    const body = (await req.json()) as LeadFormBody
    const formErrors = mockValidateLeadForm({ ...body, phone_no: existing.phone_no })
    if (formErrors.length > 0) {
      return res(
        ctx.status(422),
        ctx.json(authErrorBody('validation failed', 'validation_error', formErrors))
      )
    }

    const now = new Date().toISOString()
    const updated: LeadResponse = {
      ...existing,
      first_name: body.first_name!.trim(),
      last_name: body.last_name!.trim(),
      vehicle_make: body.vehicle_make!.trim(),
      vehicle_year: body.vehicle_year!,
      vehicle_model: body.vehicle_model!.trim(),
      vin: body.vin?.trim() || null,
      license_plate: body.license_plate?.trim() || null,
      updated_at: now,
    }
    MOCK_LEADS[updated.id] = updated
    const teamRow = MOCK_TEAM_LEADS.find((row) => row.id === updated.id)
    if (teamRow) Object.assign(teamRow, updated)

    const callback = MOCK_FRONTER_CALLBACKS.find((row) => row.lead_id === updated.id)
    if (callback) {
      const name = [updated.first_name, updated.last_name].filter(Boolean).join(' ').trim()
      callback.lead_name = name || updated.phone_no
      callback.lead_phone = updated.phone_no
    }

    return res(ctx.status(200), ctx.json(updated))
  }),

  rest.get('/queue', (req, res, ctx) => {
    const role = req.url.searchParams.get('role')
    if (role === 'fronter') {
      return res(ctx.status(200), ctx.json(MOCK_FRONTER_CALLBACKS))
    }
    if (role === 'closer') {
      const actor = mockActor(req.headers.get('authorization'))
      return res(
        ctx.status(200),
        ctx.json([...MOCK_CLOSER_QUEUE, ...mockOwnSaleRows(actor?.id ?? null)])
      )
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

  rest.get('/queue/callbacks', (req, res, ctx) => {
    const user = mockActor(req.headers.get('authorization'))
    if (!user) {
      return res(
        ctx.status(401),
        ctx.json(authErrorBody('Could not validate credentials', 'auth.not_authenticated'))
      )
    }
    const superAdmin = user.roles.includes('super_admin')
    if (!superAdmin && !user.roles.includes('closer')) {
      return res(
        ctx.status(403),
        ctx.json(authErrorBody('Insufficient role for this operation', 'auth.forbidden'))
      )
    }
    return res(ctx.status(200), ctx.json(mockCloserCallbacks(superAdmin ? null : user.id)))
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
    // Refresh customer from the lead the way the live GET does.
    const withCustomer: QualificationResponse = {
      ...saved,
      customer: customerFromLead(leadForInteraction(req.params.interactionId as string)),
    }
    return res(ctx.status(200), ctx.json(withCustomer))
  }),

  rest.post('/qualification', async (req, res, ctx) => {
    const body = (await req.json()) as QualificationCreateRequest
    const existing = MOCK_QUALIFICATIONS.get(body.interaction_id)
    const now = new Date().toISOString()
    const snap = body.snapshot_json as Record<string, unknown>
    const lead = leadForInteraction(body.interaction_id)
    // Mirror fronter form fields onto the lead when the snapshot carries them.
    if (typeof snap.vehicle_make === 'string' && snap.vehicle_make) lead.vehicle_make = snap.vehicle_make
    if (typeof snap.vehicle_model === 'string' && snap.vehicle_model) {
      lead.vehicle_model = snap.vehicle_model
    }
    if (snap.vehicle_year != null && String(snap.vehicle_year).trim()) {
      const year = Number(snap.vehicle_year)
      if (Number.isFinite(year)) lead.vehicle_year = year
    }

    const record: QualificationResponse = {
      id: existing?.id ?? `qual-${++qualificationSeq}`,
      interaction_id: body.interaction_id,
      version: (existing?.version ?? 0) + 1,
      snapshot_json: body.snapshot_json as QualificationResponse['snapshot_json'],
      consent_dnc: body.consent_dnc,
      created_at: existing?.created_at ?? now,
      customer: customerFromLead(lead),
    }
    MOCK_QUALIFICATIONS.set(body.interaction_id, record)

    return res(ctx.status(201), ctx.json(record))
  }),

  rest.get('/transfers/closers', (_req, res, ctx) => {
    const pending = [...MOCK_TRANSFERS.values()].filter(
      (row) => row.status === 'initiated' || row.status === 'offered'
    )
    const items: AvailableCloserItem[] = MOCK_AVAILABLE_CLOSERS.map((row) => ({
      ...row,
      waiting: pending.filter((transfer) => transfer.closer_user_id === row.user_id).length,
    }))
    return res(ctx.status(200), ctx.json({ items }))
  }),

  rest.post('/transfers', async (req, res, ctx) => {
    const body = (await req.json()) as TransferCreateRequest
    const now = new Date().toISOString()

    // The same gate create_transfer applies. Without it, mock mode would allow
    // handing "No Answer" to a closer — the exact state this change exists to
    // prevent, and one that would then only surface against the real API.
    const recorded = MOCK_INTERACTION_DISPOSITIONS.get(body.interaction_id) ?? []
    const latest = recorded
      .filter((row) => row.stage === 'fronter')
      .sort((a, b) => b.version - a.version)[0]
    const outcome = latest
      ? MOCK_DISPOSITION_CATALOG.find((row) => row.id === latest.disposition_id)
      : undefined
    if (!outcome?.allows_transfer) {
      return res(
        ctx.status(422),
        ctx.json({
          detail: outcome
            ? `'${outcome.label}' cannot be transferred to a closer`
            : 'record a fronter disposition before transferring',
          code: 'transfer.disposition_not_transferable',
        })
      )
    }

    // A closer must be named, busy or free; an unknown one gets the API's 422.
    const pinnedId = body.closer_user_id
    if (!pinnedId) {
      return res(
        ctx.status(422),
        ctx.json({
          detail: 'Field required',
          code: 'validation_error',
          fields: [{ field: 'closer_user_id', message: 'Field required' }],
        })
      )
    }
    if (!MOCK_AVAILABLE_CLOSERS.some((row) => row.user_id === pinnedId)) {
      return res(
        ctx.status(422),
        ctx.json({
          detail: 'that closer cannot be sent a transfer',
          code: 'transfer.no_closer_available',
        })
      )
    }

    const transfer: TransferResponse = {
      id: `transfer-${++transferSeq}`,
      interaction_id: body.interaction_id,
      status: 'offered',
      fronter_user_id: body.fronter_user_id,
      closer_user_id: pinnedId,
      created_at: now,
      updated_at: now,
    }
    MOCK_TRANSFERS.set(transfer.id, transfer)

    return res(ctx.status(201), ctx.json(transfer))
  }),

  // Closer queue Accept (or workspace open fallback) claims a pending offer.
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

  // As the API: an offer waits in its closer's queue until they accept it.
  rest.post('/transfers/:transferId/reject', (_req, res, ctx) =>
    res(
      ctx.status(403),
      ctx.json({
        detail: 'a transfer cannot be rejected; it waits until the closer accepts it',
        code: 'auth.forbidden',
      })
    )
  ),

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
        ? MOCK_DISPOSITION_CATALOG.filter((d) => d.stage === stage && !d.retired)
        : MOCK_DISPOSITION_CATALOG.filter((d) => !d.retired)
    return res(ctx.status(200), ctx.json({ items }))
  }),

  rest.get('/interactions/:interactionId/dispositions', (req, res, ctx) => {
    const interactionId = req.params.interactionId as string
    const items = MOCK_INTERACTION_DISPOSITIONS.get(interactionId) ?? []
    const standing = mockStanding(interactionId)
    return res(
      ctx.status(200),
      ctx.json({
        items,
        locked: standing.closed !== null,
        callback_status: standing.callback_status,
      })
    )
  }),

  rest.get('/interactions/:interactionId/cart', (req, res, ctx) => {
    const actor = mockActor(req.headers.get('authorization'))
    if (!actor) return res(ctx.status(401), ctx.json({ detail: 'Not authenticated.' }))
    return res(ctx.status(200), ctx.json(MOCK_CARTS.get(req.params.interactionId as string) ?? null))
  }),

  // Super Admin only, as the API's is. A mock lead's cart and a closer's mock cart
  // both reveal made-up numbers that end in the digits already shown.
  rest.post('/interactions/:interactionId/cart/reveal', (req, res, ctx) => {
    const refused = superAdminRefusal(req.headers.get('authorization'))
    if (refused) return res(ctx.status(refused.status), ctx.json(refused.body))

    const interactionId = req.params.interactionId as string
    const saved = MOCK_CARTS.get(interactionId)
    const tails = interactionId.startsWith('mock-lead-')
      ? { account: '1234', routing: '0021' }
      : saved && { account: saved.account_last4, routing: saved.routing_last4 }
    if (!tails) return res(ctx.status(200), ctx.json(null))
    return res(
      ctx.status(200),
      ctx.set('Cache-Control', 'no-store'),
      ctx.json({
        account_number: `411111111111${tails.account}`.slice(-16),
        routing_number: tails.routing ? `02100${tails.routing}` : null,
      })
    )
  }),

  rest.put('/interactions/:interactionId/cart', async (req, res, ctx) => {
    const actor = mockActor(req.headers.get('authorization'))
    if (!actor) return res(ctx.status(401), ctx.json({ detail: 'Not authenticated.' }))
    const body = (await req.json()) as CartSaveRequest
    const interactionId = req.params.interactionId as string
    const closed = mockClosedRefusal(interactionId)
    if (closed) return res(ctx.status(409), ctx.json(closed))
    const before = MOCK_CARTS.get(interactionId)
    const found = checkCart(
      {
        account_number: body.account_number ?? '',
        routing_number: body.routing_number ?? '',
        expiry: body.expiry ?? '',
        cvv: body.cvv ?? '',
        policy_number: body.policy_number ?? '',
        total_payment: String(body.total_payment ?? ''),
        down_payment: String(body.down_payment ?? ''),
        monthly_payment: String(body.monthly_payment ?? ''),
      },
      { saved: Boolean(before) }
    )
    const fields = Object.entries(found)
      .filter(([, message]) => message)
      .map(([field, message]) => ({ field, in: 'body', message: message as string }))
    // A policy number belongs to one sale, so to one cart, in any case.
    const number = (body.policy_number ?? '').trim().toLowerCase()
    const taken =
      number &&
      ([...MOCK_CARTS].some(
        ([id, cart]) => id !== interactionId && cart.policy_number?.toLowerCase() === number
      ) ||
        MOCK_POLICY_SALES.some(
          (sale) => sale.interaction_id !== interactionId && sale.policy_number.toLowerCase() === number
        ))
    if (taken && fields.length === 0) {
      fields.push({
        field: 'policy_number',
        in: 'body',
        message: 'this policy number is already on another sale; check the number',
      })
    }
    if (fields.length > 0) {
      return res(
        ctx.status(422),
        ctx.json({ detail: fields[0].message, code: 'validation_error', fields })
      )
    }
    // A number left out keeps the saved one; a null routing number removes it.
    const routingLast4 =
      'routing_number' in body
        ? body.routing_number
          ? visibleTail(digitsOf(body.routing_number))
          : null
        : (before?.routing_last4 ?? null)
    const cart: CartResponse = {
      interaction_id: interactionId,
      account_last4: body.account_number
        ? visibleTail(digitsOf(body.account_number))
        : (before?.account_last4 ?? ''),
      routing_last4: routingLast4,
      expiry: body.expiry ?? null,
      policy_number: body.policy_number ?? null,
      total_payment: Number(body.total_payment).toFixed(2),
      down_payment: Number(body.down_payment).toFixed(2),
      monthly_payment: Number(body.monthly_payment).toFixed(2),
      saved_by_user_id: actor.id,
      updated_at: new Date().toISOString(),
    }
    MOCK_CARTS.set(interactionId, cart)
    return res(ctx.status(200), ctx.json(cart))
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
    if (catalog.stage === 'closer' && closerOnly(actor)) {
      const closed = mockClosedRefusal(interactionId)
      if (closed) return res(ctx.status(409), ctx.json(closed))
    }
    if (catalog.counts_as_sale && !MOCK_CARTS.has(interactionId)) {
      const message = 'save the cart before recording a sale'
      return res(
        ctx.status(422),
        ctx.json(
          authErrorBody(message, 'validation_error', [
            { field: 'disposition_id', in: 'body', message },
          ])
        )
      )
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
    if (
      catalog.stage === 'closer' &&
      catalog.label === 'Callback Scheduled' &&
      !actor.roles.includes('super_admin')
    ) {
      MOCK_CALLBACK_REQUESTS.push({
        id: `callback-request-${++callbackRequestSeq}`,
        interaction_id: interactionId,
        outcome_id: record.id,
        status: 'pending',
        requested_at: now,
        decided_by_name: null,
        decided_at: null,
      })
    }

    // Callback → fronter callback list (same rule as GET /queue?role=fronter).
    if (catalog.stage === 'fronter' && catalog.label === 'Callback') {
      const already = MOCK_FRONTER_CALLBACKS.some((row) => row.id === interactionId)
      if (!already) {
        const interaction = MOCK_INTERACTIONS[interactionId]
        const lead = interaction
          ? MOCK_LEADS[interaction.lead_id] ??
            MOCK_TEAM_LEADS.find((row) => row.id === interaction.lead_id)
          : undefined
        const phone = lead?.phone_no ?? '+10000000000'
        const name = lead
          ? [lead.first_name, lead.last_name].filter(Boolean).join(' ').trim() || phone
          : phone
        MOCK_FRONTER_CALLBACKS.unshift({
          id: interactionId,
          lead_id: lead?.id ?? `lead-for-${interactionId}`,
          lead_name: name,
          lead_phone: phone,
          disposition_label: catalog.label,
          dispositioned_at: now,
          actor_user_id: actor.id,
        })
      }
    } else if (catalog.stage === 'fronter') {
      const idx = MOCK_FRONTER_CALLBACKS.findIndex((row) => row.id === interactionId)
      if (idx >= 0) MOCK_FRONTER_CALLBACKS.splice(idx, 1)
    } else {
      // An outcome finishes the call, so it leaves the closer queue, as in the API.
      const idx = MOCK_CLOSER_QUEUE.findIndex(
        (row) => row.interaction_id === interactionId && row.status === 'accepted'
      )
      if (idx >= 0) MOCK_CLOSER_QUEUE.splice(idx, 1)
    }

    return res(ctx.status(201), ctx.json(record))
  }),

  // A Super Admin sees every request, a Team Admin their team's.
  rest.get('/callback-requests', (req, res, ctx) => {
    const refused = adminRefusal(req.headers.get('authorization'))
    if (refused) return res(ctx.status(refused.status), ctx.json(refused.body))
    const user = mockActor(req.headers.get('authorization'))!
    const superAdmin = user.roles.includes('super_admin')
    const params = req.url.searchParams
    const status = params.get('status')
    const limit = Number(params.get('limit') ?? 20)
    const offset = Number(params.get('offset') ?? 0)
    const matching = MOCK_CALLBACK_REQUESTS.filter((request) => {
      if (status && request.status !== status) return false
      return superAdmin || acceptedCloser(request.interaction_id)?.team_id === user.team_id
    }).sort((a, b) =>
      status === 'pending'
        ? a.requested_at.localeCompare(b.requested_at)
        : b.requested_at.localeCompare(a.requested_at)
    )
    return res(
      ctx.status(200),
      ctx.json({
        items: matching.slice(offset, offset + limit).map(mockCallbackItem),
        total: matching.length,
        limit,
        offset,
      })
    )
  }),

  rest.post('/callback-requests/:requestId/decision', async (req, res, ctx) => {
    const refused = superAdminRefusal(req.headers.get('authorization'))
    if (refused) return res(ctx.status(refused.status), ctx.json(refused.body))
    const actor = mockActor(req.headers.get('authorization'))!
    const body = (await req.json()) as { status: 'approved' | 'rejected' }
    const request = MOCK_CALLBACK_REQUESTS.find((row) => row.id === req.params.requestId)
    if (!request) {
      return res(ctx.status(404), ctx.json(authErrorBody('callback request not found', 'not_found')))
    }
    if (request.status !== 'pending') {
      const message = 'this request was already decided'
      return res(
        ctx.status(422),
        ctx.json(
          authErrorBody(message, 'validation_error', [{ field: 'status', in: 'body', message }])
        )
      )
    }
    Object.assign(request, {
      status: body.status,
      decided_by_name: actor.name,
      decided_at: new Date().toISOString(),
    })
    return res(ctx.status(200), ctx.json(mockCallbackItem(request)))
  }),

  // The closer's correction of the fronter's details: the lead, and the next version.
  rest.put('/interactions/:interactionId/details', async (req, res, ctx) => {
    const actor = mockActor(req.headers.get('authorization'))
    if (!actor) return res(ctx.status(401), ctx.json({ detail: 'Not authenticated.' }))
    if (!actor.roles.includes('closer')) {
      return res(
        ctx.status(403),
        ctx.json(authErrorBody('Insufficient role for this operation', 'auth.forbidden'))
      )
    }
    const interactionId = req.params.interactionId as string
    const existing = MOCK_QUALIFICATIONS.get(interactionId)
    if (acceptedCloser(interactionId)?.id !== actor.id || !existing) {
      return res(
        ctx.status(404),
        ctx.json(authErrorBody('interaction not found', 'interaction.not_found'))
      )
    }
    const closed = mockClosedRefusal(interactionId)
    if (closed) return res(ctx.status(409), ctx.json(closed))

    const body = (await req.json()) as FronterDetails
    const lead = leadForInteraction(interactionId)
    Object.assign(lead, {
      first_name: body.first_name,
      last_name: body.last_name,
      vehicle_make: body.vehicle_make,
      vehicle_year: body.vehicle_year,
      vehicle_model: body.vehicle_model,
      vin: body.vin ?? null,
      license_plate: body.license_plate ?? null,
      updated_at: new Date().toISOString(),
    })
    // The lead wins, and a field it no longer has is dropped, as in the API.
    const customer = customerFromLead(lead)
    const fields = Object.entries(customer).filter(([key]) => key !== 'lead_id')
    const kept = Object.entries(existing.snapshot_json as Record<string, unknown>).filter(
      ([key]) => !fields.some(([field]) => field === key)
    )
    const record: QualificationResponse = {
      ...existing,
      id: `qual-${++qualificationSeq}`,
      version: existing.version + 1,
      snapshot_json: Object.fromEntries([
        ...kept,
        ...fields.filter(([, value]) => value != null),
      ]) as QualificationResponse['snapshot_json'],
      customer,
      created_at: new Date().toISOString(),
    }
    MOCK_QUALIFICATIONS.set(interactionId, record)
    return res(ctx.status(200), ctx.json(record))
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
    const refused = superAdminRefusal(req.headers.get('authorization'))
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
    const refused = superAdminRefusal(req.headers.get('authorization'))
    if (refused) return res(ctx.status(refused.status), ctx.json(refused.body))

    const interactionId = req.params.interactionId as string
    if (!interactionDetail(interactionId)) {
      return res(ctx.status(404), ctx.json(authErrorBody('no such interaction', 'interaction.not_found')))
    }
    return res(ctx.status(200), ctx.json({ items: MOCK_INTERACTION_TRANSFERS[interactionId] ?? [] }))
  }),

  rest.get('/interactions/:interactionId/events', (req, res, ctx) => {
    const refused = superAdminRefusal(req.headers.get('authorization'))
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
