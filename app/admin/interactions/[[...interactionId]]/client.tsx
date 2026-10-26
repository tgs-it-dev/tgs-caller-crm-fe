'use client'

import { Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { InteractionDetailScreen } from '@/components/admin/InteractionDetailScreen'
import { RequireRole } from '@/components/auth/RequireRole'

function Detail() {
  const params = useParams<{ interactionId?: string[] }>()
  const search = useSearchParams()
  const interactionId =
    params.interactionId?.[0] ?? search.get('id') ?? search.get('interactionId') ?? ''
  const from = search.get('from') ?? undefined

  return (
    // A lead's full view is the Super Admin's; a Team Admin is sent back to their desk.
    <RequireRole role="super_admin">
      <InteractionDetailScreen interactionId={interactionId} from={from} />
    </RequireRole>
  )
}

export function AdminInteractionDetailClient() {
  return (
    <Suspense fallback={null}>
      <Detail />
    </Suspense>
  )
}
