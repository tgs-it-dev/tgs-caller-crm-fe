import { InteractionDetailScreen } from '@/components/admin/InteractionDetailScreen'
import { RequireRole } from '@/components/auth/RequireRole'

/**
 * A shared destination, not a sub-page of whatever linked here.
 *
 * `?from=` names the caller so the back link can say where it goes; the screen
 * itself shows the same thing however it was reached.
 */
export default async function AdminInteractionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ interactionId: string }>
  searchParams: Promise<{ from?: string }>
}) {
  const [{ interactionId }, { from }] = await Promise.all([params, searchParams])

  return (
    <RequireRole role="administrator">
      <InteractionDetailScreen interactionId={interactionId} from={from} />
    </RequireRole>
  )
}
