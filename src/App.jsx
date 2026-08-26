import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Login from './components/Login'
import Sidebar from './components/Sidebar'
import CustomerList from './components/CustomerList'
import TeamPage from './components/TeamPage'

export default function App() {
  const [session, setSession] = useState(undefined)
  const [profile, setProfile] = useState(null)
  const [page, setPage] = useState('customers')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
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

  if (session === undefined) {
    return <div className="flex min-h-screen items-center justify-center bg-navy-950 text-white">Đang tải...</div>
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
    <div className="flex min-h-screen bg-bg">
      <Sidebar current={page} onNavigate={setPage} profile={profile} />
      {page === 'customers' && <CustomerList currentProfile={profile} />}
      {page === 'team' && <TeamPage currentProfile={profile} />}
    </div>
  )
}
