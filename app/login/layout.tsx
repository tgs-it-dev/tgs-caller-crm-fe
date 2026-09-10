import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign in — TGS Caller CRM',
  description: 'Sign in to your call center workspace',
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children
}
