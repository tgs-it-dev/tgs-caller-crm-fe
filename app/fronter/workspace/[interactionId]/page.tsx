import { ActiveCallScreen } from '@/components/workspace/ActiveCallScreen'

export default async function FronterWorkspacePage({
  params,
}: {
  params: Promise<{ interactionId: string }>
}) {
  const { interactionId } = await params
  return <ActiveCallScreen interactionId={interactionId} />
}
