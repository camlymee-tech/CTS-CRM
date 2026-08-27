import { useEffect, useState } from 'react'
import { Plus, Trash2, Pencil } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { Modal, Button, Input, Select, Textarea, Badge } from './ui'
import { formatVnd } from '../lib/constants'

export default function PackagesModal({ onClose }) {
  const [services, setServices] = useState([])
  const [packages, setPackages] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [msg, setMsg] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: sv }, { data: pk }] = await Promise.all([
      supabase.from('services').select('*').eq('active', true).order('ten_dich_vu'),
      supabase.from('service_packages').select('*').order('thu_tu'),
    ])
    setServices(sv || []); setPackages(pk || [])
    setLoading(false)
  }

  async function xoa(p) {
    if (!window.confirm(`Xoá gói "${p.ten_goi}"? Các đơn cũ đã tạo vẫn giữ nguyên giá.`)) return
    const { error } = await supabase.from('service_packages').delete().eq('id', p.id)
    if (error) { setMsg('Không xoá được: ' + error.message); return }
    setMsg(''); load()
  }

  async function batTat(p) {
    await supabase.from('service_packages').update({ active: !p.active }).eq('id', p.id)
    load()
  }

  return (
    <Modal title="Bảng giá gói dịch vụ" onClose={onClose} wide>
      {msg && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{msg}</p>}

      {loading ? <p className="text-sm text-ink-400">Đang tải...</p> : (
        <div className="space-y-5">
          {services.map((sv) => {
            const ds = packages.filter((p) => p.service_id === sv.id)
            return (
              <div key={sv.id}>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-display font-semibold text-navy-900">{sv.ten_dich_vu}</h3>
                  <button
                    onClick={() => setEditing({ service_id: sv.id, ten_goi: '', mo_ta: '', gia: '', so_thang: '', thu_tu: ds.length + 1 })}
                    className="inline-flex items-center gap-1 text-sm text-ink-600 hover:text-coral-500">
                    <Plus size={14} /> Thêm gói
                  </button>
                </div>

                {ds.length === 0 ? (
                  <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-ink-400">Chưa có gói nào.</p>
                ) : (
                  <div className="space-y-1.5">
                    {ds.map((p) => (
                      <div key={p.id}
                        className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 ${
                          p.active ? 'border-slate-200' : 'border-slate-100 bg-slate-50 opacity-60'
                        }`}>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-navy-900">{p.ten_goi}</p>
                            {p.so_thang && <Badge className="bg-teal-50 text-teal-600">{p.so_thang} tháng</Badge>}
                            {!p.active && <Badge className="bg-slate-200 text-slate-600">Đang tắt</Badge>}
                          </div>
                          {p.mo_ta && <p className="mt-0.5 text-xs text-ink-600">{p.mo_ta}</p>}
                        </div>
                        <p className="flex-none font-display font-bold text-coral-500">{formatVnd(p.gia)}</p>
                        <div className="flex flex-none gap-2">
                          <button onClick={() => batTat(p)} className="text-xs text-ink-400 hover:text-navy-900">
                            {p.active ? 'Tắt' : 'Bật'}
                          </button>
                          <button onClick={() => setEditing(p)} className="text-ink-400 hover:text-coral-500">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => xoa(p)} className="text-ink-400 hover:text-rose-500">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {editing && (
        <PackageForm goi={editing} services={services}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }} />
      )}
    </Modal>
  )
}

function PackageForm({ goi, services, onClose, onSaved }) {
  const isEdit = !!goi.id
  const [form, setForm] = useState({
    service_id: goi.service_id || '',
    ten_goi: goi.ten_goi || '',
    mo_ta: goi.mo_ta || '',
    gia: goi.gia ?? '',
    so_thang: goi.so_thang ?? '',
    thu_tu: goi.thu_tu ?? 0,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setSaving(true); setError('')
    const payload = {
      service_id: form.service_id,
      ten_goi: form.ten_goi,
      mo_ta: form.mo_ta || null,
      gia: Number(form.gia) || 0,
      so_thang: form.so_thang ? Number(form.so_thang) : null,
      thu_tu: Number(form.thu_tu) || 0,
    }
    const { error } = isEdit
      ? await supabase.from('service_packages').update(payload).eq('id', goi.id)
      : await supabase.from('service_packages').insert(payload)
    setSaving(false)
    if (error) { setError(error.message); return }
    onSaved()
  }

  return (
    <Modal title={isEdit ? 'Sửa gói dịch vụ' : 'Thêm gói dịch vụ'} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Select label="Thuộc dịch vụ *" required value={form.service_id}
          onChange={(e) => setForm({ ...form, service_id: e.target.value })}>
          <option value="">-- Chọn dịch vụ --</option>
          {services.map((s) => <option key={s.id} value={s.id}>{s.ten_dich_vu}</option>)}
        </Select>
        <Input label="Tên gói *" required value={form.ten_goi}
          onChange={(e) => setForm({ ...form, ten_goi: e.target.value })} placeholder="VD: VIP 1" />
        <Input label="Giá (đ) *" type="number" min="0" step="1000" required value={form.gia}
          onChange={(e) => setForm({ ...form, gia: e.target.value })} />
        <Input label="Thời hạn (tháng)" type="number" min="0" value={form.so_thang}
          onChange={(e) => setForm({ ...form, so_thang: e.target.value })}
          placeholder="Để trống nếu gói không theo tháng" />
        <Textarea label="Mô tả" rows={3} value={form.mo_ta}
          onChange={(e) => setForm({ ...form, mo_ta: e.target.value })}
          placeholder="Quyền lợi trong gói, phù hợp với ai..." />
        <Input label="Thứ tự hiển thị" type="number" value={form.thu_tu}
          onChange={(e) => setForm({ ...form, thu_tu: e.target.value })} />

        {error && <p className="text-sm text-rose-600">{error}</p>}

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Hủy</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu gói'}</Button>
        </div>
      </form>
    </Modal>
  )
}
