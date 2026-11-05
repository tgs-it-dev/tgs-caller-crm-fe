import type { components } from '@/lib/generated/schema'
import { apiUrl } from '@/lib/apiUrl'
import { authError } from '@/lib/auth'
import type { NewLead } from '@/lib/leads'

export type OwnSaleLookup = components['schemas']['OwnSaleLookupResponse']
export type OwnSaleLead = components['schemas']['OwnSaleLead']
export type OwnSaleStart = components['schemas']['OwnSaleStartResponse']

/** The closer's team's lead for the number, null when it is new to the team. */
export async function lookupOwnSaleLead(phone: string, token: string): Promise<OwnSaleLookup> {
  const params = new URLSearchParams({ phone_no: phone })
  const res = await fetch(apiUrl(`/leads/own-sale?${params}`), {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw await authError(res)
  return res.json() as Promise<OwnSaleLookup>
}

/** A call of the closer's own on the number, with no fronter and no transfer. */
export async function startOwnSale(lead: NewLead, token: string): Promise<OwnSaleStart> {
  const res = await fetch(apiUrl('/leads/own-sale'), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(lead),
  })
  if (!res.ok) throw await authError(res)
  return res.json() as Promise<OwnSaleStart>
}
