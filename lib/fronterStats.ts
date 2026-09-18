import type { components } from '@/lib/generated/schema'

type InteractionDisposition = components['schemas']['InteractionDispositionResponse']

/**
 * One row on Fronter My Stats → Today's Disposition.
 *
 * Core fields mirror `InteractionDispositionResponse` from the generated
 * OpenAPI schema. Lead name/phone are display fields until an agent-scoped
 * list endpoint exists — `/reporting/funnel` is admin-only and company-wide
 * (see schema note on that path).
 */
export type TodaysDispositionRow = {
  id: InteractionDisposition['id']
  interaction_id: InteractionDisposition['interaction_id']
  created_at: InteractionDisposition['created_at']
  label: InteractionDisposition['label']
  stage: Extract<InteractionDisposition['stage'], 'fronter'>
  lead_name: string
  lead_phone: string
}

/** Fronter-stage labels aligned with the mock catalogue / qualification set. */
const DISPOSITION_LABELS = [
  'Qualified — ready to transfer',
  'Not interested',
  'Callback requested',
  'Do not call',
  'Invalid / wrong number',
] as const

const LEAD_NAMES = [
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

function formatClock(iso: string) {
  const d = new Date(iso)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

/**
 * Mock today's fronter dispositions (50 rows → 10 pages at 5/page, matching
 * the Figma pagination chrome). Replace with a typed fetch once the BE
 * ships an agent-scoped list.
 */
export function listTodaysDispositions(): TodaysDispositionRow[] {
  const base = new Date()
  base.setHours(9, 0, 0, 0)

  return Array.from({ length: 50 }, (_, index) => {
    const created = new Date(base.getTime() + index * 11 * 60_000)
    return {
      id: `idisp-fronter-${index + 1}`,
      interaction_id: `int-${3000 + index}`,
      created_at: created.toISOString(),
      label: DISPOSITION_LABELS[index % DISPOSITION_LABELS.length],
      stage: 'fronter',
      lead_name: LEAD_NAMES[index % LEAD_NAMES.length],
      lead_phone: `+9212345678${String(index).padStart(2, '0')}`,
    }
  })
}

export function formatDispositionTime(iso: string) {
  return formatClock(iso)
}
