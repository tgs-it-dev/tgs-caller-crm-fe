'use client'

import { useParams } from 'next/navigation'
import { SetPasswordScreen } from '@/components/auth/SetPasswordScreen'

export function generateStaticParams() {
  return []
}

export default function ResetPasswordPage() {
  const params = useParams<{ token?: string[] }>()
  const token = params.token?.[0] ?? ''
  return <SetPasswordScreen mode="reset" token={token} />
}
