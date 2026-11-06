'use client'

import { useRef, useState, type DragEvent } from 'react'
import { FileSpreadsheet, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { tokens } from '@/lib/theme'

function fileSize(bytes: number) {
  return bytes < 1024 ? `${bytes} bytes` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

/** Drop or choose one CSV or Excel file, then run `onAction` on it. */
export function PolicyFileDrop({
  file,
  hint,
  actionLabel,
  busyLabel,
  busy,
  problem,
  onPick,
  onClear,
  onAction,
}: {
  file: File | null
  hint: string
  actionLabel: string
  busyLabel: string
  busy: boolean
  problem: string | null
  onPick: (file: File | null) => void
  onClear: () => void
  onAction: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)
    onPick(event.dataTransfer.files?.[0] ?? null)
  }

  return (
    <>
      <div
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={(event) => {
          // Moving over the text or buttons inside is not leaving the zone.
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setDragging(false)
          }
        }}
        onDrop={drop}
        className={`flex flex-wrap items-center gap-4 rounded-xl border border-dashed px-5 py-5 transition-colors ${
          dragging ? 'border-navy bg-shop-floor' : 'border-light-grey bg-white'
        }`}
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-shop-floor">
          <FileSpreadsheet className="h-5 w-5" color={tokens.navy} strokeWidth={2} aria-hidden />
        </span>
        <div className="min-w-0 flex-1" aria-live="polite">
          {file ? (
            <>
              <p className="flex items-center gap-2 truncate text-sm font-medium text-ink">
                <span className="truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={onClear}
                  className="shrink-0 text-slate hover:text-ink"
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="h-4 w-4" strokeWidth={2} aria-hidden />
                </button>
              </p>
              <p className="text-xs leading-[150%] text-slate">{fileSize(file.size)}</p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-ink">
                Drop a CSV or Excel file here, or choose one
              </p>
              <p className="text-xs leading-[150%] text-slate">{hint}</p>
            </>
          )}
        </div>
        <div className="flex shrink-0 gap-3">
          <div className="w-[128px]">
            <Button
              type="button"
              variant="secondary"
              size="small"
              onClick={() => inputRef.current?.click()}
            >
              {file ? 'Change file' : 'Choose file'}
            </Button>
          </div>
          <div className="w-[128px]">
            <Button
              type="button"
              size="small"
              disabled={!file}
              isLoading={busy}
              loadingText={busyLabel}
              onClick={onAction}
            >
              {actionLabel}
            </Button>
          </div>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          const picked = event.target.files?.[0] ?? null
          // Cleared so picking the same file again, once fixed, still registers.
          event.target.value = ''
          onPick(picked)
        }}
      />
      {problem && (
        <p role="alert" className="mt-2 text-xs leading-[150%] text-status-red">
          {problem}
        </p>
      )}
    </>
  )
}
