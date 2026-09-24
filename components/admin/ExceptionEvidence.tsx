import { formatInstant } from '@/lib/format'
import { reasonMeaning, type ExceptionReason, type ReconciliationException } from '@/lib/exceptions'

type Details = ReconciliationException['details']

function readNumber(details: Details, key: string): number | null {
  const value = details[key]
  return typeof value === 'number' ? value : null
}

function readString(details: Details, key: string): string | null {
  const value = details[key]
  return typeof value === 'string' ? value : null
}

function readIds(details: Details, key: string): string[] {
  const value = details[key]
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 sm:grid-cols-[11rem_1fr] sm:gap-x-6">
      <dt className="text-sm leading-[150%] text-slate">{label}</dt>
      <dd className="text-sm font-medium leading-[150%] text-ink">{children}</dd>
    </div>
  )
}

/** Enough ids to recognise the events by, not a column of them. */
const MAX_LISTED_IDS = 5

/** "5 minutes" from a window the API states in seconds. */
function windowLabel(seconds: number): string {
  if (seconds % 60 === 0) {
    const minutes = seconds / 60
    return `${minutes} minute${minutes === 1 ? '' : 's'}`
  }
  return `${seconds} second${seconds === 1 ? '' : 's'}`
}

function MultiLegFacts({ details }: { details: Details }) {
  const legCount = readNumber(details, 'leg_count')

  return (
    <>
      <Fact label="Call legs recorded">{legCount ?? 'more than one'}</Fact>
      <Fact label="Transfers recorded">None, of any status</Fact>
    </>
  )
}

function LateEventFacts({ details }: { details: Details }) {
  const finalizedAt = readString(details, 'finalized_at')
  const windowSeconds = readNumber(details, 'window_seconds')
  const lateEventIds = readIds(details, 'late_event_ids')

  return (
    <>
      <Fact label="Dispositioned">{finalizedAt ? formatInstant(finalizedAt) : 'Not recorded'}</Fact>
      {windowSeconds !== null && <Fact label="Grace window">{windowLabel(windowSeconds)}</Fact>}
      <Fact label="Events after it">
        {lateEventIds.length} {lateEventIds.length === 1 ? 'event' : 'events'}
        {lateEventIds.length > 0 && (
          <ul className="mt-1 space-y-0.5 font-mono text-xs font-normal text-slate">
            {lateEventIds.slice(0, MAX_LISTED_IDS).map((id) => (
              <li key={id}>{id}</li>
            ))}
            {lateEventIds.length > MAX_LISTED_IDS && (
              // The rest are in the interaction's Raw Event Log, which is the
              // screen for reading them anyway.
              <li className="font-sans text-slate">
                and {lateEventIds.length - MAX_LISTED_IDS} more
              </li>
            )}
          </ul>
        )}
      </Fact>
    </>
  )
}

/**
 * A full Record, so a reason added to the contract fails the build rather than
 * reaching an administrator as an unexplained flag with no evidence under it.
 */
const FACTS: Record<ExceptionReason, (props: { details: Details }) => React.JSX.Element> = {
  multi_leg_without_transfer: MultiLegFacts,
  late_event_after_finalization: LateEventFacts,
}

/**
 * Why this interaction was flagged, read out of `details`.
 *
 * This is the only place the evidence appears. It is the point of the queue:
 * the reviewer sees what the sweep saw without leaving the row.
 */
export function ExceptionEvidence({ exception }: { exception: ReconciliationException }) {
  const Facts = FACTS[exception.reason]

  return (
    <div>
      <p className="text-sm leading-[150%] text-body-text">{reasonMeaning(exception.reason)}</p>
      <dl className="mt-3 space-y-2">
        <Facts details={exception.details} />
      </dl>
    </div>
  )
}
