'use client'

/** A choice between a few short options, all in view, the chosen one filled. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  /** Names the group for screen readers. */
  label: string
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (next: T) => void
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex rounded-lg border-hairline border-slate bg-white p-0.5"
    >
      {options.map((option) => {
        const chosen = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={chosen}
            onClick={() => onChange(option.value)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium leading-[140%] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy motion-reduce:transition-none ${
              chosen ? 'bg-navy text-white' : 'text-body-text hover:bg-shop-floor'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
