import type { ReactNode } from 'react'
import { OutlineIcon } from '@/components/icons/OutlineIcon'
import type { LiveStatus } from '@/lib/liveStatus'

const PHONE =
  'M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1.9.4 1.8.7 2.7a2 2 0 01-.5 2.1L8.1 9.8a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.4c.9.3 1.8.6 2.7.7a2 2 0 011.8 2z'

type Counter = { label: string; value: string; icon: ReactNode; hint?: string }

export function LiveCounters({ snapshot }: { snapshot: LiveStatus }) {
  const { transfers_initiated, transfers_rejected } = snapshot.funnel_today
  const counters: Counter[] = [
    {
      label: 'Agents Logged In',
      value: String(snapshot.agents.filter((agent) => agent.status !== 'offline').length),
      icon: (
        <OutlineIcon>
          <path d={PHONE} />
        </OutlineIcon>
      ),
    },
    {
      label: 'Active Calls',
      value: String(snapshot.active_calls),
      icon: (
        <OutlineIcon>
          <circle cx="12" cy="12" r="9" />
          <path d="M8.5 12l2.5 2.5 4.5-5" />
        </OutlineIcon>
      ),
    },
    {
      // Not "Queue Depth": it can't see callers waiting in the dialer yet, and
      // shouldn't be read as if it could.
      label: 'Transfer Queue',
      value: String(snapshot.pending_transfers),
      hint: "Transfers waiting for a closer to answer. Callers waiting in the dialer aren't included yet.",
      icon: (
        <OutlineIcon>
          <path d={PHONE} />
          <path d="M16 2v6h6M22 2l-6 6" />
        </OutlineIcon>
      ),
    },
    {
      label: 'Transfers Offered/ Rejected',
      value: `${transfers_initiated}/${transfers_rejected}`,
      icon: (
        <OutlineIcon>
          <path d={PHONE} />
          <path d="M18 2l4 4-4 4M14 6h8" />
        </OutlineIcon>
      ),
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {counters.map(({ label, value, icon, hint }) => (
        <div
          key={label}
          title={hint}
          // Figures sit at the bottom, so they stay level when a label wraps.
          className="flex flex-col justify-between rounded-xl border-hairline border-slate bg-white p-5"
        >
          <p className="flex items-center gap-2 text-sm leading-[120%] text-body-text">
            {icon}
            {label}
          </p>
          <p className="mt-6 text-[32px] font-semibold leading-none text-ink tabular-nums">
            {value}
          </p>
        </div>
      ))}
    </div>
  )
}
