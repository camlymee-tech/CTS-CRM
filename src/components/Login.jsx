import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { Button, Input } from './ui'
import logoCts from '../assets/cts-logo.png'

export default function Login() {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/?doi-mat-khau=1`,
        })
        if (error) throw error
        setNotice('Đã gửi email đặt lại mật khẩu. Kiểm tra hộp thư (cả mục Spam) và bấm vào liên kết trong email.')
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
          <img src={logoCts} alt="CTS Group" className="mx-auto mb-3 h-14 w-auto" />
          <h1 className="font-display text-xl font-bold text-navy-900">CTS CRM</h1>
          <p className="text-sm text-ink-600">
            {mode === 'forgot' ? 'Nhập email để nhận link đặt lại mật khẩu' : 'Quản lý khách hàng & dịch vụ'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="ban@email.com" />
          {mode === 'signin' && (
            <Input label="Mật khẩu" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" />
          )}

          {error && <p className="text-sm text-rose-600">{error}</p>}
          {notice && <p className="rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-600">{notice}</p>}

          <Button type="submit" disabled={loading} className="mt-2 w-full">
            {loading ? 'Đang xử lý...' : mode === 'signin' ? 'Đăng nhập' : 'Gửi link đặt lại mật khẩu'}
          </Button>
        </form>

        <div className="mt-4 text-center text-sm">
          <button
            className="text-ink-600 hover:text-coral-500"
            onClick={() => { setMode(mode === 'signin' ? 'forgot' : 'signin'); setError(''); setNotice('') }}
          >
            {mode === 'signin' ? 'Quên mật khẩu?' : '← Quay lại đăng nhập'}
          </button>
        </div>

        {mode === 'signin' && (
          <p className="mt-5 border-t border-slate-100 pt-4 text-center text-xs text-ink-400">
            Tài khoản do quản trị viên cấp. Chưa có tài khoản, liên hệ quản lý của bạn.
          </p>
        )}
      </div>
    </div>
  )
}
