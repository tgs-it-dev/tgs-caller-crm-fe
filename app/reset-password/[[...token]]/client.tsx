'use client'

import { Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { SetPasswordScreen } from '@/components/auth/SetPasswordScreen'

function Reset() {
  const params = useParams<{ token?: string[] }>()
  const search = useSearchParams()
  const token = params.token?.[0] ?? search.get('token') ?? ''

  return <SetPasswordScreen mode="reset" token={token} />
}

export function ResetPasswordClient() {
  return (
    <Suspense fallback={null}>
      <Reset />
    </Suspense>
  )
}
