'use client'

import { useEffect, useMemo, useState, type ComponentType, type SVGProps } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { Bell, ChartLine, ListOrdered, LogOut, Menu, Phone } from 'lucide-react'
import { useCurrentUser } from '@/components/auth/CurrentUserProvider'
import type { Role } from '@/lib/auth'
import { readToken } from '@/lib/auth'
import { listInteractions } from '@/lib/interactions'
import { waitForMocking } from '@/lib/mockReady'

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

type DeskRole = Extract<Role, 'fronter' | 'closer'>

type NavMatch = 'workspace' | 'queue' | 'stats'

type NavItem = {
  href: string
  label: string
  icon: ComponentType
  match: NavMatch
}

const ROLE_LABEL: Record<DeskRole, string> = {
  fronter: 'CRM — Fronter',
  closer: 'CRM — Closer',
}

export function Sidebar({ role = 'fronter' }: { role?: DeskRole }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, signOut } = useCurrentUser()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [fallbackActiveId, setFallbackActiveId] = useState<string | null>(null)

  const basePath = role === 'closer' ? '/closer' : '/fronter'
  const workspacePathPrefix = `${basePath}/workspace`

  const workspaceIdFromPath = useMemo(() => {
    const match = pathname.match(new RegExp(`^${workspacePathPrefix}/([^/]+)`))
    return match?.[1] ?? null
  }, [pathname, workspacePathPrefix])

  useEffect(() => {
    if (workspaceIdFromPath) {
      setFallbackActiveId(workspaceIdFromPath)
      return
    }

    // Closer's Active Call lands on /closer itself; fronter resolves a live interaction.
    if (role === 'closer') {
      setFallbackActiveId(null)
      return
    }

    let cancelled = false
    const token = readToken()
    if (!token) return

    waitForMocking()
      .then(() => listInteractions(token))
      .then((queue) => {
        if (cancelled) return
        const active = queue.find((item) => item.status === 'active') ?? queue[0]
        setFallbackActiveId(active?.id ?? null)
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [workspaceIdFromPath, role])

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  function handleSignOut() {
    signOut()
    router.push('/login')
  }

  // Closers keep fallbackActiveId null (Active Call = /closer); fronters may
  // resolve a live interaction. Same href formula for both roles.
  const activeCallHref = workspaceIdFromPath
    ? `${workspacePathPrefix}/${workspaceIdFromPath}`
    : fallbackActiveId
      ? `${workspacePathPrefix}/${fallbackActiveId}`
      : basePath

  const navItems: NavItem[] = [
    { href: activeCallHref, label: 'Active Call', icon: PhoneIcon, match: 'workspace' },
    {
      href: role === 'closer' ? `${basePath}/queue` : basePath,
      label: 'Queue',
      icon: QueueIcon,
      match: 'queue',
    },
    { href: `${basePath}/stats`, label: 'My Stats', icon: StatsIcon, match: 'stats' },
  ]

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
            onClick={() => setCollapsed((prev) => !prev)}
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
          <div className="h-10 w-10 flex-shrink-0 rounded-full bg-slate/15" aria-hidden />
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">{user?.name ?? '[NAME]'}</p>
              <p className="truncate text-xs text-slate">{ROLE_LABEL[role]}</p>
            </div>
          )}
        </div>

        <nav className={`flex-1 space-y-1 py-4 ${collapsed ? 'lg:py-3 lg:px-2 px-3' : 'px-3'}`}>
          {navItems.map(({ href, label, icon: Icon, match }) => {
            const active =
              match === 'queue'
                ? role === 'closer'
                  ? pathname === `${basePath}/queue`
                  : pathname === basePath
                : match === 'workspace'
                  ? role === 'closer'
                    ? pathname === basePath || pathname.startsWith(workspacePathPrefix)
                    : pathname.startsWith(workspacePathPrefix)
                  : pathname.startsWith(href)
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
            <div className="h-10 w-10 flex-shrink-0 rounded-full bg-slate/20" aria-hidden />
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{user?.name ?? 'Jane Doe'}</p>
                <p className="truncate text-xs text-slate">{user?.email ?? 'jane.doe@gmail.com'}</p>
              </div>
            )}
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
