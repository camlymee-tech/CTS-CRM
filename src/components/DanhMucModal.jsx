import { useState } from 'react'
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { Modal, Button, Input, Badge } from './ui'
import { DANH_MUC, macDinhCua, dongTuyChinh, taiDanhMuc } from '../lib/danhMuc'
import { DA_AN } from '../lib/constants'

function taoMa(ten) {
  return ten.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40)
}

export default function DanhMucModal({ onClose }) {
  const [loai, setLoai] = useState('dich_vu')
  const [moi, setMoi] = useState('')
  const [sua, setSua] = useState(null)       // { value, label }
  const [msg, setMsg] = useState('')
  const [, ve] = useState(0)

  const cauHinh = DANH_MUC[loai]
  const macDinh = macDinhCua(loai)
  const dong = dongTuyChinh().filter((r) => r.loai === loai)
  const macVal = new Set(macDinh.map((m) => m.value))

  // Danh sách hiển thị = đang bật + đã tắt, giữ thứ tự: mặc định trước, tuỳ chỉnh sau
  const bang = [...cauHinh.mang, ...Object.entries(DA_AN).filter(([v]) =>
    macVal.has(v) || dong.some((r) => r.value === v)).map(([, m]) => ({ ...m, tat: true }))]
  const gop = [
    ...macDinh.map((m) => bang.find((b) => b.value === m.value)).filter(Boolean),
    ...bang.filter((b) => !macVal.has(b.value)),
  ]

  async function xong(error) {
    if (error) { setMsg('Lỗi: ' + error.message + (error.message.includes('danh_muc') ? ' — chị cần chạy file SQL migration_33 trước.' : '')); return }
    setMsg(''); await taiDanhMuc(); ve((x) => x + 1)
  }

  async function them() {
    const label = moi.trim()
    if (!label) return
    const value = taoMa(label)
    if (!value) { setMsg('Tên không hợp lệ, hãy dùng chữ và số.'); return }
    if (gop.some((g) => g.value === value || g.label.toLowerCase() === label.toLowerCase())) {
      setMsg('Đã có mục trùng tên này rồi.'); return
    }
    const { error } = await supabase.from('danh_muc').insert({ loai, value, label, active: true, thu_tu: gop.length + 1 })
    if (!error) setMoi('')
    await xong(error)
  }

  async function luuTen() {
    const label = sua.label.trim()
    if (!label) return
    const { error } = await supabase.from('danh_muc').upsert(
      { loai, value: sua.value, label, active: !sua.tat, thu_tu: dong.find((r) => r.value === sua.value)?.thu_tu ?? 0 },
      { onConflict: 'loai,value' })
    if (!error) setSua(null)
    await xong(error)
  }

  async function batTat(m) {
    const cu = dong.find((r) => r.value === m.value)
    const { error } = await supabase.from('danh_muc').upsert(
      { loai, value: m.value, label: cu?.label || m.label, active: !!m.tat, thu_tu: cu?.thu_tu ?? 0 },
      { onConflict: 'loai,value' })
    await xong(error)
  }

  async function xoa(m) {
    let q = supabase.from('customers').select('id', { count: 'exact', head: true })
    q = cauHinh.mang_cot ? q.contains(cauHinh.cot, [m.value]) : q.eq(cauHinh.cot, m.value)
    const { count } = await q
    if (count > 0) {
      setMsg(`Không xoá được "${m.label}" vì đang có ${count} khách dùng. Chị có thể bấm "Tắt" để ẩn khỏi danh sách chọn.`)
      return
    }
    if (!window.confirm(`Xoá "${m.label}"?`)) return
    const { error } = await supabase.from('danh_muc').delete().eq('loai', loai).eq('value', m.value)
    await xong(error)
  }

  return (
    <Modal title="Dịch vụ" onClose={onClose} wide>
      <div className="mb-4 flex gap-2">
        {Object.entries(DANH_MUC).filter(([k]) => k === 'dich_vu').map(([k, v]) => (
          <button key={k} onClick={() => { setLoai(k); setMsg(''); setSua(null) }}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              loai === k ? 'bg-navy-900 text-white' : 'bg-slate-100 text-ink-600 hover:bg-slate-200'}`}>
            {v.ten}
          </button>
        ))}
      </div>

      <p className="mb-4 rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-ink-600">
        Thay đổi áp dụng cho toàn bộ app: ô chọn trong form khách hàng, bộ lọc và báo cáo.
        Mục có sẵn của hệ thống chỉ đổi tên hoặc tắt, không xoá được.
      </p>
      {msg && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{msg}</p>}

      <div className="mb-4 space-y-1.5">
        {gop.map((m) => {
          const coSan = macVal.has(m.value)
          const dangSua = sua?.value === m.value
          return (
            <div key={m.value}
              className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${m.tat ? 'border-slate-100 bg-slate-50 opacity-60' : 'border-slate-200'}`}>
              {dangSua ? (
                <>
                  <Input value={sua.label} onChange={(e) => setSua({ ...sua, label: e.target.value })} className="flex-1" autoFocus />
                  <button onClick={luuTen} className="text-emerald-600"><Check size={16} /></button>
                  <button onClick={() => setSua(null)} className="text-ink-400"><X size={16} /></button>
                </>
              ) : (
                <>
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="font-medium text-navy-900">{m.label}</span>
                    {coSan && <Badge className="bg-slate-100 text-slate-500">Có sẵn</Badge>}
                    {m.tat && <Badge className="bg-slate-200 text-slate-600">Đang tắt</Badge>}
                  </div>
                  <button onClick={() => batTat(m)} className="text-xs text-ink-400 hover:text-navy-900">{m.tat ? 'Bật' : 'Tắt'}</button>
                  <button onClick={() => setSua({ value: m.value, label: m.label, tat: m.tat })} className="text-ink-400 hover:text-coral-500"><Pencil size={14} /></button>
                  {!coSan && <button onClick={() => xoa(m)} className="text-ink-400 hover:text-rose-500"><Trash2 size={14} /></button>}
                </>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex items-end gap-2 border-t border-slate-100 pt-4">
        <div className="flex-1">
          <Input label={`Thêm ${cauHinh.ten.toLowerCase()} mới`} value={moi} placeholder="Gõ tên rồi bấm Thêm"
            onChange={(e) => setMoi(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); them() } }} />
        </div>
        <Button type="button" variant="secondary" onClick={them}><Plus size={15} /> Thêm</Button>
        <Button type="button" onClick={onClose}>Xong</Button>
      </div>
    </Modal>
  )
}
