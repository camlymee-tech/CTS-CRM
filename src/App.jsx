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
import BaoCaoPage from './components/BaoCaoPage'
import ChecklistPage from './components/ChecklistPage'
import { demNhacViec } from './lib/nhacViec'
import { useDanhMuc } from './lib/danhMuc'
import BaoGiaPage from './components/BaoGiaPage'

export default function App() {
  const [session, setSession] = useState(undefined)
  const [profile, setProfile] = useState(null)
  const [page, setPage] = useState('checklist')
  const [recovering, setRecovering] = useState(false)
  useDanhMuc(!!session)  // nạp Nguồn / Dịch vụ tuỳ chỉnh
  const [unread, setUnread] = useState(0)
  const [viecCan, setViecCan] = useState({ tong: 0, followUp: 0, canGoiLai: 0, baoCaoAds: 0 })   // việc nhắc: follow-up, khách cần gọi lại, báo cáo ADS

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

  // Huy hiệu số việc cần nhắc ở mục Checklist (tái ký hợp đồng ADS + báo cáo chỉ số ADS)
  const loadViecCan = useCallback(async () => {
    if (!profile?.id) return
    try {
      setViecCan(await demNhacViec(supabase, { isAdmin: profile.role === 'admin', userId: profile.id, me: profile }))
    } catch { /* bo qua, khong anh huong cac man khac */ }
  }, [profile?.id, profile?.role, profile?.phong_ban])

  useEffect(() => { loadViecCan() }, [loadViecCan, page])

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
        viecCan={viecCan}
        onChangePassword={() => setRecovering(true)}
      />
      {page === 'checklist' && <ChecklistPage currentProfile={profile} onDoiViec={loadViecCan} />}
      {page === 'customers' && <CustomerList currentProfile={profile} />}
      {page === 'baocao' && <BaoCaoPage currentProfile={profile} />}
      {page === 'team' && <TeamPage currentProfile={profile} />}
      {page === 'pricing' && <BaoGiaPage currentProfile={profile} />}
      {page === 'documents' && <DocumentsPage currentProfile={profile} />}
      {page === 'notifications' && profile && (
        <NotificationsPage currentProfile={profile} onRead={loadUnread} />
      )}
    </div>
    </StatusProvider>
  )
}
