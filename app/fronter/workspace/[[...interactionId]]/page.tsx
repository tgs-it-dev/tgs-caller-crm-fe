'use client'

import { useParams } from 'next/navigation'
import { ActiveCallScreen } from '@/components/workspace/ActiveCallScreen'

export function generateStaticParams() {
  return []
}

export default function FronterWorkspacePage() {
  const params = useParams<{ interactionId?: string[] }>()
  const interactionId = params.interactionId?.[0] ?? ''
  return <ActiveCallScreen interactionId={interactionId} />
}
