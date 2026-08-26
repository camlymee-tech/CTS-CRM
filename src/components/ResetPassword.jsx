import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { Button, Input } from './ui'

export default function ResetPassword({ onDone }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự')
      return
    }
    if (password !== confirm) {
      setError('Hai ô mật khẩu chưa khớp nhau')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    onDone()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-950 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-coral-500 font-display text-lg font-bold text-white">T</div>
          <h1 className="font-display text-xl font-bold text-navy-900">Đặt mật khẩu mới</h1>
          <p className="text-sm text-ink-600">Nhập mật khẩu mới cho tài khoản của bạn</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Input label="Mật khẩu mới" type="password" value={password}
            onChange={(e) => setPassword(e.target.value)} required placeholder="Ít nhất 6 ký tự" />
          <Input label="Nhập lại mật khẩu mới" type="password" value={confirm}
            onChange={(e) => setConfirm(e.target.value)} required placeholder="••••••••" />

          {error && <p className="text-sm text-rose-600">{error}</p>}

          <Button type="submit" disabled={loading} className="mt-2 w-full">
            {loading ? 'Đang lưu...' : 'Lưu mật khẩu mới'}
          </Button>
        </form>
      </div>
    </div>
  )
}
