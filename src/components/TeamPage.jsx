import { useEffect, useState } from 'react'
import { UserPlus, ShieldCheck, User, Lock, Unlock } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { supabaseSignUp } from '../lib/signupClient'
import { Button, Input, Select, Badge, Modal } from './ui'

export default function TeamPage({ currentProfile }) {
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('profiles').select('*').order('created_at')
    setProfiles(data || [])
    setLoading(false)
  }

  async function updateProfile(id, patch) {
    const { error } = await supabase.from('profiles').update(patch).eq('id', id)
    if (error) {
      setMessage('Lỗi: ' + error.message)
      return
    }
    setMessage('')
    load()
  }

  const isAdmin = currentProfile?.role === 'admin'

  if (!isAdmin) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-ink-600">Chỉ quản trị viên mới xem được trang này.</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-8 py-5">
        <div>
          <h1 className="font-display text-xl font-bold text-navy-900">Nhân sự</h1>
          <p className="text-sm text-ink-600">Tạo tài khoản và phân quyền cho team sale</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <UserPlus size={16} /> Tạo tài khoản
        </Button>
      </header>

      {message && <p className="mx-8 mt-4 rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-600">{message}</p>}

      <div className="mx-8 my-6 overflow-hidden rounded-2xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-ink-400">
              <th className="px-5 py-3">Họ tên</th>
              <th className="px-5 py-3">Mã sale</th>
              <th className="px-5 py-3">Vai trò</th>
              <th className="px-5 py-3">Trạng thái</th>
              <th className="px-5 py-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-ink-400">Đang tải...</td></tr>
            ) : profiles.map((p) => {
              const isMe = p.id === currentProfile.id
              return (
                <tr key={p.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-3">
                    <p className="font-medium text-navy-900">
                      {p.full_name || '—'}
                      {isMe && <span className="ml-2 text-xs text-ink-400">(bạn)</span>}
                    </p>
                  </td>
                  <td className="px-5 py-3">
                    <input
                      defaultValue={p.ma_sale || ''}
                      placeholder="VD: S01"
                      onBlur={(e) => {
                        if (e.target.value !== (p.ma_sale || '')) updateProfile(p.id, { ma_sale: e.target.value || null })
                      }}
                      className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-sm outline-none focus:border-coral-500"
                    />
                  </td>
                  <td className="px-5 py-3">
                    {isMe ? (
                      <Badge className="bg-navy-900 text-white">
                        <ShieldCheck size={12} className="mr-1" /> Quản trị
                      </Badge>
                    ) : (
                      <Select
                        value={p.role}
                        onChange={(e) => updateProfile(p.id, { role: e.target.value })}
                        className="w-32"
                      >
                        <option value="sale">Sale</option>
                        <option value="admin">Quản trị</option>
                      </Select>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <Badge className={p.active === false ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-700'}>
                      {p.active === false ? 'Đã khoá' : 'Đang hoạt động'}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {!isMe && (
                      <button
                        onClick={() => updateProfile(p.id, { active: p.active === false })}
                        className="inline-flex items-center gap-1 text-xs text-ink-600 hover:text-coral-500"
                      >
                        {p.active === false ? <><Unlock size={13} /> Mở khoá</> : <><Lock size={13} /> Khoá</>}
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {showForm && (
        <CreateAccountForm
          onClose={() => setShowForm(false)}
          onCreated={() => { setShowForm(false); load() }}
        />
      )}
    </div>
  )
}

function CreateAccountForm({ onClose, onCreated }) {
  const [form, setForm] = useState({ full_name: '', email: '', password: '', ma_sale: '', role: 'sale' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const { data, error: signUpError } = await supabaseSignUp.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.full_name } },
    })

    if (signUpError) {
      setSaving(false)
      setError(signUpError.message.includes('already registered')
        ? 'Email này đã có tài khoản rồi'
        : signUpError.message)
      return
    }

    const newId = data.user?.id
    if (newId && (form.ma_sale || form.role !== 'sale')) {
      // Chờ trigger tạo xong hồ sơ rồi mới cập nhật thêm
      await new Promise((r) => setTimeout(r, 900))
      await supabase.from('profiles').update({
        ma_sale: form.ma_sale || null,
        role: form.role,
      }).eq('id', newId)
    }

    setSaving(false)
    onCreated()
  }

  return (
    <Modal title="Tạo tài khoản mới" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Input label="Họ tên *" required value={form.full_name}
          onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Nguyễn Văn A" />
        <Input label="Email *" type="email" required value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="a.nguyen@tuki.vn" />
        <Input label="Mật khẩu *" required minLength={6} value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Ít nhất 6 ký tự" />
        <Input label="Mã sale" value={form.ma_sale}
          onChange={(e) => setForm({ ...form, ma_sale: e.target.value })} placeholder="VD: S01" />
        <Select label="Vai trò" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          <option value="sale">Sale — chỉ thấy khách của mình</option>
          <option value="admin">Quản trị — thấy toàn bộ team</option>
        </Select>

        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-ink-600">
          <User size={12} className="mr-1 inline" />
          Gửi email và mật khẩu này cho nhân viên để họ đăng nhập. Họ tự đổi mật khẩu sau.
        </p>

        {error && <p className="text-sm text-rose-600">{error}</p>}

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Hủy</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Đang tạo...' : 'Tạo tài khoản'}</Button>
        </div>
      </form>
    </Modal>
  )
}
