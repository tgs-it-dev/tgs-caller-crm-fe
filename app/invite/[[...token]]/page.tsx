import { InviteClient } from './client'

export const metadata = { title: 'Set up your account — TGS Caller CRM' }

/** Static shell at `/invite/`; token comes from the path or `?token=`. */
export function generateStaticParams() {
  return [{ token: [] }]
}

export default function InvitePage() {
  return <InviteClient />
}
