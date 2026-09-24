'use client'

import { useParams } from 'next/navigation'
import { CloserActiveCallScreen } from '@/components/closer/CloserActiveCallScreen'

export function generateStaticParams() {
  return []
}

export default function CloserWorkspacePage() {
  const params = useParams<{ interactionId?: string[] }>()
  const interactionId = params.interactionId?.[0] ?? ''
  return <CloserActiveCallScreen interactionId={interactionId} />
}
