'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { CurrentUser, clearToken, getCurrentUser, readToken } from '@/lib/auth'
import { waitForMocking } from '@/lib/mockReady'

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 flex-shrink-0" aria-hidden>
      <path
        d="M6.62 10.79a15.09 15.09 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24 11.36 11.36 0 003.57.57 1 1 0 011 1V20a1 1 0 01-1 1C10.61 21 3 13.39 3 4a1 1 0 011-1h3.5a1 1 0 011 1 11.36 11.36 0 00.57 3.57 1 1 0 01-.25 1.01l-2.2 2.21z"
        fill="currentColor"
      />
    </svg>
  )
}

function QueueIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 flex-shrink-0" aria-hidden>
      <path
        d="M4 6h2m0 0h12M6 6a1 1 0 100 2 1 1 0 000-2zM4 12h2m0 0h12M6 12a1 1 0 100 2 1 1 0 000-2zM4 18h2m0 0h12M6 18a1 1 0 100 2 1 1 0 000-2z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

function StatsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 flex-shrink-0" aria-hidden>
      <path
        d="M4 19V9m6 10V5m6 14v-7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 flex-shrink-0" aria-hidden>
      <path
        d="M6 9a6 6 0 1112 0c0 4 1.5 5.5 1.5 5.5H4.5S6 13 6 9zM9.5 17a2.5 2.5 0 005 0"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function SignOutIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 flex-shrink-0" aria-hidden>
      <path
        d="M15 17l5-5-5-5M20 12H9m0 8H5a1 1 0 01-1-1V5a1 1 0 011-1h4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 flex-shrink-0" aria-hidden>
      <path
        d="M4 7h16M4 12h16M4 17h16"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

const NAV_ITEMS = [
  { href: '/fronter/workspace/int-1001', label: 'Active Call', icon: PhoneIcon },
  { href: '/fronter', label: 'Queue', icon: QueueIcon },
  { href: '/fronter/stats', label: 'My Stats', icon: StatsIcon },
] as const

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    const token = readToken()
    if (!token) return
    waitForMocking()
      .then(() => getCurrentUser(token))
      .then((currentUser) => {
        if (!cancelled) setUser(currentUser)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  function handleSignOut() {
    clearToken()
    router.push('/login')
  }

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
              <p className="truncate text-xs text-slate">CRM — Fronter</p>
            </div>
          )}
        </div>

        <nav className={`flex-1 space-y-1 py-4 ${collapsed ? 'lg:py-3 lg:px-2 px-3' : 'px-3'}`}>
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = href === '/fronter' ? pathname === '/fronter' : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                className={`flex items-center gap-3 rounded-lg text-sm font-medium leading-[150%] transition ${
                  collapsed ? 'lg:justify-center lg:px-2 lg:py-2 px-3 py-2.5' : 'px-3 py-2.5'
                } ${active ? 'bg-nav-active text-navy' : 'text-slate hover:bg-slate/10 hover:text-ink'}`}
              >
                <Icon />
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
