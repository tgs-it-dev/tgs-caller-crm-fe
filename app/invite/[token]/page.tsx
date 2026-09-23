import { SetPasswordScreen } from '@/components/auth/SetPasswordScreen'

export const metadata = { title: 'Set up your account — TGS Caller CRM' }

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <SetPasswordScreen mode="invite" token={token} />
}
