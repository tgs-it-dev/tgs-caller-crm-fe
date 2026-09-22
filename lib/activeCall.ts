import {
  listDispositions,
  listInteractionDispositions,
  type DispositionResponse,
  type InteractionDispositionResponse,
} from '@/lib/dispositions'
import { getInteraction, type InteractionDetail } from '@/lib/interactions'
import {
  getLatestQualification,
  type QualificationResponse,
} from '@/lib/qualification'
import { listAvailableClosers, type AvailableCloserItem } from '@/lib/transfers'

export type ActiveCallWorkspaceData = {
  interaction: InteractionDetail
  qualification: QualificationResponse | null
  dispositions: DispositionResponse[]
  capturedDispositions: InteractionDispositionResponse[]
  closers: AvailableCloserItem[]
}

/**
 * One workspace load per interaction while in flight — coalesces React Strict
 * Mode's double-mount so we don't hit the API twice for the same screen.
 */
const inflightByInteraction = new Map<string, Promise<ActiveCallWorkspaceData>>()

export function loadActiveCallWorkspace(
  interactionId: string,
  token: string
): Promise<ActiveCallWorkspaceData> {
  let inflight = inflightByInteraction.get(interactionId)
  if (!inflight) {
    inflight = Promise.all([
      getInteraction(interactionId, token),
      getLatestQualification(interactionId, token),
      listDispositions(token, 'fronter'),
      listInteractionDispositions(interactionId, token),
      listAvailableClosers(token),
    ])
      .then(
        ([interaction, qualification, dispositions, capturedDispositions, closers]) => ({
          interaction,
          qualification,
          dispositions,
          capturedDispositions,
          closers,
        })
      )
      .finally(() => {
        if (inflightByInteraction.get(interactionId) === inflight) {
          inflightByInteraction.delete(interactionId)
        }
      })
    inflightByInteraction.set(interactionId, inflight)
  }
  return inflight
}
