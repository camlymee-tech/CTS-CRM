import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { Button, Input } from './ui'

export default function Login() {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        })
        if (error) throw error
      }
    } catch (err) {
      setError(err.message === 'Invalid login credentials' ? 'Sai email hoặc mật khẩu' : err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-950 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-coral-500 font-display text-lg font-bold text-white">T</div>
          <h1 className="font-display text-xl font-bold text-navy-900">TUKI CRM</h1>
          <p className="text-sm text-ink-600">Quản lý khách hàng & dịch vụ</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {mode === 'signup' && (
            <Input label="Họ tên" value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="Nguyễn Văn A" />
          )}
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="ban@tuki.vn" />
          <Input label="Mật khẩu" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" />

          {error && <p className="text-sm text-rose-600">{error}</p>}

          <Button type="submit" disabled={loading} className="mt-2 w-full">
            {loading ? 'Đang xử lý...' : mode === 'signin' ? 'Đăng nhập' : 'Tạo tài khoản'}
          </Button>
        </form>

        <button
          className="mt-4 w-full text-center text-sm text-ink-600 hover:text-coral-500"
          onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
        >
          {mode === 'signin' ? 'Chưa có tài khoản? Tạo mới' : 'Đã có tài khoản? Đăng nhập'}
        </button>
      </div>
    </div>
  )
}
