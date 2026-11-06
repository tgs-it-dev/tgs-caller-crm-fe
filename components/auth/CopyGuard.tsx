'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useCurrentUser } from '@/components/auth/CurrentUserProvider'
import { isSuperAdmin } from '@/lib/auth'

/** Reached without a session, so password managers must keep working there. */
const OPEN_PAGES = ['/login', '/invite', '/reset-password', '/forgot-password']

const GUARDED = ['copy', 'cut', 'paste', 'contextmenu', 'dragstart', 'drop', 'beforeinput'] as const

/** Text that arrives from somewhere other than the keyboard. */
const BROUGHT_IN = new Set([
  'insertFromPaste',
  'insertFromPasteAsQuotation',
  'insertFromDrop',
  'insertFromYank',
])

function isPasswordField(target: EventTarget | null) {
  return target instanceof HTMLInputElement && target.type === 'password'
}

function allowed(event: Event) {
  switch (event.type) {
    case 'paste':
      return isPasswordField(event.target)
    case 'beforeinput':
      return !BROUGHT_IN.has((event as InputEvent).inputType) || isPasswordField(event.target)
    case 'drop':
      // A file still drops onto an upload; text never lands anywhere.
      return Boolean((event as DragEvent).dataTransfer?.types.includes('Files'))
    default:
      return false
  }
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
 * Everyone but a Super Admin types every form by hand: copy, cut, paste,
 * right-click, text selection and dragging all do nothing, and nothing on screen
 * says so. Paste into a password field still works, and so does dropping a file
 * onto an upload. `styles/globals.css` turns selection off under the attribute.
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
