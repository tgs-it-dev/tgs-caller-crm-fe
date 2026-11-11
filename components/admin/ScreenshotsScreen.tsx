'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import MuiButton from '@mui/material/Button'
import { DateRangePicker } from '@/components/admin/DateRangePicker'
import { Alert } from '@/components/ui/Alert'
import { DataTable, type DataColumn } from '@/components/ui/DataTable'
import { PageShell } from '@/components/ui/PageShell'
import { Select } from '@/components/ui/Select'
import { AuthError, isSuperAdmin } from '@/lib/auth'
import { formatDateTime } from '@/lib/format'
import { waitForMocking } from '@/lib/mockReady'
import { businessDay, monthToDate, type DateRange } from '@/lib/reporting'
import {
  callIdOf,
  listScreenshots,
  pageName,
  type ScreenshotItem,
  type ScreenshotList,
} from '@/lib/screenshots'
import { withSession } from '@/lib/session'
import { listTeams, type Team } from '@/lib/teams'
import { listUsers, roleLabel, type User } from '@/lib/users'

const PAGE_SIZE = 20

type Selection = { range: DateRange; teamId: string; userId: string; offset: number }

type Load =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; page: ScreenshotList }

function messageFor(err: unknown): string {
  if (err instanceof AuthError && err.status === 403)
    return 'You no longer have access to the screenshot log.'
  if (err instanceof AuthError && err.status === 401)
    return 'Your session has ended. Please sign in again.'
  return 'Could not load the screenshots for these dates.'
}

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name)

const COLUMNS: DataColumn<ScreenshotItem>[] = [
  {
    id: 'when',
    header: 'When',
    render: (item) => <span className="whitespace-nowrap">{formatDateTime(item.taken_at)}</span>,
  },
  {
    id: 'person',
    header: 'Person',
    render: (item) => (
      <span className="whitespace-nowrap">
        <span className="font-medium text-ink">{item.name}</span>{' '}
        <span className="text-slate">{item.username}</span>
      </span>
    ),
  },
  { id: 'team', header: 'Team', render: (item) => item.team_name ?? '-' },
  { id: 'role', header: 'Role', render: (item) => item.roles.map(roleLabel).join(', ') },
  {
    id: 'page',
    header: 'Page',
    render: (item) => {
      // The path is whatever the browser sent, so it's only ever shown as text.
      // The link is built from the call id alone.
      const callId = callIdOf(item.page)
      return (
        <span className="flex items-center gap-3 whitespace-nowrap">
          <span title={item.page}>{pageName(item.page)}</span>
          {callId && (
            <MuiButton
              component={Link}
              href={`/admin/interactions/?id=${encodeURIComponent(callId)}&from=screenshots`}
              variant="text"
              size="small"
            >
              View call details
            </MuiButton>
          )}
        </span>
      )
    },
  },
]

/**
 * Each Print Screen pressed by anyone but a Super Admin, newest first. Only the
 * press is known: Windows takes the image before the page hears the key.
 */
export function ScreenshotsScreen() {
  const [selected, setSelected] = useState<Selection>(() => ({
    range: monthToDate(),
    teamId: '',
    userId: '',
    offset: 0,
  }))
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  const [teams, setTeams] = useState<Team[]>([])
  const [people, setPeople] = useState<User[]>([])

  /** Another filter or page. The rows on screen answered the old one. */
  const choose = (next: Partial<Selection>) => {
    setSelected((current) => ({ ...current, offset: 0, ...next }))
    setLoad({ status: 'loading' })
  }

  useEffect(() => {
    let cancelled = false
    waitForMocking()
      .then(() => withSession((token) => Promise.all([listTeams(token), listUsers(token)])))
      .then(([teamList, userList]) => {
        if (cancelled) return
        setTeams([...teamList.items].sort(byName))
        // A Super Admin is never recorded, so never a choice.
        setPeople(userList.items.filter((person) => !isSuperAdmin(person.roles)).sort(byName))
      })
      // Without the lists the filters offer everyone only, and the page still works.
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const { range, teamId, userId, offset } = selected
    waitForMocking()
      .then(() =>
        withSession((token) =>
          listScreenshots(
            range,
            { teamId: teamId || null, userId: userId || null, limit: PAGE_SIZE, offset },
            token
          )
        )
      )
      .then((page) => {
        if (!cancelled) setLoad({ status: 'ready', page })
      })
      .catch((err) => {
        if (!cancelled) setLoad({ status: 'error', message: messageFor(err) })
      })
    return () => {
      cancelled = true
    }
  }, [selected])

  const page = load.status === 'ready' ? load.page : null
  const onTeam = people.filter((person) => !selected.teamId || person.team_id === selected.teamId)
  const count = page ? `${page.total} ${page.total === 1 ? 'screenshot' : 'screenshots'}` : 'Screenshots'

  return (
    <PageShell title="Screenshots">
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        {load.status === 'error' && <Alert>{load.message}</Alert>}
        <DataTable
          title={count}
          ariaLabel="Screenshots"
          toolbar={
            <div className="flex flex-col gap-3">
              <p className="text-sm leading-[150%] text-slate">
                Each time someone other than a Super Admin pressed Print Screen. The image itself
                never reaches the CRM.
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <div className="w-[200px]">
                  <Select
                    label="Team"
                    value={selected.teamId}
                    onChange={(event) => {
                      const teamId = event.target.value
                      const stays = people.some(
                        (person) => person.id === selected.userId && person.team_id === teamId
                      )
                      choose({ teamId, userId: !teamId || stays ? selected.userId : '' })
                    }}
                  >
                    <option value="">All teams</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="w-[220px]">
                  <Select
                    label="Person"
                    value={selected.userId}
                    onChange={(event) => choose({ userId: event.target.value })}
                  >
                    <option value="">Everyone</option>
                    {onTeam.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <DateRangePicker
                  range={selected.range}
                  max={businessDay(new Date(), page?.timezone)}
                  onChange={(range) => choose({ range })}
                />
              </div>
            </div>
          }
          rows={page?.items ?? []}
          columns={COLUMNS}
          getRowId={(item) => item.id}
          emptyMessage={load.status === 'loading' ? 'Loading…' : 'No screenshots in these dates.'}
          paginate={false}
          paging={
            page
              ? {
                  total: page.total,
                  limit: page.limit,
                  offset: page.offset,
                  onOffsetChange: (offset) => {
                    setSelected((current) => ({ ...current, offset }))
                    setLoad({ status: 'loading' })
                  },
                }
              : undefined
          }
          minWidth="max-content"
        />
      </div>
    </PageShell>
  )
}
