function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
      <path
        d={
          direction === 'left'
            ? 'M12.5 4.5L7 10l5.5 5.5'
            : 'M7.5 4.5L13 10l-5.5 5.5'
        }
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
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
      {/* Figma: grey strip hosts white rounded chevron buttons around the page label. */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Previous page"
          onClick={onPrevious}
          disabled={page <= 1}
          className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronIcon direction="left" />
        </button>
        <span className="min-w-[5.5rem] text-center text-sm font-normal leading-[150%] text-ink">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          aria-label="Next page"
          onClick={onNext}
          disabled={page >= totalPages}
          className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronIcon direction="right" />
        </button>
      </div>
    </div>
  )
}
