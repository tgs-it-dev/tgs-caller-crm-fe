import { AdminInteractionDetailClient } from './client'

/** See fronter workspace page — same static-export shell pattern. */
export function generateStaticParams() {
  return [{ interactionId: [] }]
}

export default function AdminInteractionDetailPage() {
  return <AdminInteractionDetailClient />
}
