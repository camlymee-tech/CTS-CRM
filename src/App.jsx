import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { StatusProvider } from './lib/StatusContext'
import Login from './components/Login'
import ResetPassword from './components/ResetPassword'
import Sidebar from './components/Sidebar'
import CustomerList from './components/CustomerList'
import TeamPage from './components/TeamPage'
import DocumentsPage from './components/DocumentsPage'
import NotificationsPage from './components/NotificationsPage'
import OrdersPage from './components/OrdersPage'
import ReportsPage from './components/ReportsPage'
import ContractsPage from './components/ContractsPage'
import ChecklistPage from './components/ChecklistPage'
import AnalyticsPage from './components/AnalyticsPage'

export default function App() {
  const [session, setSession] = useState(undefined)
  const [profile, setProfile] = useState(null)
  const [page, setPage] = useState('checklist')
  const [recovering, setRecovering] = useState(false)
  const [unread, setUnread] = useState(0)
  const [chotDonCustomer, setChotDonCustomer] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session?.user) loadProfile(session.user.id)
    else setProfile(null)
  }, [session])

  async function loadProfile(userId) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    setProfile(data)
  }

  const loadUnread = useCallback(async () => {
    if (!profile?.id) return
    const [{ data: notis }, { data: readRows }] = await Promise.all([
      supabase.from('notifications').select('id').limit(200),
      supabase.from('notification_reads').select('notification_id').eq('user_id', profile.id),
    ])
    const daDoc = new Set((readRows || []).map((r) => r.notification_id))
    setUnread((notis || []).filter((n) => !daDoc.has(n.id)).length)
  }, [profile?.id])

  useEffect(() => { loadUnread() }, [loadUnread, page])

  if (session === undefined) {
    return <div className="flex min-h-screen items-center justify-center bg-navy-950 text-white">Đang tải...</div>
  }

  if (recovering && session) {
    return (
      <ResetPassword
        onDone={() => {
          setRecovering(false)
          window.history.replaceState({}, '', window.location.pathname)
        }}
      />
    )
  }

  if (!session) return <Login />

  if (profile && profile.active === false) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-navy-950 px-4 text-center text-white">
        <p className="font-display text-lg font-semibold">Tài khoản đã bị khoá</p>
        <p className="text-sm text-white/60">Liên hệ quản trị viên để được mở lại quyền truy cập.</p>
        <button
          onClick={() => supabase.auth.signOut()}
          className="rounded-xl bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
        >
          Đăng xuất
        </button>
      </div>
    )
  }

  return (
    <StatusProvider>
    <div className="flex min-h-screen bg-bg">
      <Sidebar
        current={page}
        onNavigate={setPage}
        profile={profile}
        unreadCount={unread}
        onChangePassword={() => setRecovering(true)}
      />
      {page === 'checklist' && <ChecklistPage currentProfile={profile} />}
      {page === 'customers' && (
        <CustomerList
          currentProfile={profile}
          onChotDon={(khach) => { setChotDonCustomer(khach); setPage('orders') }}
        />
      )}
      {page === 'orders' && (
        <OrdersPage
          currentProfile={profile}
          pendingCustomer={chotDonCustomer}
          onPendingHandled={() => setChotDonCustomer(null)}
        />
      )}
      {page === 'contracts' && <ContractsPage currentProfile={profile} />}
      {page === 'reports' && <ReportsPage />}
      {page === 'analytics' && <AnalyticsPage />}
      {page === 'team' && <TeamPage currentProfile={profile} />}
      {page === 'documents' && <DocumentsPage currentProfile={profile} />}
      {page === 'notifications' && profile && (
        <NotificationsPage currentProfile={profile} onRead={loadUnread} />
      )}
    </div>
    </StatusProvider>
  )
}
