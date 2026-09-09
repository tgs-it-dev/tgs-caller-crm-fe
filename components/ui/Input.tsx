import { InputHTMLAttributes, ReactNode, forwardRef, useId } from 'react'

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  endAdornment?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, id, className = '', endAdornment, ...props },
  ref
) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <div>
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-black">
        {label}
      </label>
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          className={`block w-full rounded-lg border border-chrome bg-paper px-4 py-3 text-sm text-ink placeholder-grey transition focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy ${endAdornment ? 'pr-11' : ''} ${className}`}
          {...props}
        />
        {endAdornment && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">{endAdornment}</div>
        )}
      </div>
    </div>
  )
})
