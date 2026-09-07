export function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, '').slice(-10)
  if (digits.length !== 10) return phone
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatElapsed(startedAtIso: string, nowMs: number = Date.now()) {
  const seconds = Math.max(0, Math.floor((nowMs - new Date(startedAtIso).getTime()) / 1000))
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function elapsedParts(sinceIso: string, nowMs: number) {
  const seconds = Math.max(0, Math.floor((nowMs - new Date(sinceIso).getTime()) / 1000))
  return { minutes: Math.floor(seconds / 60), seconds: seconds % 60 }
}

/** Zero-padded `mm:ss`, matching the Queue table's "03:12" column. */
export function formatWaitTime(sinceIso: string, nowMs: number = Date.now()) {
  const { minutes, seconds } = elapsedParts(sinceIso, nowMs)
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

/** Spoken form, so screen readers don't read "03:12" as digits. */
export function formatWaitTimeLabel(sinceIso: string, nowMs: number = Date.now()) {
  const { minutes, seconds } = elapsedParts(sinceIso, nowMs)
  return `${minutes} minute${minutes === 1 ? '' : 's'} ${seconds} second${seconds === 1 ? '' : 's'}`
}
