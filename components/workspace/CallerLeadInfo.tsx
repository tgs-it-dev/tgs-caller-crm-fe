function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden>
      <path
        fillRule="evenodd"
        d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 111.42-1.42l2.79 2.79 6.79-6.79a1 1 0 011.42 0z"
        clipRule="evenodd"
      />
    </svg>
  )
}

export function CallerLeadInfo() {
  return (
    <div className="rounded-xl border-hairline border-slate bg-white p-6">
      <h2 className="border-b border-slate/20 pb-4 text-lg font-medium leading-[120%] text-ink">
        Caller / Lead Info
      </h2>
      <p className="mt-4 text-base leading-[150%] text-body-text">
        Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt
        ut labore et dolore magna aliqua. Ut enim ad minim veniam,
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-pill-border bg-white px-3 py-2 text-sm font-normal leading-[150%] text-ink">
          <span className="text-status-green">
            <CheckIcon />
          </span>
          Phone Matched
        </span>
        <span className="inline-flex items-center gap-1 rounded-lg border border-pill-border bg-white px-3 py-2 text-sm font-normal leading-[150%]">
          <span className="text-dimgray">Source:</span>{' '}
          <span className="text-ink">VICIdial</span>
        </span>
      </div>
    </div>
  )
}
