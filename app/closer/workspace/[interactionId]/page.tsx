import { CloserActiveCallScreen } from '@/components/closer/CloserActiveCallScreen'

export default async function CloserWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ interactionId: string }>
  searchParams: Promise<{ transferId?: string | string[] }>
}) {
  const { interactionId } = await params
  const query = await searchParams
  const raw = query.transferId
  const transferId = Array.isArray(raw) ? raw[0] : raw

  return (
    <CloserActiveCallScreen interactionId={interactionId} transferId={transferId} />
  )
}
