import type { components } from '@/lib/generated/schema'
import { apiUrl } from '@/lib/apiUrl'
import { authError } from '@/lib/auth'

export type DispositionResponse = components['schemas']['DispositionResponse']
export type DispositionCaptureRequest = components['schemas']['DispositionCaptureRequest']
export type InteractionDispositionResponse =
  components['schemas']['InteractionDispositionResponse']
export type DispositionStage = DispositionResponse['stage']

export async function listDispositions(
  token: string,
  stage: DispositionStage
): Promise<DispositionResponse[]> {
  const res = await fetch(apiUrl(`/dispositions?stage=${stage}`), {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw await authError(res)
  const data = (await res.json()) as components['schemas']['DispositionListResponse']
  return data.items
}

export async function listInteractionDispositions(
  interactionId: string,
  token: string
): Promise<InteractionDispositionResponse[]> {
  const res = await fetch(apiUrl(`/interactions/${interactionId}/dispositions`), {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw await authError(res)
  const data = (await res.json()) as components['schemas']['InteractionDispositionListResponse']
  return data.items
}

export async function captureDisposition(
  interactionId: string,
  payload: DispositionCaptureRequest,
  token: string
): Promise<InteractionDispositionResponse> {
  const res = await fetch(apiUrl(`/interactions/${interactionId}/dispositions`), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw await authError(res)
  return res.json() as Promise<InteractionDispositionResponse>
}

/** Latest capture for one stage, if any. Highest version wins. */
function latestDispositionForStage(
  items: InteractionDispositionResponse[],
  stage: DispositionStage
): InteractionDispositionResponse | null {
  const matched = items.filter((item) => item.stage === stage)
  if (matched.length === 0) return null
  return matched.reduce((best, item) => (item.version > best.version ? item : best))
}

/** Latest fronter-stage capture for an interaction, if any. */
export function latestFronterDisposition(
  items: InteractionDispositionResponse[]
): InteractionDispositionResponse | null {
  return latestDispositionForStage(items, 'fronter')
}

/** Latest closer-stage capture for an interaction, if any. */
export function latestCloserDisposition(
  items: InteractionDispositionResponse[]
): InteractionDispositionResponse | null {
  return latestDispositionForStage(items, 'closer')
}
