import { ResetPasswordClient } from './client'

export const metadata = { title: 'Choose a new password — TGS Caller CRM' }

/** Static shell at `/reset-password/`; token comes from the path or `?token=`. */
export function generateStaticParams() {
  return [{ token: [] }]
}

export default function ResetPasswordPage() {
  return <ResetPasswordClient />
}
