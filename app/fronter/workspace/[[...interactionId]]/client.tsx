'use client'

import { Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { ActiveCallScreen } from '@/components/workspace/ActiveCallScreen'

function Workspace() {
  const params = useParams<{ interactionId?: string[] }>()
  const search = useSearchParams()
  const interactionId =
    params.interactionId?.[0] ?? search.get('id') ?? search.get('interactionId') ?? ''

  return <ActiveCallScreen interactionId={interactionId} />
}

export function FronterWorkspaceClient() {
  return (
    <Suspense fallback={null}>
      <Workspace />
    </Suspense>
  )
}
