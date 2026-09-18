import { Phone } from 'lucide-react'

export function PhoneIcon({ className = 'shrink-0' }: { className?: string }) {
  /** Lucide `Phone` — shared with sidebar Active Call / workspace. */
  return (
    <Phone
      size={24}
      strokeWidth={2}
      aria-hidden
      className={className}
      style={{ width: 24, height: 24, minWidth: 24, minHeight: 24 }}
    />
  )
}
