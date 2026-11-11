'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useCurrentUser } from '@/components/auth/CurrentUserProvider'
import { isSuperAdmin } from '@/lib/auth'

/** Reached without a session, so password managers must keep working there. */
const OPEN_PAGES = ['/login', '/invite', '/reset-password', '/forgot-password']

/** Paste isn't here: text may come in, it just can't go out. */
const GUARDED = ['copy', 'cut', 'contextmenu', 'dragstart', 'drop'] as const

function allowed(event: Event) {
  // A file still drops onto an upload; dragged text never lands anywhere.
  return event.type === 'drop' && Boolean((event as DragEvent).dataTransfer?.types.includes('Files'))
}

function guard(event: Event) {
  if (!allowed(event)) event.preventDefault()
}

/** Who the copy and screenshot guards cover: anyone signed in but a Super Admin. */
export function useGuarded() {
  const { user } = useCurrentUser()
  const pathname = usePathname()
  return (
    Boolean(user && !isSuperAdmin(user.roles)) &&
    !OPEN_PAGES.some((page) => pathname.startsWith(page))
  )
}

/**
 * Everyone but a Super Admin can paste into a field, with Ctrl+V, but never copy
 * out: copy, cut, right-click, text selection and dragging all do nothing, and
 * nothing on screen says so. Right-click stays off because its menu offers Copy
 * and search. Dropping a file onto an upload still works. `styles/globals.css`
 * turns selection off under the attribute.
 */
export function CopyGuard() {
  const on = useGuarded()

  useEffect(() => {
    if (!on) return
    const root = document.documentElement
    root.dataset.copyGuard = ''
    for (const type of GUARDED) document.addEventListener(type, guard, true)
    return () => {
      delete root.dataset.copyGuard
      for (const type of GUARDED) document.removeEventListener(type, guard, true)
    }
  }, [on])

  return null
}
