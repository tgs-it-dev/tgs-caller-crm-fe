'use client'

import { useId, useRef, useState, type ComponentProps, type FormEvent } from 'react'
import { CircleCheck, CircleX, Users } from 'lucide-react'
import {
  CAMPAIGN_PROBLEMS,
  LeadCampaignSelect,
  campaignMissing,
  initialCampaignId,
} from '@/components/admin/LeadCampaignSelect'
import { StatTile } from '@/components/fronter/StatTile'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { DataTable, type DataColumn } from '@/components/ui/DataTable'
import { Dialog } from '@/components/ui/Dialog'
import { AuthError } from '@/lib/auth'
import type { Campaign } from '@/lib/campaigns'
import { formatPhone } from '@/lib/format'
import { uploadLeads, type LeadBulkRow, type LeadBulkUpload } from '@/lib/leads'
import { withSession } from '@/lib/session'
import { tokens } from '@/lib/theme'

/** The API's own ceiling, so an oversized file is refused before it is sent. */
const MAX_BYTES = 1_048_576

const TOO_LARGE = 'Up to 1,000 rows and 1 MB per file.'

const NOT_CSV = 'Only .csv files can be uploaded.'

const FILE_PROBLEMS: Record<string, string> = {
  'lead.bulk_empty': 'That file has no rows.',
  'lead.bulk_bad_header': 'The first line needs a phone column.',
  'lead.bulk_invalid_encoding': 'Save the file as a UTF-8 CSV and try again.',
  'lead.bulk_too_large': TOO_LARGE,
}

// The API commits as it goes, so a broken-off upload may have added some rows.
const UNFINISHED =
  'The upload did not finish. Some rows may already be added; uploading the same file again is safe.'

type NotAdded = Exclude<LeadBulkRow['status'], 'created'>

const REASON: Record<NotAdded, { label: string; tone: ComponentProps<typeof Badge>['tone'] }> = {
  existing: { label: 'Already on your team', tone: 'neutral' },
  suppressed: { label: 'Do-not-call', tone: 'red' },
  invalid: { label: 'Invalid number', tone: 'amber' },
  duplicate_in_file: { label: 'Repeated in file', tone: 'neutral' },
}

const RESULT_COLUMNS: DataColumn<LeadBulkRow>[] = [
  { id: 'row', header: 'Row', render: (row) => row.row },
  {
    id: 'phone',
    header: 'Phone',
    render: (row) =>
      row.phone ? (
        // An invalid row carries the cell as written; the rest are E.164.
        <span className="whitespace-nowrap">
          {row.status === 'invalid' ? row.phone : formatPhone(row.phone)}
        </span>
      ) : (
        <span className="text-slate">(blank)</span>
      ),
  },
  {
    id: 'reason',
    header: 'Reason',
    render: (row) => {
      const reason = REASON[row.status as NotAdded]
      return <Badge tone={reason.tone}>{reason.label}</Badge>
    },
  },
]

/** What one upload did: the counts first, then each number that was not added and why. */
function UploadResults({ result, fileName }: { result: LeadBulkUpload; fileName: string }) {
  const { created, existing, failed } = result.summary
  const rows = result.rows.length
  const notAdded = result.rows.filter((row) => row.status !== 'created')

  return (
    <div className="space-y-5 pt-1">
      <p className="text-sm leading-[150%] text-slate">
        <span className="font-medium text-ink">{fileName}</span> · {rows}{' '}
        {rows === 1 ? 'row' : 'rows'}
      </p>

      {/* State rides on the icon beside each label, and only when there is something to flag. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile
          label="Added"
          value={created}
          icon={
            <CircleCheck
              color={created > 0 ? tokens.status.bayGreen : tokens.slate}
              strokeWidth={2}
              aria-hidden
            />
          }
        />
        <StatTile
          label="Already on your team"
          value={existing}
          icon={<Users color={tokens.slate} strokeWidth={2} aria-hidden />}
        />
        <StatTile
          label="Could not be added"
          value={failed}
          icon={
            <CircleX
              color={failed > 0 ? tokens.status.red : tokens.slate}
              strokeWidth={2}
              aria-hidden
            />
          }
        />
      </div>

      {notAdded.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-black">Numbers not added</h3>
          <DataTable
            embedded
            title="Numbers not added"
            ariaLabel="Numbers not added"
            rows={notAdded}
            columns={RESULT_COLUMNS}
            getRowId={(row) => String(row.row)}
            emptyMessage="Every number was added."
            pageSize={10}
            // Sized by content: split evenly, Row took a third and the reasons were cut off.
            minWidth="max-content"
          />
        </div>
      ) : (
        <p className="text-sm leading-[150%] text-body-text">
          {created === 1
            ? "The new lead is on your fronters' queue."
            : `The ${created} new leads are on your fronters' queue.`}
        </p>
      )}
    </div>
  )
}

function bannerFor(err: AuthError): string {
  if (err.code === 'lead.team_required') {
    return 'You are not on a team yet, so you cannot add leads.'
  }
  if (err.status === 403) return 'You no longer have access to lead management.'
  if (err.status === 401) return 'Your session has ended. Please sign in again.'
  if (err.status >= 500) return UNFINISHED
  return err.message
}

export function LeadUploadDialog({
  campaigns,
  onClose,
  onSaved,
}: {
  /** The team's active campaigns. */
  campaigns: Campaign[]
  /** Nothing was uploaded. */
  onClose: () => void
  /** An upload finished: the list behind may have new leads. */
  onSaved: () => void
}) {
  const formId = useId()
  const fileLabelId = useId()
  const fileHintId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [campaignId, setCampaignId] = useState(initialCampaignId(campaigns))
  const [problems, setProblems] = useState<Record<string, string>>({})
  const [banner, setBanner] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<LeadBulkUpload | null>(null)

  function showFailure(err: unknown) {
    if (!(err instanceof AuthError)) {
      setBanner(UNFINISHED)
      return
    }
    if (FILE_PROBLEMS[err.code]) {
      setProblems({ file: FILE_PROBLEMS[err.code] })
      return
    }
    if (CAMPAIGN_PROBLEMS[err.code]) {
      setProblems({ campaign_id: CAMPAIGN_PROBLEMS[err.code] })
      return
    }
    setBanner(bannerFor(err))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const found: Record<string, string> = {}
    if (!file) found.file = 'Choose a CSV file.'
    else if (file.size > MAX_BYTES) found.file = TOO_LARGE
    if (campaignMissing(campaigns, campaignId)) found.campaign_id = 'Select a campaign.'
    setProblems(found)
    setBanner(null)
    if (!file || Object.keys(found).length > 0) return

    setUploading(true)
    try {
      setResult(await withSession((token) => uploadLeads(file, campaignId || null, token)))
    } catch (err) {
      showFailure(err)
    } finally {
      setUploading(false)
    }
  }

  return (
    <Dialog
      open
      title={result ? 'Upload results' : 'Upload leads'}
      maxWidth="sm"
      onClose={result ? onSaved : onClose}
      busy={uploading}
      actions={
        result ? (
          <div className="flex w-full">
            <Button type="button" onClick={onSaved}>
              Done
            </Button>
          </div>
        ) : (
          <div className="flex w-full gap-3">
            <Button type="button" variant="secondary" onClick={onClose} disabled={uploading}>
              Cancel
            </Button>
            <Button type="submit" form={formId} isLoading={uploading} loadingText="Uploading…">
              Upload
            </Button>
          </div>
        )
      }
    >
      {result ? (
        <UploadResults result={result} fileName={file?.name ?? 'Your file'} />
      ) : (
        <form id={formId} onSubmit={submit} noValidate className="space-y-5 pt-1">
          {banner && <Alert>{banner}</Alert>}

          <div>
            <p id={fileLabelId} className="mb-2 text-sm font-medium text-black">
              CSV file
            </p>
            <div className="flex items-center gap-3">
              <div className="w-[128px] shrink-0">
                <Button
                  type="button"
                  variant="secondary"
                  size="small"
                  aria-describedby={`${fileLabelId} ${fileHintId}`}
                  onClick={() => inputRef.current?.click()}
                >
                  Choose file
                </Button>
              </div>
              <span className="min-w-0 truncate text-sm text-ink" aria-live="polite">
                {file ? file.name : 'No file chosen'}
              </span>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(event) => {
                const picked = event.target.files?.[0] ?? null
                // Cleared so picking the same file again, once fixed, still registers.
                event.target.value = ''
                // `accept` only filters the picker, which can be switched to all files.
                // By name, since Excel on Windows labels a .csv as a spreadsheet type.
                if (picked && !picked.name.toLowerCase().endsWith('.csv')) {
                  setFile(null)
                  setProblems((current) => ({ ...current, file: NOT_CSV }))
                  return
                }
                setFile(picked)
                setProblems((current) => {
                  const next = { ...current }
                  delete next.file
                  return next
                })
              }}
            />
            <p
              id={fileHintId}
              role={problems.file ? 'alert' : undefined}
              className={`mt-2 text-xs leading-[150%] ${problems.file ? 'text-status-red' : 'text-slate'}`}
            >
              {problems.file ??
                'A CSV with a phone column, area code included, and an optional name column. Up to 1,000 rows and 1 MB.'}
            </p>
            <a
              href="/leads-template.csv"
              download
              className="mt-1 inline-block text-xs font-medium text-navy underline hover:text-black"
            >
              Download template
            </a>
          </div>

          <LeadCampaignSelect
            campaigns={campaigns}
            value={campaignId}
            onChange={setCampaignId}
            error={problems.campaign_id}
          />
        </form>
      )}
    </Dialog>
  )
}
