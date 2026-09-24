import { Phone } from 'lucide-react'

/**
 * Lucide `Phone` — shared with sidebar Active Call / workspace.
 * Size via `className` (e.g. `h-6 w-6`); do not lock with inline styles.
 */
export function PhoneIcon({ className = 'h-6 w-6 shrink-0' }: { className?: string }) {
  return <Phone strokeWidth={2} aria-hidden className={className} />
}
