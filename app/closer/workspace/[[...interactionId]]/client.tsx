'use client'

import { Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { CloserActiveCallScreen } from '@/components/closer/CloserActiveCallScreen'

function Workspace() {
  const params = useParams<{ interactionId?: string[] }>()
  const search = useSearchParams()
  const interactionId =
    params.interactionId?.[0] ?? search.get('id') ?? search.get('interactionId') ?? ''
  const transferId = search.get('transferId') ?? undefined

  return (
    <CloserActiveCallScreen interactionId={interactionId} transferId={transferId} />
  )
}

export function CloserWorkspaceClient() {
  return (
    <Suspense fallback={null}>
      <Workspace />
    </Suspense>
  )
}
