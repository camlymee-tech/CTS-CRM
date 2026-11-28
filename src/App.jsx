import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { StatusProvider } from './lib/StatusProvider'
import Login from './components/Login'
import ResetPassword from './components/ResetPassword'
import Sidebar from './components/Sidebar'
import { demNhacViec } from './lib/nhacViec'
import { useDanhMuc } from './lib/danhMuc'
import { laAdmin, laQuanLy } from './lib/quyen'

// Mỗi trang chỉ tải khi người dùng mở trang đó (lần đầu vào app nhẹ hơn)
const ChecklistPage = lazy(() => import('./components/ChecklistPage'))
const CustomerList = lazy(() => import('./components/CustomerList'))
const BaoCaoPage = lazy(() => import('./components/BaoCaoPage'))
const TeamPage = lazy(() => import('./components/TeamPage'))
const BaoGiaPage = lazy(() => import('./components/BaoGiaPage'))
const DaoTaoPage = lazy(() => import('./components/DaoTaoPage'))
const DocumentsPage = lazy(() => import('./components/DocumentsPage'))
const NotificationsPage = lazy(() => import('./components/NotificationsPage'))

// Trang đang mở ghi trên địa chỉ web (vd …/#/khach-hang) để F5 không về Checklist và gửi link được.
// Chỉ đọc dạng "#/…" — không đụng tới "#access_token=…" của link đặt lại mật khẩu Supabase.
const DUONG_DAN = {
  checklist: 'checklist', customers: 'khach-hang', baocao: 'bao-cao', pricing: 'tinh-gia',
  documents: 'tai-lieu', daotao: 'dao-tao', notifications: 'thong-bao', team: 'nhan-su',
}
function trangTuDiaChi() {
  const m = window.location.hash.match(/^#\/([^/?]+)/)
  return (m && Object.keys(DUONG_DAN).find((k) => DUONG_DAN[k] === m[1])) || 'checklist'
}

function DangTaiTrang() {
  return <div className="flex flex-1 items-center justify-center text-sm text-ink-400">Đang tải...</div>
}

export default function App() {
  const [session, setSession] = useState(undefined)
  const [profileDaTai, setProfileDaTai] = useState(null)
  // Hồ sơ chỉ dùng khi khớp người đang đăng nhập (đăng xuất / đổi tài khoản → coi như chưa có)
  const profile = session?.user && profileDaTai?.id === session.user.id ? profileDaTai : null
  const [page, setPage] = useState(trangTuDiaChi)
  function chuyenTrang(k) {
    setPage(k)
    const h = '#/' + DUONG_DAN[k]
    if (window.location.hash !== h) window.history.pushState(null, '', h)
  }
  // Nút Quay lại / Tiến tới của trình duyệt, hoặc sửa tay địa chỉ
  useEffect(() => {
    const theoDiaChi = () => setPage(trangTuDiaChi())
    window.addEventListener('popstate', theoDiaChi)
    return () => window.removeEventListener('popstate', theoDiaChi)
  }, [])
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

  // Tải hồ sơ người đăng nhập (tải lại mỗi khi phiên đăng nhập đổi, kể cả lúc tự gia hạn)
  useEffect(() => {
    const uid = session?.user?.id
    if (!uid) return
    let boQua = false
    supabase.from('profiles').select('*').eq('id', uid).single()
      .then(({ data }) => { if (!boQua) setProfileDaTai(data) })
    return () => { boQua = true }
  }, [session])

  const loadUnread = useCallback(async () => {
    if (!profile?.id) return
    const [{ data: notis }, { data: readRows }] = await Promise.all([
      supabase.from('notifications').select('id').limit(200),
      supabase.from('notification_reads').select('notification_id').eq('user_id', profile.id),
    ])
    const daDoc = new Set((readRows || []).map((r) => r.notification_id))
    setUnread((notis || []).filter((n) => !daDoc.has(n.id)).length)
  }, [profile])

  // oxlint-disable-next-line react/set-state-in-effect -- chỉ gán số sau khi tải xong, không vẽ lại liên tục
  useEffect(() => { loadUnread() }, [loadUnread, page])

  // Huy hiệu số việc cần nhắc ở mục Checklist (tái ký hợp đồng ADS + báo cáo chỉ số ADS)
  const loadViecCan = useCallback(async () => {
    if (!profile?.id) return
    try {
      setViecCan(await demNhacViec(supabase, { isAdmin: laAdmin(profile), userId: profile.id, me: profile }))
    } catch { /* bo qua, khong anh huong cac man khac */ }
  }, [profile])

  // oxlint-disable-next-line react/set-state-in-effect -- chỉ gán số sau khi tải xong, không vẽ lại liên tục
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
        onNavigate={chuyenTrang}
        profile={profile}
        unreadCount={unread}
        viecCan={viecCan}
        onChangePassword={() => setRecovering(true)}
      />
      <Suspense fallback={<DangTaiTrang />}>
      {page === 'checklist' && <ChecklistPage currentProfile={profile} onDoiViec={loadViecCan} />}
      {page === 'customers' && <CustomerList currentProfile={profile} />}
      {page === 'baocao' && <BaoCaoPage currentProfile={profile} />}
      {page === 'team' && laQuanLy(profile) && <TeamPage currentProfile={profile} />}
      {page === 'pricing' && <BaoGiaPage currentProfile={profile} />}
      {page === 'daotao' && <DaoTaoPage currentProfile={profile} />}
      {page === 'documents' && <DocumentsPage currentProfile={profile} />}
      {page === 'notifications' && profile && (
        <NotificationsPage currentProfile={profile} onRead={loadUnread} />
      )}
      </Suspense>
    </div>
    </StatusProvider>
  )
}
