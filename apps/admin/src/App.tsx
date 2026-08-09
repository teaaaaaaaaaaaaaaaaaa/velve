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
import type { TradeRequest, User } from '@velve/shared'

// Admin views compose the shared DTOs with moderation-only fields the API
// attaches on top of the base User/Item shape for admin endpoints.
type AdminUser = Partial<User> & {
  _id: string
  email: string
  role: string
  itemsCount?: number
  suspendedReason?: string
}
type AdminItem = {
  _id: string
  title: string
  brand?: string
  category?: string
  size?: string
  status?: string
  isDeleted?: boolean
  health?: string
  primaryImage?: string | null
  owner?: { _id?: string; displayName?: string; email?: string; accountStatus?: string } | null
  createdAt?: string
}
type GuestSlot = { _id: string; rank: number; itemId: string; health: string; item: AdminItem | null }
type AnalyticsSummary = {
  counts: Record<string, number>
  sessions: number
  topItems: Array<{ itemId: string; count: number; item: AdminItem | null }>
  recent?: Array<{ _id: string; eventType: string; route?: string; createdAt: string }>
}
type Overview = {
  users: { total: number; active: number; suspended: number; new7d: number }
  items: { active: number; hidden: number }
  reports: { open: number }
  trades: { pending: number }
  guest: { sessions7d: number; signupClicks7d: number }
  system: { api: string; generatedAt: string }
}
type Report = {
  _id: string
  targetType: string
  reason: string
  status: string
  reporterId?: AdminUser | null
  targetUserId?: AdminUser | null
  itemId?: AdminItem | null
  createdAt: string
}
// Populated admin view of a trade — sender/receiver/items are hydrated objects,
// not the raw ObjectId refs TradeRequest models on the API side, so this stays
// its own shape; only the status enum is reused from the shared DTO.
type Trade = {
  _id: string
  type?: string
  status: TradeRequest['status']
  offeredPrice?: number
  sender?: AdminUser | null
  receiver?: AdminUser | null
  offeredItem?: AdminItem | null
  requestedItem?: AdminItem | null
  message?: string
  createdAt?: string
}
type AuditEntry = {
  _id: string
  action: string
  targetType: string
  details?: Record<string, unknown>
  actorUserId?: AdminUser | null
  createdAt: string
}
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

function safeName(user?: AdminUser | null) {
  return user?.displayName || user?.email || 'Unknown user'
}

function itemMeta(item?: AdminItem | null) {
  if (!item) return 'Unavailable item'
  return [item.brand, item.category, item.size].filter(Boolean).join(' - ') || item.status || 'No details'
}

function StatCard({ label, value, tone = 'default' }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className={`stat-card tone-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function StatusPill({ value }: { value?: string }) {
  return <span className={`pill pill-${value || 'unknown'}`}>{value || 'unknown'}</span>
}

function ItemThumb({ item }: { item?: AdminItem | null }) {
  return <div className="thumb">{item?.primaryImage ? <img src={item.primaryImage} alt="" /> : null}</div>
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
      <ItemThumb item={item} />
      <div className="item-copy">
        <strong>{item.title}</strong>
        <span>{itemMeta(item)}</span>
        <small>{item.owner?.displayName || item.owner?.email || 'Unknown owner'}</small>
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
  const [overview, setOverview] = useState<Overview | null>(null)
  const [slots, setSlots] = useState<GuestSlot[]>([])
  const [candidates, setCandidates] = useState<AdminItem[]>([])
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null)
  const [reports, setReports] = useState<Report[]>([])
  const [audit, setAudit] = useState<AuditEntry[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [items, setItems] = useState<AdminItem[]>([])
  const [trades, setTrades] = useState<Trade[]>([])
  const [search, setSearch] = useState('')
  const [userSearch, setUserSearch] = useState('')
  const [itemSearch, setItemSearch] = useState('')
  const [itemStatus, setItemStatus] = useState('available')
  const [tradeStatus, setTradeStatus] = useState('pending')
  const [saving, setSaving] = useState(false)
  const [mutating, setMutating] = useState('')

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
    setOverview(null)
    setSlots([])
    setCandidates([])
    setAnalytics(null)
    setReports([])
    setAudit([])
    setUsers([])
    setItems([])
    setTrades([])
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

      const userQuery = new URLSearchParams({
        limit: '60',
        ...(userSearch.trim() ? { search: userSearch.trim() } : {}),
      })
      const itemQuery = new URLSearchParams({
        limit: '60',
        status: itemStatus,
        ...(itemSearch.trim() ? { search: itemSearch.trim() } : {}),
      })
      const tradeQuery = new URLSearchParams({ limit: '40', status: tradeStatus })

      const [
        overviewPayload,
        guestFeed,
        analyticsSummary,
        reportPayload,
        auditLog,
        userPayload,
        itemPayload,
        tradePayload,
      ] = await Promise.all([
        apiFetch('/api/admin/overview'),
        apiFetch('/api/admin/guest-feed'),
        apiFetch('/api/admin/guest-analytics/summary?days=7'),
        apiFetch('/api/admin/reports?status=open&limit=30'),
        apiFetch('/api/admin/audit-log?limit=30'),
        apiFetch(`/api/admin/users?${userQuery.toString()}`),
        apiFetch(`/api/admin/items?${itemQuery.toString()}`),
        apiFetch(`/api/admin/trades?${tradeQuery.toString()}`),
      ])

      setAdminUser(me.data)
      setOverview(overviewPayload.data)
      setSlots(guestFeed.data)
      setAnalytics(analyticsSummary.data)
      setReports(reportPayload.data)
      setAudit(auditLog.data)
      setUsers(userPayload.data)
      setItems(itemPayload.data)
      setTrades(tradePayload.data)
      setAuthView('authorized')
    } catch (err: any) {
      resetAdminData()
      if (err?.status === 401 || err?.status === 403) {
        setAuthView('denied')
        setError('')
      } else {
        setAuthView('signed-out')
        setError(err.message || 'Admin panel is not available')
      }
    } finally {
      setLoading(false)
    }
  }, [apiFetch, firebaseUser, itemSearch, itemStatus, resetAdminData, tradeStatus, userSearch])

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
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (err: any) {
      setAuthView('signed-out')
      setError(err.message || 'Google sign-in failed')
    }
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

  function promptReason(label: string) {
    const reason = window.prompt(`${label}\n\nReason, min 4 chars:`)
    if (!reason) return null
    const trimmed = reason.trim()
    if (trimmed.length < 4) {
      setError('Reason must have at least 4 characters')
      return null
    }
    return trimmed
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
      setError(err.message || 'Curated feed was not saved')
    } finally {
      setSaving(false)
    }
  }

  async function runMutation(key: string, path: string, body?: Record<string, unknown>) {
    setMutating(key)
    setError('')
    try {
      await apiFetch(path, {
        method: body ? 'POST' : 'PUT',
        body: body ? JSON.stringify(body) : undefined,
      })
      await loadAdminData()
    } catch (err: any) {
      setError(err.message || 'Action failed')
    } finally {
      setMutating('')
    }
  }

  async function updateReportStatus(reportId: string, status: string) {
    setMutating(`report-${reportId}`)
    setError('')
    try {
      await apiFetch(`/api/admin/reports/${reportId}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      })
      await loadAdminData()
    } catch (err: any) {
      setError(err.message || 'Report was not updated')
    } finally {
      setMutating('')
    }
  }

  async function hideItem(item: AdminItem) {
    const reason = promptReason(`Hide item: ${item.title}`)
    if (!reason) return
    await runMutation(`hide-${item._id}`, `/api/admin/items/${item._id}/hide`, { reason })
  }

  async function restoreItem(item: AdminItem) {
    const reason = promptReason(`Restore item: ${item.title}`)
    if (!reason) return
    await runMutation(`restore-${item._id}`, `/api/admin/items/${item._id}/restore`, { reason })
  }

  async function suspendUser(user: AdminUser) {
    const reason = promptReason(`Suspend user: ${safeName(user)}`)
    if (!reason) return
    await runMutation(`suspend-${user._id}`, `/api/admin/users/${user._id}/suspend`, { reason })
  }

  async function activateUser(user: AdminUser) {
    const reason = promptReason(`Activate user: ${safeName(user)}`)
    if (!reason) return
    await runMutation(`activate-${user._id}`, `/api/admin/users/${user._id}/activate`, { reason })
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
      <>
        <LoginShell mode={authView} onSignIn={handleSignIn} onSignOut={handleSignOut} />
        {error ? <div className="floating-error">{error}</div> : null}
      </>
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
          <a href="#overview">Overview</a>
          <a href="#guest-feed">Guest feed</a>
          <a href="#users">Users</a>
          <a href="#items">Items</a>
          <a href="#trades">Trades</a>
          <a href="#reports">Reports</a>
          <a href="#audit">Audit</a>
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
        <header className="topbar" id="overview">
          <div>
            <p className="eyebrow">Production ops</p>
            <h2>Admin control room</h2>
          </div>
          <button className="secondary" onClick={loadAdminData} disabled={loading} type="button">
            Refresh
          </button>
        </header>

        {error ? <div className="error">{error}</div> : null}

        <section className="grid stats">
          <StatCard label="Total users" value={overview?.users.total ?? '...'} />
          <StatCard label="Active items" value={overview?.items.active ?? '...'} />
          <StatCard label="Open reports" value={overview?.reports.open ?? '...'} tone="warning" />
          <StatCard label="Pending trades" value={overview?.trades.pending ?? '...'} />
          <StatCard label="Guest sessions, 7d" value={overview?.guest.sessions7d ?? analytics?.sessions ?? '...'} />
          <StatCard label="Signup CTA clicks, 7d" value={overview?.guest.signupClicks7d ?? 0} />
          <StatCard label="Suspended users" value={overview?.users.suspended ?? 0} tone="danger" />
          <StatCard label="Hidden items" value={overview?.items.hidden ?? 0} tone="danger" />
        </section>

        <section className="panel" id="guest-feed">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Curated window</p>
              <h3>Guest feed</h3>
              <p>Guests can scroll only. They see first 20 items, while admin can keep a longer list.</p>
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
              {(analytics?.topItems || []).map((entry) => (
                <div key={String(entry.itemId)} className="simple-row">
                  <strong>{entry.item?.title || 'Unknown item'}</strong>
                  <span>{entry.count} events</span>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head compact">
              <div>
                <p className="eyebrow">Funnel</p>
                <h3>Guest actions</h3>
              </div>
            </div>
            <div className="metrics-list">
              {Object.entries(analytics?.counts || {}).map(([eventType, count]) => (
                <div className="metric-row" key={eventType}>
                  <span>{eventType}</span>
                  <strong>{count}</strong>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="panel" id="users">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Identity and trust</p>
              <h3>Users</h3>
            </div>
            <div className="filters">
              <input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Search user..." />
              <button className="secondary" onClick={loadAdminData} type="button">Apply</button>
            </div>
          </div>
          <div className="table-list">
            {users.map((user) => (
              <div className="ops-row" key={user._id}>
                <div className="row-main">
                  <strong>{safeName(user)}</strong>
                  <span>{user.email} - {user.itemsCount || 0} items - joined {formatDate(user.createdAt)}</span>
                </div>
                <StatusPill value={user.accountStatus || user.role} />
                <div className="row-actions">
                  {user.accountStatus === 'suspended' ? (
                    <button disabled={mutating === `activate-${user._id}`} onClick={() => activateUser(user)} type="button">Activate</button>
                  ) : (
                    <button className="danger-button" disabled={mutating === `suspend-${user._id}`} onClick={() => suspendUser(user)} type="button">Suspend</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel" id="items">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Marketplace inventory</p>
              <h3>Items</h3>
            </div>
            <div className="filters">
              <input value={itemSearch} onChange={(event) => setItemSearch(event.target.value)} placeholder="Search item..." />
              <select value={itemStatus} onChange={(event) => setItemStatus(event.target.value)}>
                <option value="available">Available</option>
                <option value="hidden">Hidden</option>
                <option value="pending_trade">Pending trade</option>
                <option value="traded">Traded</option>
                <option value="sold">Sold</option>
                <option value="unavailable">Unavailable</option>
                <option value="swapped">Swapped</option>
                <option value="all">All</option>
              </select>
              <button className="secondary" onClick={loadAdminData} type="button">Apply</button>
            </div>
          </div>
          <div className="table-list">
            {items.map((item) => (
              <div className="ops-row item-ops-row" key={item._id}>
                <ItemThumb item={item} />
                <div className="row-main">
                  <strong>{item.title}</strong>
                  <span>{itemMeta(item)} - {item.owner?.email || 'Unknown owner'}</span>
                </div>
                <StatusPill value={item.health || item.status} />
                <div className="row-actions">
                  {item.health === 'available' || item.status === 'available' ? (
                    <button className="danger-button" disabled={mutating === `hide-${item._id}`} onClick={() => hideItem(item)} type="button">Hide</button>
                  ) : (
                    <button disabled={mutating === `restore-${item._id}`} onClick={() => restoreItem(item)} type="button">Restore</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel" id="trades">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Exchange health</p>
              <h3>Trades</h3>
            </div>
            <div className="filters">
              <select value={tradeStatus} onChange={(event) => setTradeStatus(event.target.value)}>
                <option value="pending">Pending</option>
                <option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option>
                <option value="cancelled">Cancelled</option>
                <option value="expired">Expired</option>
                <option value="all">All</option>
              </select>
              <button className="secondary" onClick={loadAdminData} type="button">Apply</button>
            </div>
          </div>
          <div className="table-list">
            {trades.map((trade) => (
              <div className="ops-row" key={trade._id}>
                <div className="row-main">
                  <strong>{safeName(trade.sender)} to {safeName(trade.receiver)}</strong>
                  <span>{trade.offeredItem?.title || 'Cash offer'} for {trade.requestedItem?.title || 'item'} - {formatDate(trade.createdAt)}</span>
                </div>
                <StatusPill value={trade.status} />
              </div>
            ))}
          </div>
        </section>

        <section className="grid two">
          <div className="panel" id="reports">
            <div className="panel-head compact">
              <div>
                <p className="eyebrow">Trust queue</p>
                <h3>Open reports</h3>
              </div>
            </div>
            <div className="simple-list">
              {reports.map((report) => (
                <div key={report._id} className="report-row">
                  <div>
                    <strong>{report.reason}</strong>
                    <span>{report.targetType} - {formatDate(report.createdAt)} - by {safeName(report.reporterId)}</span>
                  </div>
                  <div className="row-actions">
                    <button disabled={mutating === `report-${report._id}`} onClick={() => updateReportStatus(report._id, 'reviewed')} type="button">Review</button>
                    <button disabled={mutating === `report-${report._id}`} onClick={() => updateReportStatus(report._id, 'resolved')} type="button">Resolve</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel" id="audit">
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
                  <span>{entry.targetType} - {safeName(entry.actorUserId)} - {formatDate(entry.createdAt)}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="panel" id="security">
          <div className="panel-head compact">
            <div>
              <p className="eyebrow">Security posture</p>
              <h3>Production checklist</h3>
            </div>
            <StatusPill value={overview?.system.api || 'online'} />
          </div>
          <ul className="checklist">
            <li>Cloudflare Access protects admin.velveapp.com before the app loads.</li>
            <li>Firebase login is followed by backend requireAdmin role verification.</li>
            <li>Non-admin users never receive dashboard data from the API.</li>
            <li>Moderation actions require a reason and write an audit log.</li>
            <li>Guest funnel analytics are no-PII and rate limited.</li>
          </ul>
        </section>
      </section>
    </main>
  )
}
