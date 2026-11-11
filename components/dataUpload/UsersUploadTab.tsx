'use client'

import { useMemo, useState } from 'react'
import { BadgeCheck, CircleX, Users, UserPlus, UserCheck, TriangleAlert } from 'lucide-react'
import { PolicyFileDrop } from '@/components/admin/PolicyFileDrop'
import {
  NOT_A_FILE,
  NoteList,
  ProblemList,
  TemplateLink,
  fileMessage,
  isSpreadsheet,
} from '@/components/dataUpload/UploadParts'
import { StatTile } from '@/components/fronter/StatTile'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { DataTable, type DataColumn } from '@/components/ui/DataTable'
import { Dialog } from '@/components/ui/Dialog'
import {
  UPLOAD_ROLE_LABEL,
  checkUsers,
  saveSpreadsheet,
  uploadUsers,
  type SignInDetails,
  type SignInFiles,
  type UserUploadCheck,
  type UserUploadRow,
} from '@/lib/dataImports'
import { withSession } from '@/lib/session'
import { tokens } from '@/lib/theme'

const PAGE_SIZE = 25

const STATUS: Record<UserUploadRow['status'], { label: string; tone: 'teal' | 'neutral' | 'red' }> = {
  new: { label: 'New', tone: 'teal' },
  exists: { label: 'Already there', tone: 'neutral' },
  problem: { label: 'Problem', tone: 'red' },
}

const ROW_COLUMNS: DataColumn<UserUploadRow>[] = [
  { id: 'row', header: 'Row', render: (row) => <span className="tabular-nums text-slate">{row.row}</span> },
  { id: 'team', header: 'Team', render: (row) => row.team },
  { id: 'name', header: 'Name', render: (row) => row.name },
  { id: 'role', header: 'Role', render: (row) => (row.role ? UPLOAD_ROLE_LABEL[row.role] : '') },
  {
    id: 'username',
    header: 'Username',
    render: (row) =>
      row.username ? (
        <span>
          <span className="font-mono text-[13px]">{row.username}</span>
          {row.username_made && <span className="ml-1 text-xs text-slate">(made from the name)</span>}
        </span>
      ) : (
        ''
      ),
  },
  {
    id: 'status',
    header: 'Status',
    render: (row) => <Badge tone={STATUS[row.status].tone}>{STATUS[row.status].label}</Badge>,
  },
]

const SIGN_IN_COLUMNS: DataColumn<SignInDetails>[] = [
  { id: 'team', header: 'Team', render: (u) => u.team },
  { id: 'name', header: 'Name', render: (u) => u.name },
  { id: 'role', header: 'Role', render: (u) => UPLOAD_ROLE_LABEL[u.role] },
  { id: 'username', header: 'Username', render: (u) => <span className="font-mono text-[13px]">{u.username}</span> },
  { id: 'password', header: 'Password', render: (u) => <span className="font-mono text-[13px]">{u.password}</span> },
]

function fileSlug(team: string): string {
  return team.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'team'
}

/** A sign-in list to share, with Excel downloads for every team or one. */
export function SignInList({
  users,
  files,
  title,
}: {
  users: SignInDetails[]
  files: SignInFiles
  title: string
}) {
  const teams = useMemo(() => [...new Set(users.map((u) => u.team))].sort(), [users])
  const [team, setTeam] = useState(teams[0] ?? '')
  return (
    <>
      <section className="flex items-start gap-3 rounded-xl border border-status-gold bg-[#FBF5E8] p-5">
        <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" color={tokens.status.gold} strokeWidth={2} aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-ink">These passwords are shown only now</h2>
          <p className="mt-1 text-sm leading-[150%] text-body-text">
            Download the list before you leave this page. Everyone chooses their own password the
            first time they sign in. If the list is lost, use New passwords on Past uploads.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="w-[220px]">
              <Button type="button" onClick={() => saveSpreadsheet(files.all_teams, 'sign-in-list.xlsx')}>
                Download sign-in list
              </Button>
            </div>
            {teams.length > 1 && (
              <>
                <span className="text-sm text-slate">or one team:</span>
                <select
                  value={team}
                  onChange={(event) => setTeam(event.target.value)}
                  aria-label="Team to download"
                  className="h-10 rounded-lg border border-slate/40 bg-white px-3 text-sm text-ink"
                >
                  {teams.map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </select>
                <div className="w-[200px]">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => saveSpreadsheet(files.teams[team], `sign-in-list-${fileSlug(team)}.xlsx`)}
                  >
                    Download one team
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </section>
      <DataTable
        title={title}
        ariaLabel="Usernames and passwords"
        rows={users}
        columns={SIGN_IN_COLUMNS}
        getRowId={(u) => u.username}
        emptyMessage="Nobody to list."
        pageSize={PAGE_SIZE}
      />
    </>
  )
}

type Checked = { check: UserUploadCheck; file: File }

export function UsersUploadTab() {
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [checked, setChecked] = useState<Checked | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState<{
    users: SignInDetails[]
    files: SignInFiles
    teams: number
    name: string
  } | null>(null)

  function pick(picked: File | null) {
    setFailure(null)
    if (picked && !isSpreadsheet(picked)) {
      setFile(null)
      setProblem(NOT_A_FILE)
      return
    }
    setFile(picked)
    setProblem(null)
    setChecked(null)
  }

  function check() {
    if (!file) return
    const sent = file
    setBusy(true)
    setProblem(null)
    setFailure(null)
    setDone(null)
    withSession((token) => checkUsers(sent, token))
      .then((result) => setChecked({ check: result, file: sent }))
      .catch((err) => {
        const message = fileMessage(err)
        if (message) setProblem(message)
        else setFailure('Could not check that file. Try again.')
      })
      .finally(() => setBusy(false))
  }

  function upload() {
    if (!checked) return
    setSaving(true)
    withSession((token) => uploadUsers(checked.file, token))
      .then((result) => {
        setDone({
          users: result.users,
          files: result.files,
          teams: Number(result.upload.summary.teams ?? 0),
          name: checked.file.name,
        })
        setChecked(null)
        setFile(null)
      })
      .catch((err) => {
        const message = fileMessage(err)
        setFailure(message ?? 'That did not save. Check the file again and retry.')
      })
      .finally(() => {
        setSaving(false)
        setConfirming(false)
      })
  }

  const summary = checked?.check.summary
  const blocked = !summary || summary.problems > 0 || summary.new_users === 0

  return (
    <div className="flex flex-col gap-5">
      {failure && <Alert>{failure}</Alert>}
      <section className="rounded-xl border-hairline border-slate bg-white p-5">
        <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b-hairline border-light-grey pb-3">
          <h2 className="text-base font-semibold leading-[120%] text-ink">Upload users</h2>
          <TemplateLink kind="users" />
        </header>
        <PolicyFileDrop
          file={file}
          hint="Team, Name, Role (Fronter, Closer or Team Admin) and an optional Username. Up to 500 rows and 1 MB."
          actionLabel="Check"
          busyLabel="Checking…"
          busy={busy}
          problem={problem}
          onPick={pick}
          onClear={() => {
            setFile(null)
            setChecked(null)
          }}
          onAction={check}
        />
      </section>

      {done && (
        <>
          <section className="flex items-start gap-3 rounded-xl border-hairline border-slate bg-white p-5" aria-live="polite">
            <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0" color={tokens.status.bayGreen} strokeWidth={2} aria-hidden />
            <div className="min-w-0">
              <h2 className="text-base font-semibold leading-[120%] text-ink">
                Imported {done.users.length.toLocaleString()} {done.users.length === 1 ? 'user' : 'users'}
                {done.teams > 0 && ` and ${done.teams} new ${done.teams === 1 ? 'team' : 'teams'}`}
              </h2>
              <p className="mt-1 text-sm leading-[150%] text-slate">From {done.name}.</p>
            </div>
          </section>
          <SignInList users={done.users} files={done.files} title="Sign-in details" />
        </>
      )}

      {checked && summary && (
        <>
          <section className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-base font-semibold leading-[120%] text-ink">Check</h2>
                <p className="mt-1 truncate text-sm text-slate">
                  {checked.file.name} · {summary.rows.toLocaleString()} {summary.rows === 1 ? 'row' : 'rows'} read.
                  Nothing is saved yet.
                </p>
              </div>
              <div className="w-[240px]">
                <Button type="button" size="small" disabled={blocked} onClick={() => setConfirming(true)}>
                  {summary.problems > 0
                    ? 'Fix the problems to import'
                    : summary.new_users === 0
                      ? 'Everyone is already there'
                      : `Import ${summary.new_users.toLocaleString()} ${summary.new_users === 1 ? 'user' : 'users'}`}
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatTile label="New teams" value={summary.new_teams} icon={<Users color={tokens.status.blue} aria-hidden />} />
              <StatTile label="New users" value={summary.new_users} icon={<UserPlus color={tokens.status.bayGreen} aria-hidden />} />
              <StatTile label="Already there" value={summary.existing} icon={<UserCheck color={tokens.slate} aria-hidden />} />
              <StatTile
                label="Problems"
                value={summary.problems}
                icon={<CircleX color={summary.problems > 0 ? tokens.status.red : tokens.slate} aria-hidden />}
              />
            </div>
          </section>
          <ProblemList problems={checked.check.problems} />
          <NoteList notes={checked.check.notes} />
          <DataTable
            title="Rows"
            ariaLabel="Each row of the file and what the import does with it"
            rows={checked.check.rows}
            columns={ROW_COLUMNS}
            getRowId={(row) => String(row.row)}
            emptyMessage="The file has no rows."
            pageSize={PAGE_SIZE}
          />
        </>
      )}

      <Dialog
        open={confirming}
        title="Import users"
        onClose={() => setConfirming(false)}
        busy={saving}
        actions={
          <div className="flex w-full gap-3">
            <Button type="button" variant="secondary" onClick={() => setConfirming(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={upload} isLoading={saving} loadingText="Importing…">
              Import
            </Button>
          </div>
        }
      >
        {summary && (
          <div className="space-y-2 text-sm leading-[150%] text-body-text">
            <p className="font-medium text-ink">
              Import {summary.new_users.toLocaleString()} {summary.new_users === 1 ? 'user' : 'users'}?
            </p>
            <p>
              Each gets a random password you&apos;ll see once on the next screen. People already there
              are skipped. The file is checked again as it saves.
            </p>
          </div>
        )}
      </Dialog>
    </div>
  )
}
