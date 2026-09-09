import { Workspace } from './Workspace'

export default async function FronterWorkspacePage({
  params,
}: {
  params: Promise<{ interactionId: string }>
}) {
  const { interactionId } = await params
  return <Workspace interactionId={interactionId} />
}
