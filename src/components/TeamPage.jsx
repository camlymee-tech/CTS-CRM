import { useEffect, useState } from 'react'
import { UserPlus, Lock, Unlock, Pencil, Link2, Trash2, Building2, X } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { Button, Input, Select, Badge, Modal } from './ui'
import { laAdmin, laLeader, laQuanLy, tenVaiTro } from '../lib/quyen'

const EMPTY = {
  full_name: '', email: '', password: '', ma_sale: '', role: 'sale', phong_ban: '',
  sdt: '', sdt_lam_viec: '', ngay_sinh: '', ngay_vao_cty: '', link_fb: '',
}

export default function TeamPage({ currentProfile }) {
  const [profiles, setProfiles] = useState([])
  const [all, setAll] = useState([])   // toàn bộ hồ sơ
  const [dsPB, setDsPB] = useState([])  // danh sách phòng ban do quản trị tạo
  const [moPB, setMoPB] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState(null)
  const [message, setMessage] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data }, { data: pb }] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at'),
      supabase.from('phong_ban').select('ten').order('ten'),
    ])
    setDsPB((pb || []).map((x) => x.ten))
    const ds = data || []
    setAll(ds)
    setProfiles(laLeader(currentProfile) ? ds.filter((p) => p.phong_ban && p.phong_ban === currentProfile.phong_ban) : ds)
    setLoading(false)
  }

  async function updateProfile(id, patch) {
    // Leader không sửa trực tiếp được hồ sơ người khác: đi qua hàm quản lý tài khoản (có kiểm tra team)
    const { data, error: fe } = laLeader(currentProfile)
      ? await supabase.functions.invoke('quan-ly-tai-khoan', { body: { action: 'update', id, patch } })
      : { data: null, error: null }
    if (laLeader(currentProfile)) {
      const m = data?.error || fe?.message
      if (m) { setMessage('Lỗi: ' + m); return }
      setMessage(''); load(); return
    }
    const { error } = await supabase.from('profiles').update(patch).eq('id', id)
    if (error) { setMessage('Lỗi: ' + error.message); return }
    setMessage('')
    load()
  }

  // Đổi vai trò, có chặn trường hợp hệ thống không còn quản trị viên nào
  async function changeRole(p, newRole) {
    const soAdmin = profiles.filter((x) => x.role === 'admin').length
    if (p.role === 'admin' && newRole !== 'admin' && soAdmin <= 1) {
      setMessage('Không thể hạ vai trò: hệ thống cần ít nhất một quản trị viên. Hãy nâng người khác lên Quản trị trước.')
      return
    }
    if (newRole === 'leader' && !p.phong_ban) {
      setMessage('Hãy bấm Sửa để nhập Phòng ban cho người này trước khi đặt làm Leader.')
      return
    }
    if (p.id === currentProfile.id && newRole !== 'admin') {
      const ok = window.confirm(
        'Bạn đang tự hạ vai trò của mình. Sau khi lưu, bạn sẽ mất quyền vào trang Nhân sự và chỉ thấy khách hàng của mình. Tiếp tục?'
      )
      if (!ok) return
    }
    updateProfile(p.id, { role: newRole })
  }

  async function deleteAccount(p) {
    const ok = window.confirm(
      `Xoá hẳn tài khoản "${p.full_name || p.email}"?\n\nNgười này sẽ không đăng nhập được nữa và không thể khôi phục.\nNếu chỉ muốn tạm ngưng thì nên dùng nút Khoá.`
    )
    if (!ok) return
    const { data, error } = await supabase.functions.invoke('quan-ly-tai-khoan', { body: { action: 'delete', id: p.id } })
    const msg = data?.error || error?.message
    if (msg) { setMessage(msg); return }
    setMessage('')
    load()
  }

  if (!laQuanLy(currentProfile)) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-ink-600">Chỉ quản trị viên hoặc leader mới xem được trang này.</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-8 py-5">
        <div>
          <h1 className="font-display text-xl font-bold text-navy-900">Nhân sự</h1>
          <p className="text-sm text-ink-600">{laLeader(currentProfile) ? `Tạo tài khoản sale và quản lý hồ sơ team ${currentProfile.phong_ban || ''}` : 'Tạo tài khoản, quản lý hồ sơ và phân quyền cho team'}</p>
        </div>
        <div className="flex gap-2">
          {laAdmin(currentProfile) && (
            <Button variant="secondary" onClick={() => setMoPB(true)}>
              <Building2 size={16} /> Phòng ban
            </Button>
          )}
          <Button onClick={() => setShowCreate(true)}>
            <UserPlus size={16} /> Tạo tài khoản
          </Button>
        </div>
      </header>

      {message && <p className="mx-8 mt-4 rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-600">{message}</p>}

      <div className="mx-8 my-6 overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-ink-400">
              <th className="border border-slate-200 bg-slate-50 px-5 py-3">Nhân sự</th>
              <th className="border border-slate-200 bg-slate-50 px-5 py-3">Phòng ban</th>
              <th className="border border-slate-200 bg-slate-50 px-5 py-3">Mã sale</th>
              <th className="border border-slate-200 bg-slate-50 px-5 py-3">Liên hệ</th>
              <th className="border border-slate-200 bg-slate-50 px-5 py-3">Ngày vào công ty</th>
              <th className="border border-slate-200 bg-slate-50 px-5 py-3">Vai trò</th>
              <th className="border border-slate-200 bg-slate-50 px-5 py-3">Trạng thái</th>
              <th className="border border-slate-200 bg-slate-50 px-5 py-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-5 py-8 text-center text-ink-400">Đang tải...</td></tr>
            ) : profiles.map((p) => {
              const isMe = p.id === currentProfile.id
              return (
                <tr key={p.id}>
                  <td className="border border-slate-200 px-5 py-3">
                    <p className="font-medium text-navy-900">
                      {p.full_name || '—'}
                      {isMe && <span className="ml-2 text-xs text-ink-400">(bạn)</span>}
                    </p>
                    <p className="text-xs text-ink-400">{p.email || '—'}</p>
                  </td>
                  <td className="border border-slate-200 px-5 py-3 text-ink-600">{p.phong_ban || <span className="text-amber-600">Chưa có</span>}</td>
                  <td className="border border-slate-200 px-5 py-3 text-ink-600">{p.ma_sale || '—'}</td>
                  <td className="border border-slate-200 px-5 py-3">
                    <p className="text-ink-600">{p.sdt_lam_viec || p.sdt || '—'}</p>
                    {p.link_fb && (
                      <a href={p.link_fb} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-teal-500 hover:underline">
                        <Link2 size={11} /> Facebook
                      </a>
                    )}
                  </td>
                  <td className="border border-slate-200 px-5 py-3 text-ink-600">{p.ngay_vao_cty || '—'}</td>
                  <td className="border border-slate-200 px-5 py-3">
                    {laAdmin(currentProfile) ? (
                      <Select value={p.role} onChange={(e) => changeRole(p, e.target.value)} className="w-32">
                        <option value="sale">Sale</option>
                        <option value="leader">Leader</option>
                        <option value="admin">Quản trị</option>
                      </Select>
                    ) : <span className="text-ink-600">{tenVaiTro(p.role)}</span>}
                  </td>
                  <td className="border border-slate-200 px-5 py-3">
                    <Badge className={p.active === false ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-700'}>
                      {p.active === false ? 'Đã khoá' : 'Đang hoạt động'}
                    </Badge>
                  </td>
                  <td className="border border-slate-200 whitespace-nowrap px-5 py-3 text-right">
                    {(laAdmin(currentProfile) || p.role === 'sale') && (
                    <button onClick={() => setEditing(p)}
                      className="mr-3 inline-flex items-center gap-1 text-xs text-ink-600 hover:text-coral-500">
                      <Pencil size={13} /> Sửa
                    </button>
                    )}
                    {!isMe && (laAdmin(currentProfile) || p.role === 'sale') && (
                      <button onClick={() => updateProfile(p.id, { active: p.active === false })}
                        className="inline-flex items-center gap-1 text-xs text-ink-600 hover:text-coral-500">
                        {p.active === false ? <><Unlock size={13} /> Mở khoá</> : <><Lock size={13} /> Khoá</>}
                      </button>
                    )}
                    {!isMe && laAdmin(currentProfile) && (
                      <button onClick={() => deleteAccount(p)}
                        className="ml-3 inline-flex items-center gap-1 text-xs text-rose-500 hover:text-rose-700">
                        <Trash2 size={13} /> Xoá
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
        <CreateAccountForm me={currentProfile} dsPhongBan={dsPB}
          onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load() }} />
      )}
      {moPB && <PhongBanModal ds={dsPB} soNguoi={(ten) => all.filter((x) => x.phong_ban === ten).length} onClose={() => setMoPB(false)} onChanged={load} />}
      {editing && (
        <EditProfileForm profile={editing} isMe={editing.id === currentProfile.id} me={currentProfile}
          dsPhongBan={dsPB}
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

// Ô chọn phòng ban (danh sách do quản trị tạo ở nút "Phòng ban")
function PhongBanField({ value, onChange, ds, khoa, bat }) {
  const co = value && !ds.includes(value)   // phòng ban cũ đã bị xoá khỏi danh sách vẫn hiện để không mất dữ liệu
  return (
    <Select label={`Phòng ban${bat ? ' *' : ''}`} required={bat} disabled={khoa} value={value}
      onChange={(e) => onChange(e.target.value)} className={khoa ? 'bg-slate-50 text-ink-400' : ''}>
      <option value="">{ds.length ? '-- Chọn phòng ban --' : '-- Chưa có phòng ban nào --'}</option>
      {co && <option value={value}>{value}</option>}
      {ds.map((x) => <option key={x} value={x}>{x}</option>)}
    </Select>
  )
}

// Quản trị tạo / xoá phòng ban
function PhongBanModal({ ds, soNguoi, onClose, onChanged }) {
  const [ten, setTen] = useState('')
  const [loi, setLoi] = useState('')

  async function them(e) {
    e.preventDefault()
    const t = ten.trim()
    if (!t) return
    if (ds.some((x) => x.toLowerCase() === t.toLowerCase())) { setLoi('Phòng ban này đã có rồi.'); return }
    const { error } = await supabase.from('phong_ban').insert({ ten: t })
    if (error) { setLoi(error.message.includes('phong_ban') ? 'Cần chạy file SQL migration_37 trước.' : error.message); return }
    setTen(''); setLoi(''); onChanged()
  }

  async function xoa(t) {
    if (soNguoi(t) > 0) { setLoi(`Còn ${soNguoi(t)} nhân sự thuộc "${t}". Hãy chuyển họ sang phòng ban khác trước khi xoá.`); return }
    if (!window.confirm(`Xoá phòng ban "${t}"?`)) return
    const { error } = await supabase.from('phong_ban').delete().eq('ten', t)
    if (error) { setLoi(error.message); return }
    setLoi(''); onChanged()
  }

  return (
    <Modal title="Phòng ban (team)" onClose={onClose}>
      <form onSubmit={them} className="flex gap-2">
        <div className="flex-1"><Input value={ten} onChange={(e) => setTen(e.target.value)} placeholder="VD: Team Hà Nội" /></div>
        <Button type="submit">Thêm</Button>
      </form>
      {loi && <p className="mt-3 text-sm text-rose-600">{loi}</p>}
      <table className="mt-4 w-full border-collapse text-sm">
        <thead>
          <tr className="bg-slate-100 text-left font-semibold text-navy-900">
            <th className="border border-slate-200 px-4 py-2.5">Phòng ban</th>
            <th className="border border-slate-200 px-4 py-2.5 text-center">Số nhân sự</th>
            <th className="w-12 border border-slate-200 px-2 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {ds.length === 0 ? (
            <tr><td colSpan={3} className="border border-slate-200 px-4 py-6 text-center text-ink-400">Chưa có phòng ban nào. Hãy thêm phòng ban đầu tiên.</td></tr>
          ) : ds.map((t) => (
            <tr key={t}>
              <td className="border border-slate-200 px-4 py-2.5 font-medium text-navy-900">{t}</td>
              <td className="border border-slate-200 px-4 py-2.5 text-center">{soNguoi(t)}</td>
              <td className="border border-slate-200 px-2 py-2.5 text-center">
                <button type="button" onClick={() => xoa(t)} className="text-ink-400 hover:text-rose-500" title="Xoá phòng ban"><X size={15} /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Modal>
  )
}

function CreateAccountForm({ me, dsPhongBan, onClose, onCreated }) {
  const leader = laLeader(me)
  // Leader chỉ tạo được sale, và sale luôn thuộc phòng ban của leader
  const [form, setForm] = useState({ ...EMPTY, phong_ban: leader ? (me.phong_ban || '') : '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const canPhongBan = form.role !== 'admin'

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    if (leader && !me.phong_ban) { setSaving(false); setError('Hồ sơ của bạn chưa có phòng ban. Hãy nhờ quản trị viên cập nhật trước.'); return }

    const { data, error: fnError } = await supabase.functions.invoke('quan-ly-tai-khoan', {
      body: { action: 'create', profile: { ...form, role: leader ? 'sale' : form.role, phong_ban: canPhongBan ? form.phong_ban : '' } },
    })
    const msg = data?.error || fnError?.message
    if (msg) { setSaving(false); setError(msg); return }

    setSaving(false)
    onCreated()
  }

  return (
    <Modal title={leader ? `Tạo tài khoản sale cho team ${me.phong_ban || ''}` : 'Tạo tài khoản mới'} onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
        <Input label="Họ và tên *" required value={form.full_name}
          onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Nguyễn Văn A" />
        <Input label="Email (Gmail) đăng nhập *" type="email" required value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="ten.sale@gmail.com" />
        {canPhongBan
          ? <PhongBanField value={form.phong_ban} onChange={(v) => setForm({ ...form, phong_ban: v })} ds={dsPhongBan} khoa={leader} bat />
          : <div />}
        <Input label="Mật khẩu *" required minLength={6} value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Ít nhất 6 ký tự" />
        <Input label="Mã sale" value={form.ma_sale}
          onChange={(e) => setForm({ ...form, ma_sale: e.target.value })} placeholder="VD: S01" />
        <div />

        <ProfileFields form={form} setForm={setForm} />

        {leader ? (
          <p className="col-span-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-ink-600">
            Tài khoản mới có vai trò <b>Sale</b>, thuộc phòng ban <b>{me.phong_ban || '—'}</b> của bạn. Sale chỉ thấy khách hàng của mình, còn bạn xem được cả team.
          </p>
        ) : (
          <div className="col-span-2">
            <Select label="Vai trò" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="sale">Sale — chỉ thấy khách của mình</option>
              <option value="leader">Leader — thấy toàn bộ team (phòng ban) của mình, tạo tài khoản sale cho team</option>
              <option value="admin">Quản trị — thấy toàn bộ công ty</option>
            </Select>
          </div>
        )}

        <p className="col-span-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-ink-600">
          Bắt buộc: Họ tên, Email, Mật khẩu{canPhongBan ? ' và Phòng ban' : ''}. Các thông tin còn lại có thể bổ sung sau bằng nút Sửa.
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

function EditProfileForm({ profile, isMe, me, dsPhongBan, onClose, onSaved }) {
  const leader = laLeader(me)
  const [form, setForm] = useState({
    full_name: profile.full_name || '',
    ma_sale: profile.ma_sale || '',
    role: profile.role,
    phong_ban: profile.phong_ban || '',
    sdt: profile.sdt || '',
    sdt_lam_viec: profile.sdt_lam_viec || '',
    ngay_sinh: profile.ngay_sinh || '',
    ngay_vao_cty: profile.ngay_vao_cty || '',
    link_fb: profile.link_fb || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const canPhongBan = form.role !== 'admin'

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const patch = {
      full_name: form.full_name,
      ma_sale: form.ma_sale || null,
      sdt: form.sdt || null,
      sdt_lam_viec: form.sdt_lam_viec || null,
      ngay_sinh: form.ngay_sinh || null,
      ngay_vao_cty: form.ngay_vao_cty || null,
      link_fb: form.link_fb || null,
    }
    if (!leader) { patch.role = form.role; patch.phong_ban = canPhongBan ? (form.phong_ban || null) : null }
    const { error: err } = leader
      ? await supabase.functions.invoke('quan-ly-tai-khoan', { body: { action: 'update', id: profile.id, patch } }).then(({ data, error: fe }) => ({ error: (data?.error || fe?.message) ? { message: data?.error || fe?.message } : null }))
      : await supabase.from('profiles').update(patch).eq('id', profile.id)
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
  }

  return (
    <Modal title={`Hồ sơ: ${profile.full_name || profile.email}`} onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
        <Input label="Họ và tên *" required value={form.full_name}
          onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        <Input label="Email đăng nhập" value={profile.email || ''} disabled className="bg-slate-50 text-ink-400" />
        {canPhongBan
          ? <PhongBanField value={form.phong_ban} onChange={(v) => setForm({ ...form, phong_ban: v })} ds={dsPhongBan} khoa={leader} bat />
          : <div />}
        <Input label="Mã sale" value={form.ma_sale}
          onChange={(e) => setForm({ ...form, ma_sale: e.target.value })} placeholder="VD: S01" />
        <p className="col-span-2 -mt-2 text-xs text-ink-400">Email đăng nhập không sửa được. Cần đổi thì tạo tài khoản mới.</p>

        <ProfileFields form={form} setForm={setForm} />

        {!leader && (
          <div className="col-span-2">
            <Select label="Vai trò" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="sale">Sale — chỉ thấy khách của mình</option>
              <option value="leader">Leader — thấy toàn bộ team (phòng ban) của mình</option>
              <option value="admin">Quản trị — thấy toàn bộ công ty</option>
            </Select>
            {isMe && form.role !== 'admin' && profile.role === 'admin' && (
              <p className="mt-1 text-xs text-orange-600">
                Bạn đang tự hạ vai trò của mình. Sau khi lưu sẽ mất quyền quản trị.
              </p>
            )}
          </div>
        )}

        {error && <p className="col-span-2 text-sm text-rose-600">{error}</p>}

        <div className="col-span-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Hủy</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu hồ sơ'}</Button>
        </div>
      </form>
    </Modal>
  )
}
