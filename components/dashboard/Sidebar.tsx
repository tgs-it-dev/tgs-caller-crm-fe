'use client'

import { useEffect, useMemo, useState, type ComponentType, type SVGProps } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import MuiMenu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import {
  Bell,
  ChartLine,
  Check,
  ChevronDown,
  Headset,
  ListOrdered,
  LogOut,
  Menu,
  Phone,
  PhoneIncoming,
  Shield,
} from 'lucide-react'
import { useCurrentUser } from '@/components/auth/CurrentUserProvider'
import {
  deskLabelForRole,
  deskRoleFromPath,
  formatRolesLabel,
  heldDesks,
  initialsFromName,
  primaryRole,
  readToken,
  type Role,
} from '@/lib/auth'
import { waitForMocking } from '@/lib/mockReady'
import { listQueue } from '@/lib/queue'
import { roleLabel } from '@/lib/users'
import { OutlineIcon } from '../icons/OutlineIcon'

/** Nav Lucide icons — size via className so flex can't fight an inline lock. */
const NAV_ICON = {
  strokeWidth: 2,
  'aria-hidden': true,
  className: 'h-6 w-6 shrink-0',
} as const satisfies SVGProps<SVGSVGElement> & { strokeWidth: number }

function PhoneIcon() {
  return <Phone {...NAV_ICON} />
}

function QueueIcon() {
  return <ListOrdered {...NAV_ICON} />
}

function StatsIcon() {
  return <ChartLine {...NAV_ICON} />
}

function BellIcon() {
  return <Bell {...NAV_ICON} />
}

function SignOutIcon() {
  return <LogOut {...NAV_ICON} />
}

function MenuIcon() {
  return <Menu {...NAV_ICON} />
}

/**
 * Desk-menu icons, which are not nav icons.
 *
 * NAV_ICON's 24px belongs to a nav row; these sit in a menu line beside a 16px
 * tick and 14px text, so they carry their own size.
 */
const DESK_ICON_PROPS = {
  strokeWidth: 2,
  'aria-hidden': true,
  className: 'h-[18px] w-[18px] shrink-0',
} as const satisfies SVGProps<SVGSVGElement> & { strokeWidth: number }

function FronterDeskIcon() {
  return <Headset {...DESK_ICON_PROPS} />
}

function CloserDeskIcon() {
  return <PhoneIncoming {...DESK_ICON_PROPS} />
}

function AdminDeskIcon() {
  return <Shield {...DESK_ICON_PROPS} />
}

function DashboardIcon() {
  return (
    <OutlineIcon>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </OutlineIcon>
  )
}

function ReportsIcon() {
  return (
    <OutlineIcon>
      <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" />
      <path d="M14 3v5h5M9 17v-1M12 17v-5M15 17v-3" />
    </OutlineIcon>
  )
}

function ExceptionsIcon() {
  return (
    <OutlineIcon>
      <path d="M10.3 4.2L2.6 17.5a2 2 0 001.7 3h15.4a2 2 0 001.7-3L13.7 4.2a2 2 0 00-3.4 0z" />
      <path d="M12 9.5v4M12 17h.01" />
    </OutlineIcon>
  )
}

function UsersIcon() {
  return (
    <OutlineIcon>
      <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </OutlineIcon>
  )
}

type NavItem = {
  href: string
  label: string
  icon: ComponentType
  isActive: (pathname: string) => boolean
}

const BASE_PATH: Record<Role, string> = {
  fronter: '/fronter',
  closer: '/closer',
  administrator: '/admin',
}

/** One icon per desk, for the menu's rows. */
const DESK_ICON: Record<Role, ComponentType> = {
  fronter: FronterDeskIcon,
  closer: CloserDeskIcon,
  administrator: AdminDeskIcon,
}

const ADMIN_NAV: NavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: DashboardIcon, isActive: (p) => p === '/admin' },
  {
    href: '/admin/reports',
    label: 'Reports',
    icon: ReportsIcon,
    isActive: (p) => p.startsWith('/admin/reports'),
  },
  {
    href: '/admin/exceptions',
    label: 'Exceptions',
    icon: ExceptionsIcon,
    // Interaction detail is a shared screen with no section of its own, and
    // the queue is the only way into it today — so the nav keeps saying where
    // the reader came from. The ticket that adds the funnel's list has a second
    // way in, and has to decide this properly then.
    isActive: (p) => p.startsWith('/admin/exceptions') || p.startsWith('/admin/interactions'),
  },
  {
    href: '/admin/users',
    label: 'Users',
    icon: UsersIcon,
    isActive: (p) => p.startsWith('/admin/users'),
  },
]

/** `trailingSlash: true` makes usePathname() return `/fronter/`; nav hrefs stay `/fronter`. */
function normalizePath(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
}

function deskNav(role: 'fronter' | 'closer', activeCallHref: string): NavItem[] {
  const base = BASE_PATH[role]
  const workspace = `${base}/workspace`
  const queue = role === 'closer' ? `${base}/queue` : base
  return [
    {
      href: activeCallHref,
      label: 'Active Call',
      icon: PhoneIcon,
      // A closer's Active Call is the desk itself; a fronter's is always a workspace.
      isActive: (p) => p.startsWith(workspace) || (role === 'closer' && p === base),
    },
    { href: queue, label: 'Queue', icon: QueueIcon, isActive: (p) => p === queue },
    {
      href: `${base}/stats`,
      label: 'My Stats',
      icon: StatsIcon,
      isActive: (p) => p.startsWith(`${base}/stats`),
    },
  ]
}

function UserIdentitySkeleton({ lines = 2 }: { lines?: 2 | 3 }) {
  return (
    <div className="min-w-0 flex-1 space-y-1.5" aria-hidden>
      <div className="h-4 w-24 animate-pulse rounded bg-slate/20" />
      <div className="h-3 w-32 animate-pulse rounded bg-slate/15" />
      {lines === 3 && <div className="h-3 w-28 animate-pulse rounded bg-slate/10" />}
    </div>
  )
}

function Avatar({ name }: { name?: string }) {
  return (
    <div
      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-slate/20 text-xs font-semibold text-ink"
      aria-hidden
    >
      {name ? initialsFromName(name) : null}
    </div>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, status: userStatus, signOut } = useCurrentUser()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  // The element the desk menu hangs off, and whether it is open — MUI wants the
  // node itself, which is why this is not a boolean.
  const [deskMenuAnchor, setDeskMenuAnchor] = useState<HTMLElement | null>(null)
  const [fallbackActiveId, setFallbackActiveId] = useState<string | null>(null)
  const [activeTransferId, setActiveTransferId] = useState<string | null>(null)
  const userReady = userStatus === 'ready' && user != null

  // Desk from the URL when under a role segment; otherwise primary role from `/auth/me`.
  const role: Role =
    deskRoleFromPath(pathname) ?? (userReady ? primaryRole(user.roles) : null) ?? 'fronter'

  const basePath = BASE_PATH[role]
  const workspacePathPrefix = `${basePath}/workspace`

  const workspaceIdFromPath = useMemo(() => {
    const match = pathname.match(new RegExp(`^${workspacePathPrefix}/([^/]+)`))
    return match?.[1] ?? null
  }, [pathname, workspacePathPrefix])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const transferId = new URLSearchParams(window.location.search).get('transferId')

    if (workspaceIdFromPath) {
      setFallbackActiveId(workspaceIdFromPath)
      // Always sync from the query — clearing when absent avoids pairing a
      // new interaction id with a stale transferId from a prior workspace.
      setActiveTransferId(transferId)
      return
    }

    // Only a fronter resolves a live interaction: a closer's Active Call is
    // /closer itself, and an administrator has no desk.
    if (role !== 'fronter') {
      setFallbackActiveId(null)
      setActiveTransferId(null)
      return
    }

    let cancelled = false
    const token = readToken()
    if (!token) return

    waitForMocking()
      .then(() => listQueue(token, 'fronter', { bust: true }))
      .then((queue) => {
        if (cancelled) return
        setFallbackActiveId(queue[0]?.id ?? null)
        setActiveTransferId(null)
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [workspaceIdFromPath, role, pathname])

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  function handleSignOut() {
    signOut()
    router.push('/login')
  }

  // Closers keep fallbackActiveId null (Active Call = /closer) unless they
  // already opened a workspace; fronters may resolve a live interaction.
  const activeInteractionId = workspaceIdFromPath ?? fallbackActiveId
  const activeCallHref = activeInteractionId
    ? activeTransferId && role === 'closer'
      ? `${workspacePathPrefix}/${activeInteractionId}?transferId=${encodeURIComponent(activeTransferId)}`
      : `${workspacePathPrefix}/${activeInteractionId}`
    : basePath

  const navItems = role === 'administrator' ? ADMIN_NAV : deskNav(role, activeCallHref)

  // Somebody may hold more than one role, and the nav only ever shows the desk
  // they are on — so without a way across, the others are unreachable. One role
  // leaves the identity exactly as it was: nothing to choose, nothing to click.
  const desks = userReady ? heldDesks(user.roles) : []
  const canSwitch = desks.length > 1

  return (
    <>
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation"
        className="fixed left-4 top-4 z-30 flex h-9 w-9 items-center justify-center rounded-lg border border-slate/15 bg-white text-slate shadow-sm lg:hidden"
      >
        <MenuIcon />
      </button>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-ink/30 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-full flex-shrink-0 flex-col border-r border-slate/15 bg-white transition-transform duration-200 ease-in-out lg:static lg:z-auto lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } ${collapsed ? 'lg:w-16' : 'w-72 lg:w-72'}`}
      >
        <div
          className={`flex py-4 ${
            collapsed ? 'lg:flex-col lg:items-center lg:gap-2 lg:py-3 lg:px-2 px-4' : 'items-center gap-3 px-4'
          }`}
        >
          <button
            type="button"
            onClick={() => {
              // Closing here rather than in an effect on `collapsed`: the menu is
              // anchored to a node whose size changes under it.
              setDeskMenuAnchor(null)
              setCollapsed((prev) => !prev)
            }}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`hidden flex-shrink-0 items-center justify-center rounded-md p-1 text-slate hover:bg-slate/10 hover:text-ink lg:flex ${
              collapsed ? '' : 'order-last'
            }`}
          >
            <img
              src="/elements/collapse.png"
              alt=""
              aria-hidden
              className={`h-4 w-4 transition-transform ${collapsed ? 'rotate-180' : ''}`}
            />
          </button>

          {userReady && canSwitch ? (
            <button
              type="button"
              onClick={(event) => setDeskMenuAnchor(event.currentTarget)}
              aria-haspopup="menu"
              aria-expanded={Boolean(deskMenuAnchor)}
              // Collapsed there is no text at all, so these are the only things
              // saying what this opens — as on the nav rows beneath it.
              aria-label={collapsed ? `Switch desk, currently ${roleLabel(role)}` : undefined}
              title={collapsed ? `Switch desk, currently ${roleLabel(role)}` : undefined}
              className={`flex min-w-0 items-center gap-3 rounded-lg text-left transition hover:bg-slate/10 ${
                collapsed ? 'lg:p-1' : 'flex-1 p-1'
              }`}
            >
              <Avatar name={user.name} />
              {!collapsed && (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">
                      {user.name}
                    </span>
                    <span className="block truncate text-xs text-slate">
                      {deskLabelForRole(role)}
                    </span>
                  </span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-slate" strokeWidth={2} aria-hidden />
                </>
              )}
            </button>
          ) : (
            <>
              <Avatar name={userReady ? user.name : undefined} />
              {!collapsed &&
                (userReady ? (
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
                    <p className="truncate text-xs text-slate">{deskLabelForRole(role)}</p>
                  </div>
                ) : (
                  <UserIdentitySkeleton lines={2} />
                ))}
            </>
          )}
        </div>

        {/* Every desk they hold, not just the others — a list that leaves out
            where you are reads as somewhere to go rather than where you are. */}
        <MuiMenu
          anchorEl={deskMenuAnchor}
          open={Boolean(deskMenuAnchor)}
          onClose={() => setDeskMenuAnchor(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          slotProps={{
            paper: {
              sx: {
                minWidth: 208,
                borderRadius: '10px',
                border: '1px solid rgba(138,148,163,0.25)',
                boxShadow: '0 8px 24px rgba(28,36,48,0.12)',
              },
            },
          }}
        >
          {desks.map((desk) => {
            const Icon = DESK_ICON[desk]
            const current = desk === role
            return (
              <MenuItem
                key={desk}
                component={Link}
                href={BASE_PATH[desk]}
                selected={current}
                onClick={() => setDeskMenuAnchor(null)}
                sx={{ gap: 1.25, fontSize: '0.875rem', py: 1 }}
              >
                <span className="flex shrink-0 text-slate">
                  <Icon />
                </span>
                <span className={`flex-1 ${current ? 'font-semibold text-navy' : 'text-black'}`}>
                  {roleLabel(desk)}
                </span>
                {current && (
                  <Check className="h-4 w-4 shrink-0 text-navy" strokeWidth={2.5} aria-hidden />
                )}
              </MenuItem>
            )
          })}
        </MuiMenu>

        <nav className={`flex-1 space-y-1 py-4 ${collapsed ? 'lg:py-3 lg:px-2 px-3' : 'px-3'}`}>
          {navItems.map(({ href, label, icon: Icon, isActive }) => {
            const active = isActive(normalizePath(pathname))
            return (
              <Link
                key={label}
                href={href}
                title={collapsed ? label : undefined}
                className={`flex items-center gap-3 rounded-lg text-sm font-medium leading-[150%] transition ${
                  collapsed ? 'lg:justify-center lg:px-2 lg:py-2 px-3 py-2.5' : 'px-3 py-2.5'
                } ${active ? 'bg-nav-active text-navy' : 'text-slate hover:bg-slate/10 hover:text-ink'}`}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                  <Icon />
                </span>
                <span className={collapsed ? 'lg:hidden' : ''}>{label}</span>
              </Link>
            )
          })}
        </nav>

        <div className={`border-t border-slate/15 py-4 ${collapsed ? 'lg:py-3 lg:px-2 px-3' : 'px-3'}`}>
          <div
            className={`flex items-center gap-3 rounded-lg py-2.5 text-sm font-medium text-ink ${
              collapsed ? 'lg:justify-center lg:px-2 px-3' : 'justify-between px-3'
            }`}
          >
            <span className="flex items-center gap-3">
              <span className="flex-shrink-0 p-1">
                <BellIcon />
              </span>
              <span className={collapsed ? 'lg:hidden' : ''}>Notification</span>
            </span>
            <span
              className={`flex min-w-[32px] flex-shrink-0 items-center justify-center rounded-xl bg-signal-red px-3 py-1.5 text-xs font-semibold leading-none text-white ${
                collapsed ? 'lg:hidden' : ''
              }`}
            >
              2
            </span>
          </div>

          <div
            className={`mt-2 flex items-center gap-3 rounded-lg py-2.5 ${
              collapsed ? 'lg:justify-center lg:px-2 px-3' : 'px-3'
            }`}
          >
            <Avatar name={userReady ? user.name : undefined} />
            {!collapsed &&
              (userReady ? (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
                  {/* <p className="truncate text-xs text-slate">{formatRolesLabel(user.roles)}</p> */}
                  <p className="truncate text-xs text-slate">{user.email}</p>
                </div>
              ) : (
                <UserIdentitySkeleton lines={3} />
              ))}
            <button
              type="button"
              onClick={handleSignOut}
              aria-label="Sign out"
              className={`flex-shrink-0 text-slate hover:text-ink ${collapsed ? 'lg:hidden' : ''}`}
            >
              <SignOutIcon />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
