import { RequireRole } from '@/components/auth/RequireRole'
import { StatTile } from '@/components/fronter/StatTile'
import { PageShell } from '@/components/ui/PageShell'

/** Lucide `Phone` — Figma My Stats "Calls Today". */
function CallsTodayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Lucide `CircleCheck` — Figma My Stats "Qualified". */
function QualifiedIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m9 12 2 2 4-4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Lucide `RefreshCw` — Figma My Stats "Transferred". */
function TransferredIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M21 3v5h-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 16H3v5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function FronterStatsPage() {
  return (
    <RequireRole role="fronter">
      <PageShell title="My Stats">
        <div className="flex flex-col gap-6 sm:flex-row sm:gap-5">
          <StatTile label="Calls Today" value={0} icon={<CallsTodayIcon />} />
          <StatTile label="Qualified" value={0} icon={<QualifiedIcon />} />
          <StatTile label="Transferred" value={0} icon={<TransferredIcon />} />
        </div>
      </PageShell>
    </RequireRole>
  )
}
