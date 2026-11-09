import {
  ArrowLeftRight,
  BadgeDollarSign,
  CircleCheck,
  CircleDollarSign,
  CircleX,
  Hourglass,
  PhoneCall,
  ShieldCheck,
  Star,
  Target,
  TrendingUp,
} from 'lucide-react'
import { StatTile } from '@/components/fronter/StatTile'
import { targetOf, type AgentPeriod, type AgentStats } from '@/lib/agentStats'
import { formatPercent } from '@/lib/format'

const PER = { today: 'today', week: 'this week', month: 'this month' } as const

/** The figure against its target, with a bar that stops at full. */
function TargetTile({ row, period }: { row: AgentStats; period: AgentPeriod }) {
  const { done, target } = targetOf(row)
  const measured = row.fronter ? 'qualifications' : 'sales'
  return (
    <div className="flex flex-1 flex-col justify-between gap-5 rounded-xl border-hairline border-slate bg-white p-5">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center text-body-text [&_svg]:h-5 [&_svg]:w-5">
          <Target strokeWidth={2} aria-hidden />
        </span>
        <p className="text-sm leading-[150%] text-body-text">Target</p>
      </div>
      {target === null ? (
        <p className="text-sm leading-[150%] text-slate">No target set</p>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-[32px] font-semibold leading-[120%] text-ink tabular-nums">
              {done} of {target}
            </span>
            <span className="text-sm leading-[150%] text-body-text">
              {measured} {PER[period]}
            </span>
          </p>
          <span
            role="progressbar"
            aria-label={`${done} of ${target} ${measured}`}
            aria-valuemin={0}
            aria-valuemax={target}
            aria-valuenow={Math.min(done, target)}
            className="h-1.5 w-full overflow-hidden rounded-full bg-light-grey"
          >
            <span
              className="block h-full rounded-full bg-navy"
              style={{ width: `${Math.min(done / target, 1) * 100}%` }}
            />
          </span>
        </div>
      )}
    </div>
  )
}

function icon(Icon: typeof Target) {
  return <Icon strokeWidth={2} aria-hidden />
}

/**
 * One agent's figures for the period. Paid and conversion are counted by month,
 * so outside the Month tab a note says so in their place.
 */
export function AgentFigureTiles({ row, period }: { row: AgentStats; period: AgentPeriod }) {
  const monthly = period === 'month'
  const fronter = row.fronter
  const closer = row.closer

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {fronter && (
          <>
            <StatTile
              label="Qualifications"
              value={fronter.qualifications}
              icon={icon(CircleCheck)}
            />
            <StatTile label="Transfers" value={fronter.transfers} icon={icon(ArrowLeftRight)} />
            <StatTile label="Callbacks" value={fronter.callbacks} icon={icon(PhoneCall)} />
          </>
        )}
        {closer && (
          <>
            <StatTile label="Sold" value={closer.sold} icon={icon(CircleDollarSign)} />
            {monthly && (
              <>
                <StatTile label="Paid" value={closer.paid ?? 0} icon={icon(BadgeDollarSign)} />
                <StatTile
                  label="Conversion"
                  value={formatPercent(closer.conversion_rate)}
                  detail={`${closer.paid ?? 0} paid of ${closer.sold} sold`}
                  icon={icon(TrendingUp)}
                />
              </>
            )}
            <StatTile label="Cancelled" value={closer.cancelled} icon={icon(CircleX)} />
            <StatTile label="Retained" value={closer.retained} icon={icon(ShieldCheck)} />
            <StatTile label="Pending" value={closer.pending} icon={icon(Hourglass)} />
            <StatTile
              label="Average QA score"
              value={closer.average_qa_score === null ? '-' : closer.average_qa_score.toFixed(1)}
              icon={icon(Star)}
            />
          </>
        )}
        <TargetTile row={row} period={period} />
      </div>
      {!monthly && closer && (
        <p className="text-sm leading-[150%] text-slate">
          Paid and conversion are counted by month, so they show on the Month tab.
        </p>
      )}
    </div>
  )
}
