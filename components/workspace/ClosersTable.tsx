'use client'

import { useState } from 'react'
import Radio from '@mui/material/Radio'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import { Search } from 'lucide-react'
import { useCurrentUser } from '@/components/auth/CurrentUserProvider'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import type { AvailableCloserItem } from '@/lib/transfers'

const STATUS_LABEL: Record<AvailableCloserItem['status'], string> = {
  available: 'Available',
  on_call: 'On Call',
}

const STATUS_TONE: Record<AvailableCloserItem['status'], 'done' | 'caution'> = {
  available: 'done',
  on_call: 'caution',
}

/**
 * Same radio sizing as UserFormDialog — MUI's default padding sits wrong
 * beside a 20px table row label.
 */
const RADIO_SX = {
  p: 0,
  '& .MuiSvgIcon-root': { fontSize: 18 },
} as const

const ALL_TEAMS = 'all'

type TeamOption = { id: string; name: string }

/** The teams that have closers: the user's own first, then the rest by name. */
function teamsOf(closers: AvailableCloserItem[], ownTeamId: string | null): TeamOption[] {
  const byId = new Map<string, string>()
  for (const closer of closers) {
    if (closer.team_id) byId.set(closer.team_id, closer.team_name ?? 'Team')
  }
  return [...byId]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => {
      if (a.id === ownTeamId) return -1
      if (b.id === ownTeamId) return 1
      return a.name.localeCompare(b.name)
    })
}

/**
 * Any closer on any team can be picked, on a call or not: the offer waits in
 * their queue. It opens on the user's own team; the Team switch shows another
 * team or all of them, and the search narrows by name. The picked closer stays
 * shown whatever the filters, so a save never names someone off screen.
 */
export function ClosersTable({
  closers,
  selectedUserId,
  onSelect,
  disabled = false,
}: {
  closers: AvailableCloserItem[]
  /** `null` until a closer is picked. */
  selectedUserId: string | null
  onSelect: (userId: string) => void
  disabled?: boolean
}) {
  const { user } = useCurrentUser()
  const ownTeamId = user?.team_id ?? null
  // Null until the user picks a team; until then, their own.
  const [teamChoice, setTeamChoice] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const teams = teamsOf(closers, ownTeamId)
  const ownHasClosers = teams.some((team) => team.id === ownTeamId)
  const chosenStillThere =
    teamChoice === ALL_TEAMS || teams.some((team) => team.id === teamChoice)
  const team =
    teamChoice !== null && chosenStillThere
      ? teamChoice
      : ownHasClosers && ownTeamId
        ? ownTeamId
        : ALL_TEAMS

  const needle = query.trim().toLowerCase()
  const shown = closers.filter(
    (closer) =>
      closer.user_id === selectedUserId ||
      ((team === ALL_TEAMS || closer.team_id === team) &&
        (!needle || closer.name.toLowerCase().includes(needle)))
  )
  const showTeam = team === ALL_TEAMS || new Set(shown.map((closer) => closer.team_id)).size > 1
  const columns = showTeam ? 4 : 3
  const emptyMessage = needle
    ? 'No closers match that name.'
    : team === ALL_TEAMS
      ? 'No closers right now.'
      : 'No closers on this team.'

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full max-w-[240px]">
          <Select
            label="Team"
            value={team}
            disabled={disabled}
            onChange={(event) => setTeamChoice(event.target.value)}
          >
            {teams.map((option) => (
              <option key={option.id} value={option.id}>
                {option.id === ownTeamId ? `${option.name} (your team)` : option.name}
              </option>
            ))}
            <option value={ALL_TEAMS}>All teams</option>
          </Select>
        </div>
        <div className="w-full max-w-[240px]">
          <Input
            aria-label="Search closers by name"
            placeholder="Search by name"
            value={query}
            disabled={disabled}
            onChange={(event) => setQuery(event.target.value)}
            startAdornment={<Search className="h-4 w-4 text-slate" strokeWidth={2} aria-hidden />}
          />
        </div>
      </div>

      <Table
        aria-label="Closers"
        // These rows are single-line, so Figma runs them at 16px vertical
        // padding (52px rows) instead of the 20px the two-line Queue rows take.
        sx={{ '& tbody td': { paddingTop: '16px', paddingBottom: '16px' } }}
      >
        <TableHead>
          <TableRow>
            <TableCell scope="col" padding="checkbox" />
            <TableCell scope="col">Name</TableCell>
            {showTeam && <TableCell scope="col">Team</TableCell>}
            <TableCell scope="col" align="right">
              Status
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {shown.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns} className="text-slate">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            shown.map((closer) => {
              const selected = selectedUserId === closer.user_id
              return (
                <TableRow
                  key={closer.user_id}
                  hover={!disabled}
                  selected={selected}
                  onClick={() => {
                    if (!disabled) onSelect(closer.user_id)
                  }}
                  sx={{
                    cursor: disabled ? 'default' : 'pointer',
                    ...(disabled ? { opacity: 0.72 } : undefined),
                  }}
                >
                  <TableCell padding="checkbox">
                    <Radio
                      size="small"
                      color="primary"
                      disableRipple
                      checked={selected}
                      disabled={disabled}
                      value={closer.user_id}
                      slotProps={{
                        input: {
                          'aria-label': `Transfer to ${closer.name}`,
                        },
                      }}
                      onChange={() => onSelect(closer.user_id)}
                      onClick={(event) => event.stopPropagation()}
                      sx={RADIO_SX}
                    />
                  </TableCell>
                  <TableCell>{closer.name}</TableCell>
                  {showTeam && <TableCell>{closer.team_name ?? '-'}</TableCell>}
                  <TableCell align="right">
                    <span className="inline-flex items-center gap-2">
                      {closer.waiting > 0 && (
                        <span className="text-xs text-slate">{closer.waiting} waiting</span>
                      )}
                      <Badge tone={STATUS_TONE[closer.status]}>{STATUS_LABEL[closer.status]}</Badge>
                    </span>
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}
