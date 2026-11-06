'use client'

import { useEffect, useState } from 'react'
import { useGuarded } from '@/components/auth/CopyGuard'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { readToken, reportScreenshot } from '@/lib/auth'

/** Keys that start a screenshot shortcut, such as Alt + Print Screen or Win + Shift + S. */
const SHORTCUT_KEYS = new Set(['Alt', 'Meta', 'OS'])
/** Clears a held key whose release the page never hears, as after Alt + Tab. */
const HELD_MS = 5000
const RELEASED_MS = 1000

type Reason = 'key' | 'focus' | 'hidden' | 'alert'

const reasons = new Set<Reason>()

/** Set straight on <html>, not through React state, so the blur lands on the next frame. */
function paint() {
  const root = document.documentElement
  if (reasons.size > 0) root.dataset.screenBlur = ''
  else delete root.dataset.screenBlur
}

function blur(reason: Reason) {
  reasons.add(reason)
  paint()
}

function clear(...gone: Reason[]) {
  for (const reason of gone) reasons.delete(reason)
  paint()
}

function isPrintScreen(event: KeyboardEvent) {
  return event.key === 'PrintScreen' || event.code === 'PrintScreen'
}

/**
 * Everyone but a Super Admin: the page blurs while Alt or the Windows key is down,
 * while the window is out of focus and while the tab is hidden, which beats every
 * screenshot shortcut but a plain Print Screen. Windows takes that image before
 * the page hears the key, so its release is recorded against the user instead,
 * and they are told so.
 */
export function ScreenGuard() {
  const on = useGuarded()
  const [alerting, setAlerting] = useState(false)

  useEffect(() => {
    if (!on) return
    let timer: number | undefined

    function release(after: number) {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => clear('key'), after)
    }

    function onKeyDown(event: KeyboardEvent) {
      if (!SHORTCUT_KEYS.has(event.key)) return
      blur('key')
      release(HELD_MS)
    }

    function onKeyUp(event: KeyboardEvent) {
      if (SHORTCUT_KEYS.has(event.key)) release(RELEASED_MS)
      if (!isPrintScreen(event)) return
      const token = readToken()
      if (token) {
        reportScreenshot(window.location.pathname + window.location.search, token).catch(() => {})
      }
      blur('alert')
      setAlerting(true)
    }

    function onBlur() {
      blur('focus')
    }

    function onFocus() {
      window.clearTimeout(timer)
      clear('focus', 'key')
    }

    function onVisibility() {
      if (document.hidden) blur('hidden')
      else clear('hidden')
    }

    if (!document.hasFocus()) blur('focus')
    if (document.hidden) blur('hidden')
    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('keyup', onKeyUp, true)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('keyup', onKeyUp, true)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', onFocus)
      reasons.clear()
      paint()
    }
  }, [on])

  function close() {
    clear('alert')
    setAlerting(false)
  }

  if (!on) return null

  return (
    <>
      <div className="screen-guard-overlay" aria-hidden="true" />
      <Dialog
        open={alerting}
        title="Screenshot recorded"
        onClose={close}
        zIndex={2100}
        actions={
          <Button type="button" onClick={close}>
            OK
          </Button>
        }
      >
        <p className="text-sm text-ink">
          Screenshots aren&apos;t allowed in the CRM. This one has been recorded with your name
          and the time.
        </p>
      </Dialog>
    </>
  )
}
