function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
      <path
        fillRule="evenodd"
        d={
          direction === 'left'
            ? 'M12.79 5.23a.75.75 0 010 1.06L8.06 10l4.73 3.71a.75.75 0 11-.93 1.18l-5.5-4.3a.75.75 0 010-1.18l5.5-4.3a.75.75 0 011.06.02z'
            : 'M7.21 14.77a.75.75 0 010-1.06L11.94 10 7.21 6.29a.75.75 0 01.93-1.18l5.5 4.3a.75.75 0 010 1.18l-5.5 4.3a.75.75 0 01-1.06-.02z'
        }
        clipRule="evenodd"
      />
    </svg>
  )
}

export function Pagination({
  page,
  totalPages,
  rangeStart,
  rangeEnd,
  onPrevious,
  onNext,
  className = '',
}: {
  page: number
  totalPages: number
  rangeStart: number
  rangeEnd: number
  onPrevious: () => void
  onNext: () => void
  /** Outer spacing is the caller's business, not this component's. */
  className?: string
}) {
  return (
    <div className={`flex items-center justify-between text-xs text-slate ${className}`}>
      <span>
        Showing {rangeStart} to {rangeEnd}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Previous page"
          onClick={onPrevious}
          disabled={page <= 1}
          className="text-slate hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronIcon direction="left" />
        </button>
        <span>
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          aria-label="Next page"
          onClick={onNext}
          disabled={page >= totalPages}
          className="text-slate hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronIcon direction="right" />
        </button>
      </div>
    </div>
  )
}
