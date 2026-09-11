'use client'

import { Button } from '@/components/ui/Button'

export function CloserDispositionCard({
  onTransfer,
  isTransferring = false,
  disabled = false,
}: {
  onTransfer?: () => void
  isTransferring?: boolean
  disabled?: boolean
}) {
  return (
    <div className="flex h-full flex-col rounded-xl border-hairline border-slate bg-white p-6">
      <h2 className="border-b-hairline border-light-grey pb-4 text-lg font-medium leading-[120%] text-ink">
        Closer Disposition
      </h2>
      <p className="mt-4 flex-1 text-base leading-[150%] text-body-text">
        Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt
        ut labore et dolore magna aliqua. Ut enim ad minim veniam,
      </p>
      <div className="mt-6">
        <Button
          type="button"
          onClick={onTransfer}
          disabled={disabled || isTransferring}
          isLoading={isTransferring}
          loadingText="Working…"
        >
          Transfer to Closer
        </Button>
      </div>
    </div>
  )
}
