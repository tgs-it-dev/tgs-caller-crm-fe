import { CloserActiveCallScreen } from '@/components/closer/CloserActiveCallScreen'

export default async function CloserWorkspacePage({
  params,
}: {
  params: Promise<{ interactionId: string }>
}) {
  const { interactionId } = await params
  return <CloserActiveCallScreen interactionId={interactionId} />
}
