'use client'

import { useEffect, useState } from 'react'
import MuiButton from '@mui/material/Button'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { DataTable, type DataColumn } from '@/components/ui/DataTable'
import { Dialog } from '@/components/ui/Dialog'
import { formatDateTime } from '@/lib/format'
import { waitForMocking } from '@/lib/mockReady'
import { formatMonth, listPaidUploads, undoPaidUpload, type PaidUpload } from '@/lib/policies'
import { withSession } from '@/lib/session'

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; uploads: PaidUpload[] }

function columns(onUndo: (upload: PaidUpload) => void): DataColumn<PaidUpload>[] {
  return [
    {
      id: 'month',
      header: 'Month',
      render: (upload) => (
        <span className="whitespace-nowrap font-medium text-ink">{formatMonth(upload.month)}</span>
      ),
    },
    {
      id: 'file',
      header: 'File',
      render: (upload) => <span className="break-all">{upload.file_name}</span>,
    },
    {
      id: 'matched',
      header: 'Matched',
      align: 'right',
      render: (upload) => <span className="tabular-nums">{upload.matched}</span>,
    },
    {
      id: 'newly',
      header: 'Newly paid',
      align: 'right',
      render: (upload) => <span className="tabular-nums">{upload.newly_paid}</span>,
    },
    { id: 'by', header: 'Uploaded by', render: (upload) => upload.uploaded_by },
    {
      id: 'at',
      header: 'Uploaded',
      render: (upload) => (
        <span className="whitespace-nowrap">{formatDateTime(upload.uploaded_at)}</span>
      ),
    },
    {
      id: 'undo',
      header: '',
      align: 'right',
      render: (upload) =>
        upload.undone_at ? (
          <span className="whitespace-nowrap text-xs text-slate">
            Undone by {upload.undone_by ?? 'a former user'}, {formatDateTime(upload.undone_at)}
          </span>
        ) : (
          <MuiButton variant="outlined" size="small" onClick={() => onUndo(upload)}>
            Undo<span className="sr-only"> the {formatMonth(upload.month)} upload</span>
          </MuiButton>
        ),
    },
  ]
}

/**
 * Every Paid upload, newest first, for a Super Admin, each one undoable until it
 * has been. `reloadKey` changes when a new one is saved.
 */
export function PaidUploadsSection({
  reloadKey,
  onUndone,
}: {
  reloadKey: number
  /** An upload was undone, so any lookup on screen is out of date. */
  onUndone: (upload: PaidUpload) => void
}) {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' })
  const [undoing, setUndoing] = useState<PaidUpload | null>(null)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [refreshed, setRefreshed] = useState(0)

  useEffect(() => {
    let cancelled = false

    waitForMocking()
      .then(() => withSession((token) => listPaidUploads(token)))
      .then((uploads) => {
        if (!cancelled) setLoad({ status: 'ready', uploads })
      })
      .catch(() => {
        if (!cancelled) setLoad({ status: 'error' })
      })

    return () => {
      cancelled = true
    }
  }, [reloadKey, refreshed])

  function undo() {
    if (!undoing) return
    const target = undoing
    setBusy(true)
    setFailure(null)
    withSession((token) => undoPaidUpload(target.id, token))
      .then(() => {
        setUndoing(null)
        setRefreshed((n) => n + 1)
        onUndone(target)
      })
      .catch(() => setFailure('Could not undo that upload. Try again.'))
      .finally(() => setBusy(false))
  }

  return (
    <section className="flex flex-col gap-4">
      {load.status === 'error' && <Alert>Could not load the Paid uploads.</Alert>}
      <DataTable
        title="Paid uploads"
        ariaLabel="Every list of policies marked Paid, newest first"
        rows={load.status === 'ready' ? load.uploads : []}
        columns={columns(setUndoing)}
        getRowId={(upload) => upload.id}
        emptyMessage={
          load.status === 'loading' ? 'Loading Paid uploads…' : 'Nothing has been marked Paid yet.'
        }
        pageSize={10}
        minWidth="max-content"
      />

      <Dialog
        open={undoing !== null}
        title={undoing ? `Undo the ${formatMonth(undoing.month)} upload?` : 'Undo upload'}
        onClose={() => {
          setUndoing(null)
          setFailure(null)
        }}
        busy={busy}
        actions={
          <div className="flex w-full gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setUndoing(null)
                setFailure(null)
              }}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="button" onClick={undo} isLoading={busy} loadingText="Undoing…">
              Undo upload
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-sm leading-[150%] text-body-text">
          {failure && <Alert>{failure}</Alert>}
          <p>The sales it marked go back to unpaid, unless another upload matched them too.</p>
        </div>
      </Dialog>
    </section>
  )
}
