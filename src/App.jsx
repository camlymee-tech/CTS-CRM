import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Login from './components/Login'
import Sidebar from './components/Sidebar'
import CustomerList from './components/CustomerList'

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

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar current={page} onNavigate={setPage} profile={profile} />
      {page === 'customers' && <CustomerList currentProfile={profile} />}
    </div>
  )
}
