import type { components } from '@/lib/generated/schema'
import { apiUrl } from '@/lib/apiUrl'
import { authError } from '@/lib/auth'

export type TransferStatus = components['schemas']['TransferResponse']['status']
export type TransferResponse = components['schemas']['TransferResponse']
/** Includes optional `override_reason` when vehicle_* fields are missing. */
export type TransferCreateRequest = components['schemas']['TransferCreateRequest']

export type AvailableCloserItem = components['schemas']['AvailableCloserItem']
export type AvailableClosersResponse = components['schemas']['AvailableClosersResponse']

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

/** Read-only list for the Active Call Transfer panel — transfer stays auto-assign. */
export async function listAvailableClosers(token: string): Promise<AvailableCloserItem[]> {
  const res = await fetch(apiUrl('/transfers/closers'), {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw await authError(res)
  const data = (await res.json()) as AvailableClosersResponse
  return data.items
}

