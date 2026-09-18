/**
 * The session as every tab sees it.
 *
 * localStorage gives each tab a cached view that another tab's write reaches a
 * moment later — long enough, as measured, for a tab that has just taken the
 * refresh lock to read a refresh token another tab has already spent. The API
 * takes a spent token presented again as theft and ends every session the user
 * has. IndexedDB has no such lag: a write committed before the lock is released
 * is what the next holder reads. So renewals trust this copy; localStorage keeps
 * its own for everything that has to read synchronously.
 */

export type SavedSession = {
  access_token: string
  refresh_token: string
  /** Epoch milliseconds. */
  expires_at: number
}

const DATABASE = 'tgs-crm'
const STORE = 'session'
const KEY = 'current'

let opening: Promise<IDBDatabase> | null = null

function database(): Promise<IDBDatabase> {
  opening ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  }).catch((err) => {
    opening = null
    throw err
  })
  return opening
}

async function transact<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await database()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const request = work(tx.objectStore(STORE))
    // Settled on commit rather than on the request: only a committed write is
    // guaranteed to be what the next tab to take the lock reads.
    tx.oncomplete = () => resolve(request.result)
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

export async function loadSession(): Promise<SavedSession | null> {
  const session = await transact<SavedSession | undefined>('readonly', (store) => store.get(KEY))
  return session ?? null
}

export async function saveSession(session: SavedSession): Promise<void> {
  await transact('readwrite', (store) => store.put(session, KEY))
}

export async function deleteSession(): Promise<void> {
  await transact('readwrite', (store) => store.delete(KEY))
}
