import type { ReactNode } from 'react'

/** A 24px line icon drawn in the text colour — the stroke style of the Figma icon set. */
export function OutlineIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5 flex-shrink-0"
      aria-hidden
    >
      {children}
    </svg>
  )
}
