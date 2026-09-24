'use client'

import { Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { SetPasswordScreen } from '@/components/auth/SetPasswordScreen'

function Invite() {
  const params = useParams<{ token?: string[] }>()
  const search = useSearchParams()
  const token = params.token?.[0] ?? search.get('token') ?? ''

  return <SetPasswordScreen mode="invite" token={token} />
}

export function InviteClient() {
  return (
    <Suspense fallback={null}>
      <Invite />
    </Suspense>
  )
}
