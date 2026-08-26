import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { Button, Input } from './ui'

export default function Login() {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setNotice('')
    setLoading(true)
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        })
        if (error) throw error
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/?doi-mat-khau=1`,
        })
        if (error) throw error
        setNotice('Đã gửi email đặt lại mật khẩu. Kiểm tra hộp thư (cả mục Spam) và bấm vào liên kết trong email.')
      }
    } catch (err) {
      setError(
        err.message === 'Invalid login credentials'
          ? 'Sai email hoặc mật khẩu'
          : err.message.includes('already registered')
            ? 'Email này đã có tài khoản rồi'
            : err.message
      )
    } finally {
      setLoading(false)
    }
  }

  const titles = {
    signin: 'Đăng nhập',
    signup: 'Tạo tài khoản',
    forgot: 'Gửi link đặt lại mật khẩu',
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-950 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-coral-500 font-display text-lg font-bold text-white">T</div>
          <h1 className="font-display text-xl font-bold text-navy-900">TUKI CRM</h1>
          <p className="text-sm text-ink-600">
            {mode === 'forgot' ? 'Nhập email để nhận link đặt lại mật khẩu' : 'Quản lý khách hàng & dịch vụ'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {mode === 'signup' && (
            <Input label="Họ tên" value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="Nguyễn Văn A" />
          )}
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="ban@tuki.vn" />
          {mode !== 'forgot' && (
            <Input label="Mật khẩu" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" />
          )}

          {error && <p className="text-sm text-rose-600">{error}</p>}
          {notice && <p className="rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-600">{notice}</p>}

          <Button type="submit" disabled={loading} className="mt-2 w-full">
            {loading ? 'Đang xử lý...' : titles[mode]}
          </Button>
        </form>

        <div className="mt-4 flex flex-col gap-2 text-center text-sm">
          {mode === 'signin' && (
            <>
              <button className="text-ink-600 hover:text-coral-500" onClick={() => { setMode('forgot'); setError(''); setNotice('') }}>
                Quên mật khẩu?
              </button>
              <button className="text-ink-600 hover:text-coral-500" onClick={() => { setMode('signup'); setError(''); setNotice('') }}>
                Chưa có tài khoản? Tạo mới
              </button>
            </>
          )}
          {mode !== 'signin' && (
            <button className="text-ink-600 hover:text-coral-500" onClick={() => { setMode('signin'); setError(''); setNotice('') }}>
              ← Quay lại đăng nhập
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
