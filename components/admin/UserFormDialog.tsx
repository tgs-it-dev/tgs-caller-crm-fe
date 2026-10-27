'use client'

import { useId, useState, type FormEvent } from 'react'
import FormControlLabel from '@mui/material/FormControlLabel'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import { Eye, EyeOff } from 'lucide-react'
import { ResetPasswordFields, useResetPassword } from '@/components/admin/ResetPassword'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { RADIO_CONTROL_SX, RADIO_ROW_SX } from '@/components/ui/radio'
import { Select } from '@/components/ui/Select'
import { AuthError, isQaManager, isSuperAdmin, isTeamAdmin, type Role } from '@/lib/auth'
import { newPasswordProblem } from '@/lib/passwords'
import { withSession } from '@/lib/session'
import type { Team } from '@/lib/teams'
import {
  createUser,
  grantableRoles,
  roleLabel,
  updateUser,
  type User,
  type UserPatch,
} from '@/lib/users'

/** Copy for the codes whose own wording is written for an API, not a person. */
const FIELD_COPY: Record<string, string> = {
  'user.already_exists': 'That email address is already in use.',
  'user.unknown_roles': 'That is not a role this console can assign.',
  'user.team_required': 'Choose a team.',
  'team.super_admin_forbidden': 'Super Admin accounts are not assigned to a team.',
}

/**
 * How the new account gets a way in.
 *
 * `password` first because it is the one that works without a mail server
 * configured — an invitation nobody receives leaves an account that cannot be
 * signed into at all, since creation otherwise stores a password nobody holds.
 */
type SignInMethod = 'password' | 'invite'

function bannerFor(err: AuthError): string {
  if (err.code === 'user.cannot_demote_self') {
    return 'You cannot remove your own elevated role or deactivate yourself.'
  }
  if (err.code === 'user.grant_forbidden') {
    return 'You cannot grant that role, or assign it on another team.'
  }
  if (err.code === 'user.not_found') return 'That user no longer exists.'
  if (err.code === 'team.not_found') return 'That team no longer exists. Reload and try again.'
  if (err.code === 'team.super_admin_forbidden') {
    return 'Super Admin accounts are not assigned to a team.'
  }
  if (err.status === 403) {
    return 'You cannot grant that role, or you no longer have access to user administration.'
  }
  if (err.status === 401) return 'Your session has ended. Please sign in again.'
  return err.message
}

const sameRoles = (a: Role[], b: Role[]) =>
  a.length === b.length && a.every((role) => b.includes(role))

export function UserFormDialog({
  user,
  actorRoles,
  isSelf,
  teams,
  onClose,
  onSaved,
}: {
  /** The user being edited, or null to add one. */
  user: User | null
  /** Signed-in roles — Super Admin, Team Admin and QA Manager get different ceilings. */
  actorRoles: Role[]
  /** This is the signed-in admin's own account. */
  isSelf: boolean
  /**
   * Company team catalogue. Super Admin must pick one when creating (except for
   * a super_admin account) and may change it when editing; Team Admin and QA
   * Manager leave `team_id` out and the API pins the account to their own team.
   */
  teams: Team[]
  onClose: () => void
  onSaved: () => void
}) {
  const formId = useId()
  const offerable = grantableRoles(actorRoles)
  const canPickTeam = isSuperAdmin(actorRoles)
  const startingTeam = user?.team_id ?? ''
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  // Keep the full set so an edit cannot strip roles the actor is not allowed
  // to grant (those checkboxes are simply not offered).
  const [roles, setRoles] = useState<Role[]>(user?.roles ?? [])
  const [active, setActive] = useState(user?.active ?? true)
  const [teamId, setTeamId] = useState(startingTeam)
  // SA: team required for every role except super_admin (API: team.super_admin_forbidden).
  const creatingSuperAdmin = !user && roles.includes('super_admin')
  const showTeamField = canPickTeam && !creatingSuperAdmin
  const mustPickTeam = !user && showTeamField
  const [signIn, setSignIn] = useState<SignInMethod>('password')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [problems, setProblems] = useState<Record<string, string>>({})
  const [banner, setBanner] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  // A Super Admin editing someone can switch this dialog to set their password.
  const canResetPassword = Boolean(user) && canPickTeam
  const resetFormId = useId()
  const [view, setView] = useState<'edit' | 'reset'>('edit')
  const [passwordReset, setPasswordReset] = useState(false)
  const reset = useResetPassword(user?.id ?? null, () => {
    setPasswordReset(true)
    setView('edit')
  })

  function roleLocked(role: Role): boolean {
    // Only lock the elevated role the actor themselves holds — SA ≠ Team Admin ≠ QA Manager.
    if (!isSelf) return false
    if (role === 'super_admin') return isSuperAdmin(actorRoles)
    if (role === 'administrator') return isTeamAdmin(actorRoles)
    if (role === 'qa_manager') return isQaManager(actorRoles)
    return false
  }

  /** What can be answered without asking the server. */
  function checkHere(): Record<string, string> {
    const found: Record<string, string> = {}
    if (!name.trim()) found.name = 'Enter a name.'
    if (roles.length === 0) found.roles = 'Choose at least one role.'
    if (!user && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      found.email = 'Enter a valid email address.'
    }
    // Super Admin must name the team on create; Team Admin may omit it.
    if (mustPickTeam && !teamId) found.team_id = 'Choose a team.'
    // Keyed `password` so its own 422 lands on this same input.
    if (!user && signIn === 'password') {
      const problem = newPasswordProblem(password)
      if (problem) found.password = problem
    }
    return found
  }

  /** Put the server's answer where it belongs: on the input it names, or up top. */
  function showFailure(err: unknown) {
    if (!(err instanceof AuthError)) {
      setBanner('Something went wrong. Please try again.')
      return
    }
    const named = err.fields.filter((field) => field.field)
    if (named.length > 0) {
      setProblems(
        Object.fromEntries(
          named.map((field) => [field.field as string, FIELD_COPY[err.code] ?? field.message])
        )
      )
      return
    }
    setBanner(bannerFor(err))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const found = checkHere()
    setProblems(found)
    setBanner(null)
    if (Object.keys(found).length > 0) return

    setSaving(true)
    try {
      if (user) {
        // Only what moved: every field of the patch is optional to the API.
        const patch: UserPatch = {}
        if (name !== user.name) patch.name = name
        if (!sameRoles(roles, user.roles)) patch.roles = roles
        if (active !== user.active) patch.active = active
        if (showTeamField && teamId && teamId !== startingTeam) patch.team_id = teamId
        if (Object.keys(patch).length > 0) {
          await withSession((token) => updateUser(user.id, patch, token))
        }
      } else {
        // The key is left out entirely for an invitation, never sent empty: the
        // API validates `password` whenever it is present at all, so `''` would
        // be a 422 rather than "no password given". Same for team_id: Team Admin
        // and QA Manager omit it so the API pins their own team; Super Admin
        // must send one except when creating a super_admin (no team).
        await withSession((token) =>
          createUser(
            {
              email,
              name,
              roles,
              ...(signIn === 'password' ? { password } : {}),
              ...(mustPickTeam ? { team_id: teamId } : {}),
            },
            token
          )
        )
      }
      // Left saving: the list closes this dialog once it has reloaded.
      onSaved()
    } catch (err) {
      showFailure(err)
      setSaving(false)
    }
  }

  const toggleRole = (role: Role) => {
    if (!offerable.includes(role) || roleLocked(role)) return
    setRoles((held) => {
      const next = held.includes(role) ? held.filter((r) => r !== role) : [...held, role]
      // Super Admin is company-wide: selecting it drops a team pin and any
      // team-scoped roles that would otherwise demand one.
      if (next.includes('super_admin') && role === 'super_admin') {
        setTeamId('')
        return ['super_admin']
      }
      if (role !== 'super_admin' && next.includes('super_admin')) {
        return next.filter((r) => r !== 'super_admin')
      }
      return next
    })
  }

  const movingTo =
    user && teamId !== startingTeam ? teams.find((team) => team.id === teamId) : undefined
  const resetting = view === 'reset' && canResetPassword ? user : null

  return (
    <Dialog
      open
      title={resetting ? `Reset password for ${resetting.name}` : user ? 'Edit user' : 'Add user'}
      onClose={onClose}
      busy={saving || reset.saving}
      actions={
        resetting ? (
          <div className="flex w-full gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                reset.clear()
                setView('edit')
              }}
              disabled={reset.saving}
            >
              Back
            </Button>
            <Button
              type="submit"
              form={resetFormId}
              isLoading={reset.saving}
              loadingText="Saving…"
            >
              Reset password
            </Button>
          </div>
        ) : (
          <div className="flex w-full gap-3">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="submit"
              form={formId}
              isLoading={saving}
              loadingText={user ? 'Saving…' : 'Creating…'}
            >
              {user ? 'Save changes' : 'Create user'}
            </Button>
          </div>
        )
      }
    >
      {resetting ? (
        <ResetPasswordFields formId={resetFormId} reset={reset} />
      ) : (
        <form id={formId} onSubmit={submit} noValidate className="space-y-5 pt-1">
          {banner && <Alert>{banner}</Alert>}

          <Input
            label="Name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            error={Boolean(problems.name)}
            helperText={problems.name}
            autoFocus
          />

          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            // The API has no way to change an address once it is set.
            disabled={Boolean(user)}
            error={Boolean(problems.email)}
            helperText={
              problems.email ?? (user ? 'An email address cannot be changed.' : undefined)
            }
          />

          {showTeamField && (
            <div>
              <Select
                label="Team"
                value={teamId}
                onChange={(event) => setTeamId(event.target.value)}
                required={!user}
              >
                {/* Someone already on a team can be moved, not taken off it. */}
                {!startingTeam && <option value="">Select a team</option>}
                {[...teams]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
              </Select>
              {problems.team_id && (
                <p role="alert" className="mt-2 text-xs leading-[150%] text-status-red">
                  {problems.team_id}
                </p>
              )}
              {movingTo && (
                <p className="mt-2 text-xs leading-[150%] text-slate">
                  After you save, they will only see {movingTo.name}&apos;s leads and calls.{' '}
                  <strong>
                    If they are on a call right now, have them record its outcome first. They
                    cannot do it after the move.
                  </strong>
                </p>
              )}
            </div>
          )}
          {canPickTeam && creatingSuperAdmin && (
            <p className="text-xs leading-[150%] text-slate">
              Super Admin accounts are not assigned to a team.
            </p>
          )}

          {!user && (
            <fieldset>
              <legend className="mb-3 text-sm font-medium text-black">
                How will they sign in?
              </legend>
              <RadioGroup
                value={signIn}
                onChange={(event) => setSignIn(event.target.value as SignInMethod)}
                className="flex flex-col items-start gap-2"
              >
                <FormControlLabel
                  value="password"
                  sx={RADIO_ROW_SX}
                  control={<Radio size="small" disableRipple sx={RADIO_CONTROL_SX} />}
                  label="Set a password now"
                />
                <FormControlLabel
                  value="invite"
                  sx={RADIO_ROW_SX}
                  control={<Radio size="small" disableRipple sx={RADIO_CONTROL_SX} />}
                  label="Email an invitation link"
                />
              </RadioGroup>

              {signIn === 'password' ? (
                <div className="mt-4 space-y-2">
                  <Input
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    error={Boolean(problems.password)}
                    helperText={problems.password ?? 'At least 8 characters.'}
                    endAdornment={
                      <button
                        type="button"
                        onClick={() => setShowPassword((shown) => !shown)}
                        className="text-slate transition-colors hover:text-ink"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? (
                          <EyeOff className="h-5 w-5" strokeWidth={2} aria-hidden />
                        ) : (
                          <Eye className="h-5 w-5" strokeWidth={2} aria-hidden />
                        )}
                      </button>
                    }
                  />
                  <p className="text-xs leading-[150%] text-slate">
                    Tell them this password yourself. They can change it later in Settings.
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-xs leading-[150%] text-slate">
                  They will be emailed a link and choose their own password, which nobody else
                  ever sees. This needs email delivery configured. Until it is, no link is sent
                  and they will not be able to sign in.
                </p>
              )}
            </fieldset>
          )}

          <fieldset>
            <legend className="mb-3 text-sm font-medium text-black">Roles</legend>
            {/* A column: each control is an inline-flex label, so they would
                otherwise run together on one line. */}
            <div className="flex flex-col items-start gap-2">
              {offerable.map((role) => (
                <Checkbox
                  key={role}
                  label={roleLabel(role)}
                  checked={roles.includes(role)}
                  onChange={() => toggleRole(role)}
                  disabled={roleLocked(role)}
                />
              ))}
            </div>
            {isSelf && isTeamAdmin(actorRoles) && !isSuperAdmin(actorRoles) && (
              <p className="mt-2 text-xs leading-[150%] text-slate">
                You cannot remove your own Team Admin role.
              </p>
            )}
            {isSelf && isQaManager(actorRoles) && !isSuperAdmin(actorRoles) && (
              <p className="mt-2 text-xs leading-[150%] text-slate">
                You cannot remove your own QA Manager role.
              </p>
            )}
            {isSelf && isSuperAdmin(actorRoles) && (
              <p className="mt-2 text-xs leading-[150%] text-slate">
                You cannot remove your own Super Admin role.
              </p>
            )}
            {problems.roles && (
              <p role="alert" className="mt-2 text-xs leading-[150%] text-status-red">
                {problems.roles}
              </p>
            )}
          </fieldset>

          {user && (
            <div>
              <Checkbox
                label="Active"
                checked={active}
                onChange={(event) => setActive(event.target.checked)}
                disabled={isSelf}
              />
              <p className="mt-2 text-xs leading-[150%] text-slate">
                {isSelf
                  ? 'You cannot deactivate yourself.'
                  : 'Deactivating signs this person out and stops them signing back in.'}
              </p>
            </div>
          )}

          {canResetPassword && (
            <div className="border-t-hairline border-light-grey pt-4">
              <p className="text-sm font-medium text-black">Password</p>
              <p className="mt-1 text-xs leading-[150%] text-slate">
                Set a new one and tell them yourself. Every session they have ends.
              </p>
              {passwordReset && (
                <p role="status" className="mt-2 text-xs leading-[150%] text-status-green">
                  Password reset. Tell {user?.name} the new one.
                </p>
              )}
              <div className="mt-3 w-[180px]">
                <Button
                  type="button"
                  variant="secondary"
                  size="small"
                  onClick={() => setView('reset')}
                  disabled={saving}
                >
                  Reset password…
                </Button>
              </div>
            </div>
          )}
        </form>
      )}
    </Dialog>
  )
}
