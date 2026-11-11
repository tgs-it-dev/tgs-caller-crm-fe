'use client'

import { useCallback, useEffect, useState } from 'react'
import MuiButton from '@mui/material/Button'
import { SignInList } from '@/components/dataUpload/UsersUploadTab'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { DataTable, type DataColumn } from '@/components/ui/DataTable'
import { Dialog } from '@/components/ui/Dialog'
import { AuthError } from '@/lib/auth'
import {
  listUploads,
  newPasswords,
  undoUpload,
  type DataImportItem,
  type NewPasswordsResponse,
} from '@/lib/dataImports'
import { formatDateTime } from '@/lib/format'
import { waitForMocking } from '@/lib/mockReady'
import { withSession } from '@/lib/session'

const KIND_LABEL: Record<DataImportItem['kind'], string> = {
  users: 'Users',
  agent_work: 'Agent work',
}

function result(item: DataImportItem): string {
  const s = item.summary as Record<string, number | undefined>
  if (item.kind === 'users') {
    const parts = [`${s.users ?? 0} users`]
    if (s.teams) parts.push(`${s.teams} teams`)
    return parts.join(' · ')
  }
  const parts = [`${(s.rows ?? 0).toLocaleString()} rows`]
  if (s.sales !== undefined) parts.push(`${s.sales.toLocaleString()} sales`)
  return parts.join(' · ')
}

export function PastUploadsTab({ version: outside = 0 }: { version?: number }) {
  const [items, setItems] = useState<DataImportItem[] | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [asking, setAsking] = useState<DataImportItem | null>(null)
  const [making, setMaking] = useState(false)
  const [fresh, setFresh] = useState<NewPasswordsResponse | null>(null)
  const [undoing, setUndoing] = useState<DataImportItem | null>(null)
  const [undoBusy, setUndoBusy] = useState(false)
  const [refused, setRefused] = useState<string | null>(null)

  const [version, setVersion] = useState(0)
  const reload = useCallback(() => setVersion((n) => n + 1), [])

  useEffect(() => {
    let cancelled = false
    waitForMocking()
      .then(() => withSession(listUploads))
      .then((list) => {
        if (cancelled) return
        setItems(list)
        setFailure(null)
      })
      .catch(() => {
        if (!cancelled) setFailure('Could not load past uploads. Try again.')
      })
    return () => {
      cancelled = true
    }
  }, [version, outside])

  function makePasswords() {
    if (!asking) return
    setMaking(true)
    withSession((token) => newPasswords(asking.id, token))
      .then((result) => {
        setFresh(result)
        setAsking(null)
      })
      .catch(() => setFailure('Could not make new passwords. Try again.'))
      .finally(() => setMaking(false))
  }

  function undo() {
    if (!undoing) return
    setUndoBusy(true)
    setRefused(null)
    withSession((token) => undoUpload(undoing.id, token))
      .then(() => {
        setUndoing(null)
        reload()
      })
      .catch((err) => {
        // A refusal says what was found: an outcome, a QA review, a later upload...
        if (err instanceof AuthError && err.status === 409) setRefused(err.message)
        else setRefused('Could not undo it. Try again.')
      })
      .finally(() => setUndoBusy(false))
  }

  const columns: DataColumn<DataImportItem>[] = [
    { id: 'when', header: 'When', render: (item) => <span className="whitespace-nowrap">{formatDateTime(item.created_at)}</span> },
    { id: 'what', header: 'What', render: (item) => KIND_LABEL[item.kind] },
    { id: 'file', header: 'File', render: (item) => <span className="break-all">{item.file_name}</span> },
    { id: 'result', header: 'Result', render: result },
    { id: 'by', header: 'By', render: (item) => item.created_by_name },
    {
      id: 'status',
      header: 'Status',
      render: (item) =>
        item.undone_at ? (
          <Badge tone="neutral">
            Undone {formatDateTime(item.undone_at)}
            {item.undone_by_name ? ` by ${item.undone_by_name}` : ''}
          </Badge>
        ) : item.kind === 'agent_work' ? (
          <Badge tone="teal">Live</Badge>
        ) : (
          <span className="text-slate">-</span>
        ),
    },
    {
      id: 'actions',
      header: '',
      align: 'right',
      render: (item) => (
        <div className="flex justify-end gap-2 whitespace-nowrap">
          {item.kind === 'users' && (
            <MuiButton size="small" variant="outlined" onClick={() => setAsking(item)}>
              New passwords<span className="sr-only"> for {item.file_name}</span>
            </MuiButton>
          )}
          {item.kind === 'agent_work' && !item.undone_at && (
            <MuiButton
              size="small"
              variant="outlined"
              color="error"
              onClick={() => {
                setRefused(null)
                setUndoing(item)
              }}
            >
              Undo<span className="sr-only"> {item.file_name}</span>
            </MuiButton>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      {failure && <Alert>{failure}</Alert>}
      {fresh && <SignInList users={fresh.users} files={fresh.files} title="New sign-in details" />}
      <DataTable
        title="Past uploads"
        ariaLabel="Every upload, newest first"
        rows={items ?? []}
        columns={columns}
        getRowId={(item) => item.id}
        emptyMessage={items === null ? 'Loading…' : 'Nothing has been uploaded yet.'}
        pageSize={20}
      />
      <Dialog
        open={undoing !== null}
        title="Undo this upload"
        onClose={() => setUndoing(null)}
        busy={undoBusy}
        actions={
          <div className="flex w-full gap-3">
            <Button type="button" variant="secondary" onClick={() => setUndoing(null)} disabled={undoBusy}>
              {refused ? 'Close' : 'Cancel'}
            </Button>
            {!refused && (
              <Button type="button" onClick={undo} isLoading={undoBusy} loadingText="Undoing…">
                Undo upload
              </Button>
            )}
          </div>
        }
      >
        <div className="space-y-2 text-sm leading-[150%] text-body-text">
          {refused ? (
            <p className="text-ink">{refused}</p>
          ) : (
            <>
              <p>
                Everything {undoing?.file_name} added is taken out: its calls, transfers, sales and cards,
                and the leads it created.
              </p>
              <p>
                Details it filled into leads that were already there stay, and Do Not Call numbers stay on
                the list.
              </p>
            </>
          )}
        </div>
      </Dialog>
      <Dialog
        open={asking !== null}
        title="Make new passwords"
        onClose={() => setAsking(null)}
        busy={making}
        actions={
          <div className="flex w-full gap-3">
            <Button type="button" variant="secondary" onClick={() => setAsking(null)} disabled={making}>
              Cancel
            </Button>
            <Button type="button" onClick={makePasswords} isLoading={making} loadingText="Making…">
              Make new passwords
            </Button>
          </div>
        }
      >
        <div className="space-y-2 text-sm leading-[150%] text-body-text">
          <p>
            Everyone from {asking?.file_name} who hasn&apos;t signed in and chosen their own password
            gets a new one. The old list stops working for them.
          </p>
          <p>People who already chose their own aren&apos;t touched.</p>
        </div>
      </Dialog>
    </div>
  )
}
