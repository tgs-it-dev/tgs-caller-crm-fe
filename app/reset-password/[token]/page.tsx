import { SetPasswordScreen } from '@/components/auth/SetPasswordScreen'

export const metadata = { title: 'Choose a new password — TGS Caller CRM' }

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  return <SetPasswordScreen mode="reset" token={token} />
}
