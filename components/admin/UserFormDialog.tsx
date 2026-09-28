'use client'

import { useId, useState, type FormEvent } from 'react'
import FormControlLabel from '@mui/material/FormControlLabel'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import { Eye, EyeOff } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { AuthError, type Role } from '@/lib/auth'
import { withSession } from '@/lib/session'
import {
  ASSIGNABLE_ROLES,
  createUser,
  roleLabel,
  updateUser,
  type User,
  type UserPatch,
} from '@/lib/users'

/** Copy for the codes whose own wording is written for an API, not a person. */
const FIELD_COPY: Record<string, string> = {
  'user.already_exists': 'That email address is already in use.',
  'user.unknown_roles': 'That is not a role this console can assign.',
}

// The API's ceiling is bcrypt's, and it counts bytes rather than characters:
// one emoji is four of them, so a passphrase can pass a length check here and
// still be refused there. Same rule as the set-password screen.
const MAX_PASSWORD_BYTES = 72

/**
 * How the new account gets a way in.
 *
 * `password` first because it is the one that works without a mail server
 * configured — an invitation nobody receives leaves an account that cannot be
 * signed into at all, since creation otherwise stores a password nobody holds.
 */
type SignInMethod = 'password' | 'invite'

/** Mirrors components/ui/Checkbox so the radio rows line up with the role list. */
const RADIO_ROW_SX = {
  m: 0,
  gap: 1.25,
  alignItems: 'flex-start',
  '& .MuiFormControlLabel-label': { fontSize: '0.875rem', lineHeight: '20px' },
} as const

/**
 * What the theme already does for MuiCheckbox, which has no MuiRadio twin.
 *
 * Left at MUI's defaults a radio carries 9px of padding around a 24px glyph, so
 * beside a themed 18px checkbox it reads as a different control — and against a
 * 20px line the extra padding drops its centre 11px below its own label. Set
 * here rather than in the theme because the qualification checklist's radios are
 * not ours to restyle.
 */
const RADIO_CONTROL_SX = {
  mt: '2px',
  p: 0,
  '& .MuiSvgIcon-root': { fontSize: 18 },
} as const

function bannerFor(err: AuthError): string {
  if (err.code === 'user.cannot_demote_self') {
    return 'You cannot remove your own administrator role or deactivate yourself.'
  }
  if (err.code === 'user.not_found') return 'That user no longer exists.'
  if (err.status === 403) return 'You no longer have access to user administration.'
  if (err.status === 401) return 'Your session has ended. Please sign in again.'
  return err.message
}

const sameRoles = (a: Role[], b: Role[]) =>
  a.length === b.length && a.every((role) => b.includes(role))

export function UserFormDialog({
  user,
  isSelf,
  onClose,
  onSaved,
}: {
  /** The user being edited, or null to add one. */
  user: User | null
  /** This is the signed-in administrator's own account. */
  isSelf: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const formId = useId()
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [roles, setRoles] = useState<Role[]>(user?.roles ?? [])
  const [active, setActive] = useState(user?.active ?? true)
  const [signIn, setSignIn] = useState<SignInMethod>('password')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [problems, setProblems] = useState<Record<string, string>>({})
  const [banner, setBanner] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  /** What can be answered without asking the server. */
  function checkHere(): Record<string, string> {
    const found: Record<string, string> = {}
    if (!name.trim()) found.name = 'Enter a name.'
    if (roles.length === 0) found.roles = 'Choose at least one role.'
    if (!user && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      found.email = 'Enter a valid email address.'
    }
    // Characters for the floor and bytes for the ceiling, as the API counts
    // them. Keyed `password` so its own 422 lands on this same input.
    if (!user && signIn === 'password') {
      if (password.length < 8) {
        found.password = 'Use at least 8 characters.'
      } else if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) {
        found.password = 'That password is too long. Please choose a shorter one.'
      }
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
        if (Object.keys(patch).length > 0) {
          await withSession((token) => updateUser(user.id, patch, token))
        }
      } else {
        // The key is left out entirely for an invitation, never sent empty: the
        // API validates `password` whenever it is present at all, so `''` would
        // be a 422 rather than "no password given".
        await withSession((token) =>
          createUser(
            { email, name, roles, ...(signIn === 'password' ? { password } : {}) },
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

  const toggleRole = (role: Role) =>
    setRoles((held) => (held.includes(role) ? held.filter((r) => r !== role) : [...held, role]))

  return (
    <Dialog
      open
      title={user ? 'Edit user' : 'Add user'}
      onClose={onClose}
      busy={saving}
      actions={
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
      }
    >
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
          helperText={problems.email ?? (user ? 'An email address cannot be changed.' : undefined)}
        />

        {!user && (
          <fieldset>
            <legend className="mb-3 text-sm font-medium text-black">How will they sign in?</legend>
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
                  Tell them this password yourself. They can change it later from the sign-in page.
                </p>
              </div>
            ) : (
              <p className="mt-3 text-xs leading-[150%] text-slate">
                They will be emailed a link and choose their own password, which nobody else ever
                sees. This needs email delivery configured — until it is, no link is sent and they
                will not be able to sign in.
              </p>
            )}
          </fieldset>
        )}

        <fieldset>
          <legend className="mb-3 text-sm font-medium text-black">Roles</legend>
          {/* A column: each control is an inline-flex label, so they would
              otherwise run together on one line. */}
          <div className="flex flex-col items-start gap-2">
            {ASSIGNABLE_ROLES.map((role) => (
              <Checkbox
                key={role}
                label={roleLabel(role)}
                checked={roles.includes(role)}
                onChange={() => toggleRole(role)}
                // The API refuses to let an administrator drop their own role.
                disabled={isSelf && role === 'administrator'}
              />
            ))}
          </div>
          {isSelf && (
            <p className="mt-2 text-xs leading-[150%] text-slate">
              You cannot remove your own administrator role.
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
      </form>
    </Dialog>
  )
}
