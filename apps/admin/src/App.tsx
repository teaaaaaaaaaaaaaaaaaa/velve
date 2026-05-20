import { initializeApp } from 'firebase/app'
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth'
import { useCallback, useEffect, useMemo, useState } from 'react'

type AdminUser = { _id: string; email: string; displayName: string; role: string }
type AdminItem = {
  _id: string
  title: string
  brand?: string
  category?: string
  size?: string
  health?: string
  primaryImage?: string | null
  owner?: { displayName?: string; email?: string } | null
}
type GuestSlot = { _id: string; rank: number; itemId: string; health: string; item: AdminItem | null }
type AnalyticsSummary = {
  counts: Record<string, number>
  sessions: number
  topItems: Array<{ itemId: string; count: number; item: AdminItem | null }>
}
type Report = { _id: string; targetType: string; reason: string; createdAt: string }
type AuditEntry = { _id: string; action: string; targetType: string; createdAt: string }
type AuthView = 'checking' | 'signed-out' | 'authorized' | 'denied'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}
const hasFirebaseConfig = Object.values(firebaseConfig).every(Boolean)
const firebaseApp = hasFirebaseConfig ? initializeApp(firebaseConfig) : null
const auth = firebaseApp ? getAuth(firebaseApp) : null
const googleProvider = new GoogleAuthProvider()

function formatDate(value?: string) {
  if (!value) return 'n/a'
  return new Intl.DateTimeFormat('sr-RS', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function ItemRow({
  item,
  selected,
  onToggle,
}: {
  item: AdminItem
  selected: boolean
  onToggle: () => void
}) {
  return (
    <button className={`item-row ${selected ? 'selected' : ''}`} onClick={onToggle} type="button">
      <div className="thumb">{item.primaryImage ? <img src={item.primaryImage} alt="" /> : null}</div>
      <div className="item-copy">
        <strong>{item.title}</strong>
        <span>{[item.brand, item.category, item.size].filter(Boolean).join(' - ') || 'Bez detalja'}</span>
        <small>{item.owner?.displayName || item.owner?.email || 'Nepoznat owner'}</small>
      </div>
      <div className="check">{selected ? 'OK' : '+'}</div>
    </button>
  )
}

function LoginShell({
  mode,
  onSignIn,
  onSignOut,
}: {
  mode: AuthView
  onSignIn: () => void
  onSignOut: () => void
}) {
  const isChecking = mode === 'checking'
  const isDenied = mode === 'denied'

  return (
    <main className="login-shell">
      <div className="login-logo">Velve</div>
      <div className="login-actions">
        {isDenied ? <span className="denied-label">Access denied</span> : null}
        <button
          className={isDenied ? 'secondary login-button' : 'primary login-button'}
          disabled={isChecking}
          onClick={isDenied ? onSignOut : onSignIn}
          type="button"
        >
          {isChecking ? 'Checking access' : isDenied ? 'Sign out' : 'Sign in with Google'}
        </button>
      </div>
    </main>
  )
}

export default function App() {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null)
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null)
  const [authView, setAuthView] = useState<AuthView>('checking')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [slots, setSlots] = useState<GuestSlot[]>([])
  const [candidates, setCandidates] = useState<AdminItem[]>([])
  const [search, setSearch] = useState('')
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null)
  const [reports, setReports] = useState<Report[]>([])
  const [audit, setAudit] = useState<AuditEntry[]>([])
  const [saving, setSaving] = useState(false)

  const selectedIds = useMemo(() => slots.map((slot) => String(slot.itemId)).filter(Boolean), [slots])
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])

  const apiFetch = useCallback(
    async (path: string, options: RequestInit = {}) => {
      if (!firebaseUser) throw new Error('Admin session is not ready')
      const token = await firebaseUser.getIdToken()
      const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...(options.headers || {}),
        },
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        const requestError = new Error(payload.error || `Request failed with ${response.status}`)
        ;(requestError as Error & { status?: number }).status = response.status
        throw requestError
      }
      return payload
    },
    [firebaseUser]
  )

  const resetAdminData = useCallback(() => {
    setAdminUser(null)
    setSlots([])
    setCandidates([])
    setAnalytics(null)
    setReports([])
    setAudit([])
  }, [])

  const loadAdminData = useCallback(async () => {
    if (!firebaseUser) return
    setLoading(true)
    setError('')
    setAuthView('checking')

    try {
      const me = await apiFetch('/api/admin/me')
      if (me.data?.role !== 'admin') {
        throw Object.assign(new Error('Admin access required'), { status: 403 })
      }

      const [guestFeed, analyticsSummary, openReports, auditLog] = await Promise.all([
        apiFetch('/api/admin/guest-feed'),
        apiFetch('/api/admin/guest-analytics/summary?days=7'),
        apiFetch('/api/admin/reports?status=open'),
        apiFetch('/api/admin/audit-log?limit=20'),
      ])

      setAdminUser(me.data)
      setSlots(guestFeed.data)
      setAnalytics(analyticsSummary.data)
      setReports(openReports.data)
      setAudit(auditLog.data)
      setAuthView('authorized')
    } catch (err: any) {
      resetAdminData()
      if (err?.status === 401 || err?.status === 403) {
        setAuthView('denied')
        setError('')
      } else {
        setAuthView('signed-out')
        setError(err.message || 'Admin panel nije dostupan')
      }
    } finally {
      setLoading(false)
    }
  }, [apiFetch, firebaseUser, resetAdminData])

  const loadCandidates = useCallback(async () => {
    if (!firebaseUser || authView !== 'authorized') return
    const query = new URLSearchParams({
      limit: '60',
      ...(search.trim() ? { search: search.trim() } : {}),
    })
    const payload = await apiFetch(`/api/admin/guest-feed/candidates?${query.toString()}`)
    setCandidates(payload.data)
  }, [apiFetch, authView, firebaseUser, search])

  useEffect(() => {
    if (!auth) {
      setAuthView('signed-out')
      setLoading(false)
      return
    }
    return onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user)
      if (!user) {
        resetAdminData()
        setAuthView('signed-out')
        setLoading(false)
        return
      }
      setAuthView('checking')
      setLoading(true)
    })
  }, [resetAdminData])

  useEffect(() => {
    if (firebaseUser) loadAdminData()
  }, [firebaseUser, loadAdminData])

  useEffect(() => {
    if (!firebaseUser || authView !== 'authorized') return
    const timeout = window.setTimeout(() => {
      loadCandidates().catch((err) => setError(err.message))
    }, 200)
    return () => window.clearTimeout(timeout)
  }, [authView, firebaseUser, loadCandidates])

  async function handleSignIn() {
    if (!auth) return
    setError('')
    setAuthView('checking')
    await signInWithPopup(auth, googleProvider)
  }

  async function handleSignOut() {
    if (!auth) return
    resetAdminData()
    setAuthView('signed-out')
    await signOut(auth)
  }

  function toggleCandidate(item: AdminItem) {
    if (selectedSet.has(item._id)) {
      setSlots((prev) => prev.filter((slot) => String(slot.itemId) !== item._id))
      return
    }

    setSlots((prev) => [
      ...prev,
      {
        _id: `local-${item._id}`,
        rank: prev.length + 1,
        itemId: item._id,
        health: item.health || 'available',
        item,
      },
    ])
  }

  function moveSlot(index: number, direction: -1 | 1) {
    setSlots((prev) => {
      const next = [...prev]
      const target = index + direction
      if (target < 0 || target >= next.length) return prev
      const current = next[index]
      next[index] = next[target]
      next[target] = current
      return next.map((slot, slotIndex) => ({ ...slot, rank: slotIndex + 1 }))
    })
  }

  async function saveGuestFeed() {
    setSaving(true)
    setError('')
    try {
      const payload = await apiFetch('/api/admin/guest-feed', {
        method: 'PUT',
        body: JSON.stringify({ itemIds: selectedIds }),
      })
      setSlots(payload.data)
      await Promise.all([loadCandidates(), loadAdminData()])
    } catch (err: any) {
      setError(err.message || 'Curated feed nije sacuvan')
    } finally {
      setSaving(false)
    }
  }

  if (!hasFirebaseConfig) {
    return (
      <main className="login-shell">
        <div className="login-logo">Velve</div>
        <span className="denied-label">Missing Firebase config</span>
      </main>
    )
  }

  if (authView !== 'authorized' || !firebaseUser || !adminUser || loading) {
    return (
      <LoginShell mode={authView} onSignIn={handleSignIn} onSignOut={handleSignOut} />
    )
  }

  return (
    <main className="admin-shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">Velve</p>
          <h1>Admin</h1>
        </div>
        <nav>
          <a href="#guest-feed">Guest feed</a>
          <a href="#analytics">Analytics</a>
          <a href="#moderation">Moderation</a>
          <a href="#security">Security</a>
        </nav>
        <div className="admin-card">
          <strong>{adminUser.displayName || firebaseUser.email}</strong>
          <span>{adminUser.role}</span>
          <button className="secondary" onClick={handleSignOut} type="button">
            Sign out
          </button>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">Production ops</p>
            <h2>Guest preview control room</h2>
          </div>
          <button className="secondary" onClick={loadAdminData} disabled={loading} type="button">
            Refresh
          </button>
        </header>

        {error ? <div className="error">{error}</div> : null}

        <section className="grid stats" id="analytics">
          <StatCard label="Guest sessions, 7d" value={analytics?.sessions ?? '...'} />
          <StatCard label="Item open attempts" value={analytics?.counts?.guest_item_open_attempt ?? 0} />
          <StatCard label="Signup wall views" value={analytics?.counts?.guest_signup_wall_view ?? 0} />
          <StatCard label="Signup CTA clicks" value={analytics?.counts?.guest_signup_cta_click ?? 0} />
        </section>

        <section className="panel" id="guest-feed">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Curated window</p>
              <h3>Guest feed</h3>
              <p>Gosti vide prvih 20 itema iz ove liste. Admin moze da cuva vecu listu.</p>
            </div>
            <button className="primary" onClick={saveGuestFeed} disabled={saving || slots.length === 0} type="button">
              {saving ? 'Saving...' : 'Publish list'}
            </button>
          </div>

          <div className="editor-grid">
            <div>
              <label className="field">
                <span>Search available items</span>
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Title, brand, category..." />
              </label>
              <div className="item-list">
                {candidates.map((item) => (
                  <ItemRow key={item._id} item={item} selected={selectedSet.has(item._id)} onToggle={() => toggleCandidate(item)} />
                ))}
              </div>
            </div>

            <div className="selected-list">
              <div className="selected-head">
                <strong>Selected order</strong>
                <span>{slots.length} total - {Math.min(slots.length, 20)} visible</span>
              </div>
              {slots.map((slot, index) => (
                <div className={`slot-row ${index < 20 ? 'visible' : ''}`} key={slot._id}>
                  <span className="rank">{index + 1}</span>
                  <div className="slot-copy">
                    <strong>{slot.item?.title || 'Unavailable item'}</strong>
                    <small>{slot.health}</small>
                  </div>
                  <div className="slot-actions">
                    <button onClick={() => moveSlot(index, -1)} disabled={index === 0} type="button">Up</button>
                    <button onClick={() => moveSlot(index, 1)} disabled={index === slots.length - 1} type="button">Down</button>
                    <button onClick={() => toggleCandidate({ _id: String(slot.itemId), title: '' })} type="button">Remove</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid two">
          <div className="panel">
            <div className="panel-head compact">
              <div>
                <p className="eyebrow">Content signals</p>
                <h3>Top guest items</h3>
              </div>
            </div>
            <div className="simple-list">
              {analytics?.topItems?.map((entry) => (
                <div key={String(entry.itemId)} className="simple-row">
                  <strong>{entry.item?.title || 'Unknown item'}</strong>
                  <span>{entry.count} events</span>
                </div>
              ))}
            </div>
          </div>

          <div className="panel" id="moderation">
            <div className="panel-head compact">
              <div>
                <p className="eyebrow">Trust queue</p>
                <h3>Open reports</h3>
              </div>
            </div>
            <div className="simple-list">
              {reports.slice(0, 8).map((report) => (
                <div key={report._id} className="simple-row">
                  <strong>{report.reason}</strong>
                  <span>{report.targetType} - {formatDate(report.createdAt)}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid two">
          <div className="panel" id="security">
            <div className="panel-head compact">
              <div>
                <p className="eyebrow">Security posture</p>
                <h3>Production checklist</h3>
              </div>
            </div>
            <ul className="checklist">
              <li>Backend requireAdmin is mandatory for admin APIs.</li>
              <li>Cloudflare Access should protect admin.velveapp.com.</li>
              <li>Admin Google accounts must use MFA/passkeys.</li>
              <li>Every mutation writes an audit log.</li>
            </ul>
          </div>

          <div className="panel">
            <div className="panel-head compact">
              <div>
                <p className="eyebrow">Audit</p>
                <h3>Latest actions</h3>
              </div>
            </div>
            <div className="simple-list">
              {audit.map((entry) => (
                <div key={entry._id} className="simple-row">
                  <strong>{entry.action}</strong>
                  <span>{entry.targetType} - {formatDate(entry.createdAt)}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </section>
    </main>
  )
}
