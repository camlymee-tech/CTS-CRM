import { useEffect, useState } from 'react'
import { UserPlus, Lock, Unlock, Pencil, Link2 } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { supabaseSignUp } from '../lib/signupClient'
import { Button, Input, Select, Badge, Modal } from './ui'

const EMPTY = {
  full_name: '', email: '', password: '', ma_sale: '', role: 'sale',
  sdt: '', sdt_lam_viec: '', ngay_sinh: '', ngay_vao_cty: '', link_fb: '',
}

export default function TeamPage({ currentProfile }) {
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState(null)
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
    if (error) { setMessage('Lỗi: ' + error.message); return }
    setMessage('')
    load()
  }

  // Đổi vai trò, có chặn trường hợp hệ thống không còn quản trị viên nào
  async function changeRole(p, newRole) {
    const soAdmin = profiles.filter((x) => x.role === 'admin').length
    if (p.role === 'admin' && newRole === 'sale' && soAdmin <= 1) {
      setMessage('Không thể hạ vai trò: hệ thống cần ít nhất một quản trị viên. Hãy nâng người khác lên Quản trị trước.')
      return
    }
    if (p.id === currentProfile.id && newRole === 'sale') {
      const ok = window.confirm(
        'Bạn đang tự hạ mình xuống vai trò Sale. Sau khi lưu, bạn sẽ mất quyền vào trang Nhân sự và chỉ thấy khách hàng của mình. Tiếp tục?'
      )
      if (!ok) return
    }
    updateProfile(p.id, { role: newRole })
  }

  if (currentProfile?.role !== 'admin') {
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
          <p className="text-sm text-ink-600">Tạo tài khoản, quản lý hồ sơ và phân quyền cho team</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <UserPlus size={16} /> Tạo tài khoản
        </Button>
      </header>

      {message && <p className="mx-8 mt-4 rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-600">{message}</p>}

      <div className="mx-8 my-6 overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-ink-400">
              <th className="px-5 py-3">Nhân sự</th>
              <th className="px-5 py-3">Mã sale</th>
              <th className="px-5 py-3">Liên hệ</th>
              <th className="px-5 py-3">Ngày vào công ty</th>
              <th className="px-5 py-3">Vai trò</th>
              <th className="px-5 py-3">Trạng thái</th>
              <th className="px-5 py-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-5 py-8 text-center text-ink-400">Đang tải...</td></tr>
            ) : profiles.map((p) => {
              const isMe = p.id === currentProfile.id
              return (
                <tr key={p.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-3">
                    <p className="font-medium text-navy-900">
                      {p.full_name || '—'}
                      {isMe && <span className="ml-2 text-xs text-ink-400">(bạn)</span>}
                    </p>
                    <p className="text-xs text-ink-400">{p.email || '—'}</p>
                  </td>
                  <td className="px-5 py-3 text-ink-600">{p.ma_sale || '—'}</td>
                  <td className="px-5 py-3">
                    <p className="text-ink-600">{p.sdt_lam_viec || p.sdt || '—'}</p>
                    {p.link_fb && (
                      <a href={p.link_fb} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-teal-500 hover:underline">
                        <Link2 size={11} /> Facebook
                      </a>
                    )}
                  </td>
                  <td className="px-5 py-3 text-ink-600">{p.ngay_vao_cty || '—'}</td>
                  <td className="px-5 py-3">
                    <Select value={p.role} onChange={(e) => changeRole(p, e.target.value)} className="w-32">
                      <option value="sale">Sale</option>
                      <option value="admin">Quản trị</option>
                    </Select>
                  </td>
                  <td className="px-5 py-3">
                    <Badge className={p.active === false ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-700'}>
                      {p.active === false ? 'Đã khoá' : 'Đang hoạt động'}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-right">
                    <button onClick={() => setEditing(p)}
                      className="mr-3 inline-flex items-center gap-1 text-xs text-ink-600 hover:text-coral-500">
                      <Pencil size={13} /> Sửa
                    </button>
                    {!isMe && (
                      <button onClick={() => updateProfile(p.id, { active: p.active === false })}
                        className="inline-flex items-center gap-1 text-xs text-ink-600 hover:text-coral-500">
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

      {showCreate && (
        <CreateAccountForm onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load() }} />
      )}
      {editing && (
        <EditProfileForm profile={editing} isMe={editing.id === currentProfile.id}
          onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />
      )}
    </div>
  )
}

function ProfileFields({ form, setForm }) {
  return (
    <>
      <Input label="Số điện thoại cá nhân" value={form.sdt}
        onChange={(e) => setForm({ ...form, sdt: e.target.value })} placeholder="09xx xxx xxx" />
      <Input label="Số điện thoại làm việc" value={form.sdt_lam_viec}
        onChange={(e) => setForm({ ...form, sdt_lam_viec: e.target.value })} placeholder="09xx xxx xxx" />
      <Input label="Ngày sinh" type="date" value={form.ngay_sinh || ''}
        onChange={(e) => setForm({ ...form, ngay_sinh: e.target.value })} />
      <Input label="Ngày vào công ty" type="date" value={form.ngay_vao_cty || ''}
        onChange={(e) => setForm({ ...form, ngay_vao_cty: e.target.value })} />
      <div className="col-span-2">
        <Input label="Link Facebook" value={form.link_fb}
          onChange={(e) => setForm({ ...form, link_fb: e.target.value })} placeholder="https://facebook.com/..." />
      </div>
    </>
  )
}

function CreateAccountForm({ onClose, onCreated }) {
  const [form, setForm] = useState(EMPTY)
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
        ? 'Email này đã có tài khoản rồi' : signUpError.message)
      return
    }

    const newId = data.user?.id
    if (newId) {
      await new Promise((r) => setTimeout(r, 900))
      await supabase.from('profiles').update({
        full_name: form.full_name,
        ma_sale: form.ma_sale || null,
        role: form.role,
        sdt: form.sdt || null,
        sdt_lam_viec: form.sdt_lam_viec || null,
        ngay_sinh: form.ngay_sinh || null,
        ngay_vao_cty: form.ngay_vao_cty || null,
        link_fb: form.link_fb || null,
      }).eq('id', newId)
    }

    setSaving(false)
    onCreated()
  }

  return (
    <Modal title="Tạo tài khoản mới" onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
        <Input label="Họ và tên *" required value={form.full_name}
          onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Nguyễn Văn A" />
        <Input label="Mã sale" value={form.ma_sale}
          onChange={(e) => setForm({ ...form, ma_sale: e.target.value })} placeholder="VD: S01" />
        <Input label="Email đăng nhập *" type="email" required value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="a.nguyen@tuki.vn" />
        <Input label="Mật khẩu *" required minLength={6} value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Ít nhất 6 ký tự" />

        <ProfileFields form={form} setForm={setForm} />

        <div className="col-span-2">
          <Select label="Vai trò" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="sale">Sale — chỉ thấy khách của mình</option>
            <option value="admin">Quản trị — thấy toàn bộ team</option>
          </Select>
        </div>

        <p className="col-span-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-ink-600">
          Chỉ Họ tên, Email và Mật khẩu là bắt buộc. Các thông tin còn lại có thể bổ sung sau bằng nút Sửa.
          Nhớ gửi email và mật khẩu cho nhân viên để họ đăng nhập.
        </p>

        {error && <p className="col-span-2 text-sm text-rose-600">{error}</p>}

        <div className="col-span-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Hủy</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Đang tạo...' : 'Tạo tài khoản'}</Button>
        </div>
      </form>
    </Modal>
  )
}

function EditProfileForm({ profile, isMe, onClose, onSaved }) {
  const [form, setForm] = useState({
    full_name: profile.full_name || '',
    ma_sale: profile.ma_sale || '',
    role: profile.role,
    sdt: profile.sdt || '',
    sdt_lam_viec: profile.sdt_lam_viec || '',
    ngay_sinh: profile.ngay_sinh || '',
    ngay_vao_cty: profile.ngay_vao_cty || '',
    link_fb: profile.link_fb || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const { error } = await supabase.from('profiles').update({
      full_name: form.full_name,
      ma_sale: form.ma_sale || null,
      role: form.role,
      sdt: form.sdt || null,
      sdt_lam_viec: form.sdt_lam_viec || null,
      ngay_sinh: form.ngay_sinh || null,
      ngay_vao_cty: form.ngay_vao_cty || null,
      link_fb: form.link_fb || null,
    }).eq('id', profile.id)
    setSaving(false)
    if (error) { setError(error.message); return }
    onSaved()
  }

  return (
    <Modal title={`Hồ sơ: ${profile.full_name || profile.email}`} onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
        <Input label="Họ và tên *" required value={form.full_name}
          onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        <Input label="Mã sale" value={form.ma_sale}
          onChange={(e) => setForm({ ...form, ma_sale: e.target.value })} placeholder="VD: S01" />

        <div className="col-span-2">
          <Input label="Email đăng nhập" value={profile.email || ''} disabled
            className="bg-slate-50 text-ink-400" />
          <p className="mt-1 text-xs text-ink-400">Email đăng nhập không sửa được. Cần đổi thì tạo tài khoản mới.</p>
        </div>

        <ProfileFields form={form} setForm={setForm} />

        <div className="col-span-2">
          <Select label="Vai trò" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="sale">Sale — chỉ thấy khách của mình</option>
            <option value="admin">Quản trị — thấy toàn bộ team</option>
          </Select>
          {isMe && form.role === 'sale' && profile.role === 'admin' && (
            <p className="mt-1 text-xs text-orange-600">
              Bạn đang tự hạ vai trò của mình. Sau khi lưu sẽ mất quyền vào trang Nhân sự.
            </p>
          )}
        </div>

        {error && <p className="col-span-2 text-sm text-rose-600">{error}</p>}

        <div className="col-span-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Hủy</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu hồ sơ'}</Button>
        </div>
      </form>
    </Modal>
  )
}
