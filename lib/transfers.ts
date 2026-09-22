import type { components } from '@/lib/generated/schema'
import { apiUrl } from '@/lib/apiUrl'
import { authError } from '@/lib/auth'

export type TransferStatus = components['schemas']['TransferResponse']['status']
export type TransferResponse = components['schemas']['TransferResponse']
/** Includes optional `override_reason` when vehicle_* fields are missing. */
export type TransferCreateRequest = components['schemas']['TransferCreateRequest']

export async function createTransfer(
  payload: TransferCreateRequest,
  token: string
): Promise<TransferResponse> {
  const res = await fetch(apiUrl('/transfers'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })

  if (!res.ok) throw await authError(res)

  return res.json() as Promise<TransferResponse>
}
