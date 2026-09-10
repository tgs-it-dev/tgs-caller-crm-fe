// Matches the backend's frozen contract in src/schemas/transfers.py.
export type TransferStatus = 'initiated' | 'offered' | 'accepted' | 'rejected' | 'timeout'

export type TransferResponse = {
  id: string
  interaction_id: string
  status: TransferStatus
  fronter_user_id: string | null
  closer_user_id: string | null
  created_at: string
  updated_at: string
}

export type TransferCreateRequest = {
  interaction_id: string
  fronter_user_id: string
}

function apiUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || ''
  return `${base}${path}`
}

export async function createTransfer(
  payload: TransferCreateRequest,
  token: string
): Promise<TransferResponse> {
  const res = await fetch(apiUrl('/transfers'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })

  if (!res.ok) throw new Error('Unable to start the transfer. Please try again.')

  return res.json()
}
