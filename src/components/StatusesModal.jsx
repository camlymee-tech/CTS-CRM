import { useEffect, useState } from 'react'
import { Plus, Trash2, Pencil, GripVertical } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { Modal, Button, Input, Select, Badge } from './ui'
import { useTrangThai, MAU_BADGE, DANH_SACH_MAU } from '../lib/StatusContext'

// Tạo mã từ tên: "Chờ báo giá" -> "cho_bao_gia"
function taoMa(ten) {
  return ten
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
}

export default function StatusesModal({ onClose }) {
  const { statuses, reload } = useTrangThai()
  const [editing, setEditing] = useState(null)
  const [msg, setMsg] = useState('')

  async function xoa(s) {
    const { count } = await supabase.from('customers')
      .select('id', { count: 'exact', head: true }).eq('trang_thai_cham_soc', s.ma)
    if (count > 0) {
      setMsg(`Không xoá được "${s.ten}" vì đang có ${count} khách ở trạng thái này. Hãy chuyển những khách đó sang trạng thái khác trước, hoặc chỉ cần tắt trạng thái này.`)
      return
    }
    if (!window.confirm(`Xoá trạng thái "${s.ten}"?`)) return
    const { error } = await supabase.from('customer_statuses').delete().eq('ma', s.ma)
    if (error) { setMsg('Không xoá được: ' + error.message); return }
    setMsg(''); reload()
  }

  async function batTat(s) {
    await supabase.from('customer_statuses').update({ active: !s.active }).eq('ma', s.ma)
    reload()
  }

  return (
    <Modal title="Trạng thái khách hàng" onClose={onClose} wide>
      <p className="mb-4 rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-ink-600">
        Thay đổi ở đây áp dụng cho toàn bộ app: dropdown chọn trạng thái, thẻ đếm, bộ lọc và báo cáo.
      </p>

      {msg && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{msg}</p>}

      <div className="mb-4 space-y-1.5">
        {statuses.map((s) => (
          <div key={s.ma}
            className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 ${
              s.active ? 'border-slate-200' : 'border-slate-100 bg-slate-50 opacity-60'
            }`}>
            <GripVertical size={14} className="mt-1 flex-none text-ink-400" />

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={MAU_BADGE[s.mau] || MAU_BADGE.slate}>{s.ten}</Badge>
                {!s.active && <Badge className="bg-slate-200 text-slate-600">Đang tắt</Badge>}
              </div>
              <p className="mt-1 text-xs text-ink-600">
                {s.la_chot && <span className="mr-2">Tính là đã ký</span>}
                {s.tao_don && <span className="mr-2">Mời tạo đơn dịch vụ</span>}
                {s.chung_sau_ngay === null || s.chung_sau_ngay === undefined
                  ? 'Riêng của sale'
                  : s.chung_sau_ngay === 0
                    ? 'Thành data chung ngay'
                    : `Thành data chung sau ${s.chung_sau_ngay} ngày`}
              </p>
            </div>

            <button onClick={() => batTat(s)} className="flex-none text-xs text-ink-400 hover:text-navy-900">
              {s.active ? 'Tắt' : 'Bật'}
            </button>
            <button onClick={() => setEditing(s)} className="flex-none text-ink-400 hover:text-coral-500">
              <Pencil size={14} />
            </button>
            <button onClick={() => xoa(s)} className="flex-none text-ink-400 hover:text-rose-500">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      <div className="flex justify-between border-t border-slate-100 pt-4">
        <Button type="button" variant="secondary"
          onClick={() => setEditing({ ma: '', ten: '', mau: 'slate', thu_tu: statuses.length + 1, la_chot: false, tao_don: false, chung_sau_ngay: '' })}>
          <Plus size={15} /> Thêm trạng thái
        </Button>
        <Button type="button" onClick={onClose}>Xong</Button>
      </div>

      {editing && (
        <StatusForm tt={editing} onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); setMsg(''); reload() }} />
      )}
    </Modal>
  )
}

function StatusForm({ tt, onClose, onSaved }) {
  const isEdit = !!tt.ma
  const [form, setForm] = useState({
    ten: tt.ten || '',
    mau: tt.mau || 'slate',
    thu_tu: tt.thu_tu ?? 0,
    la_chot: !!tt.la_chot,
    tao_don: !!tt.tao_don,
    // '' = riêng của sale, số = số ngày
    chung_sau_ngay: tt.chung_sau_ngay === null || tt.chung_sau_ngay === undefined ? '' : String(tt.chung_sau_ngay),
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    if (!form.ten.trim()) return
    setSaving(true); setError('')

    const payload = {
      ten: form.ten.trim(),
      mau: form.mau,
      thu_tu: Number(form.thu_tu) || 0,
      la_chot: form.la_chot,
      tao_don: form.tao_don,
      chung_sau_ngay: form.chung_sau_ngay === '' ? null : Number(form.chung_sau_ngay),
    }

    let error
    if (isEdit) {
      ({ error } = await supabase.from('customer_statuses').update(payload).eq('ma', tt.ma))
    } else {
      const ma = taoMa(form.ten)
      if (!ma) { setSaving(false); setError('Tên không hợp lệ, hãy dùng chữ và số.'); return }
      ({ error } = await supabase.from('customer_statuses').insert({ ...payload, ma, active: true }))
    }

    setSaving(false)
    if (error) {
      setError(error.message.includes('duplicate') || error.message.includes('primary key')
        ? 'Đã có trạng thái trùng tên này rồi.'
        : error.message)
      return
    }
    onSaved()
  }

  return (
    <Modal title={isEdit ? `Sửa trạng thái: ${tt.ten}` : 'Thêm trạng thái mới'} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Input label="Tên trạng thái *" required value={form.ten}
          onChange={(e) => setForm({ ...form, ten: e.target.value })}
          placeholder="VD: Chờ báo giá" />

        <div className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-navy-900">Màu hiển thị</span>
          <div className="flex flex-wrap gap-2">
            {DANH_SACH_MAU.map((m) => (
              <button type="button" key={m} onClick={() => setForm({ ...form, mau: m })}
                className={`rounded-full px-3 py-1 text-xs transition ${MAU_BADGE[m]} ${
                  form.mau === m ? 'ring-2 ring-coral-500 ring-offset-1' : ''
                }`}>
                {form.ten || 'Xem thử'}
              </button>
            ))}
          </div>
        </div>

        <Select label="Khi nào thành data chung"
          value={form.chung_sau_ngay}
          onChange={(e) => setForm({ ...form, chung_sau_ngay: e.target.value })}>
          <option value="">Không bao giờ — riêng của sale</option>
          <option value="0">Ngay lập tức</option>
          <option value="5">Sau 5 ngày im lặng</option>
          <option value="15">Sau 15 ngày im lặng</option>
          <option value="30">Sau 30 ngày im lặng</option>
          <option value="60">Sau 60 ngày im lặng</option>
        </Select>

        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={form.la_chot} className="mt-0.5 h-4 w-4 rounded border-slate-300"
            onChange={(e) => setForm({ ...form, la_chot: e.target.checked })} />
          <span>
            <b className="text-navy-900">Tính là đã ký hợp đồng</b>
            <span className="block text-xs text-ink-600">Khách ở trạng thái này không hiện trong danh sách cần chăm sóc</span>
          </span>
        </label>

        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={form.tao_don} className="mt-0.5 h-4 w-4 rounded border-slate-300"
            onChange={(e) => setForm({ ...form, tao_don: e.target.checked })} />
          <span>
            <b className="text-navy-900">Mời tạo đơn dịch vụ</b>
            <span className="block text-xs text-ink-600">Chuyển sang trạng thái này thì app tự mở form tạo đơn</span>
          </span>
        </label>

        <Input label="Thứ tự hiển thị" type="number" value={form.thu_tu}
          onChange={(e) => setForm({ ...form, thu_tu: e.target.value })} />

        {error && <p className="text-sm text-rose-600">{error}</p>}

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Hủy</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu trạng thái'}</Button>
        </div>
      </form>
    </Modal>
  )
}
