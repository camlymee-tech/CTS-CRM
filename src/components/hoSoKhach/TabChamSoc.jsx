// Tab "Chăm sóc" trong hồ sơ khách: danh sách lần chăm sóc + form ghi chăm sóc mới / hẹn lịch.
import { useState } from 'react'
import { Phone, MessageCircle, Users as UsersIcon, MoreHorizontal, Plus, Trash2, CalendarClock } from 'lucide-react'
import { supabase } from '../../supabaseClient'
import { loiDeHieu } from '../../lib/loi'
import { homNayLocal } from '../../lib/ngay'
import { LOAI_TUONG_TAC_OPTIONS } from '../../lib/constants'
import { Button, Textarea, Select } from '../ui'

const ICONS = { goi_dien: Phone, nhan_tin: MessageCircle, gap_mat: UsersIcon, khac: MoreHorizontal }

export function DanhSachChamSoc({ interactions, tenNguoi, xoaDuoc, onXoa }) {
  return (
    interactions.length === 0
      ? <p className="text-sm text-ink-400">Chưa có lịch sử chăm sóc nào.</p>
      : (
        <ul className="space-y-3">
          {interactions.map((it) => {
            const Icon = ICONS[it.loai] || MoreHorizontal
            return (
              <li key={it.id} className="flex gap-3 rounded-xl border border-slate-100 p-3">
                <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-teal-50 text-teal-500">
                  <Icon size={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-navy-900">{it.noi_dung}</p>
                  <p className="mt-0.5 text-xs text-ink-400">
                    {tenNguoi(it.sale_id)} · {new Date(it.ngay_thuc_hien).toLocaleString('vi-VN')}
                  </p>
                </div>
                {xoaDuoc(it) && (
                  <button onClick={() => onXoa(it)}
                    className="flex-none text-ink-400 hover:text-rose-500" title="Xoá">
                    <Trash2 size={14} />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )
  )
}

export function AddInteraction({ customerId, currentProfile, ngayHen, onAdded }) {
  const [noiDung, setNoiDung] = useState('')
  const [loai, setLoai] = useState('goi_dien')
  const [ngayTiepTheo, setNgayTiepTheo] = useState('')
  const [saving, setSaving] = useState(false)

  function congNgay(n) {
    const d = new Date()
    d.setDate(d.getDate() + n)
    setNgayTiepTheo(homNayLocal(d))
  }

  async function submit(e) {
    e.preventDefault()
    if (!noiDung.trim()) return
    setSaving(true)
    const { error } = await supabase.from('customer_interactions').insert({
      customer_id: customerId, sale_id: currentProfile?.id, loai, noi_dung: noiDung.trim(),
    })
    if (error) { setSaving(false); window.alert('Không lưu được trao đổi: ' + loiDeHieu(error)); return }

    const patch = { ngay_lien_he_gan_nhat: homNayLocal() }
    if (ngayTiepTheo) patch.ngay_cham_soc_tiep_theo = ngayTiepTheo
    const { error: loiNgay } = await supabase.from('customers').update(patch).eq('id', customerId)
    if (loiNgay) window.alert('Đã lưu trao đổi nhưng chưa cập nhật được ngày liên hệ / ngày chăm sóc tiếp: ' + loiDeHieu(loiNgay))

    setSaving(false)
    setNoiDung('')
    setNgayTiepTheo('')
    onAdded(ngayTiepTheo || undefined)
  }

  const NHANH = [
    { label: 'Mai', ngay: 1 },
    { label: '3 ngày', ngay: 3 },
    { label: '1 tuần', ngay: 7 },
    { label: '2 tuần', ngay: 14 },
  ]

  return (
    <form onSubmit={submit} className="border-t border-slate-100 px-6 py-4">
      <div className="mb-2">
        <Select value={loai} onChange={(e) => setLoai(e.target.value)} className="w-40">
          {LOAI_TUONG_TAC_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      </div>
      <Textarea rows={2} placeholder="Ghi lại nội dung đã trao đổi với khách..."
        value={noiDung} onChange={(e) => setNoiDung(e.target.value)} />

      <div className="mt-3 rounded-xl bg-slate-50 p-3">
        <div className="flex items-center gap-2 text-sm font-medium text-navy-900">
          <CalendarClock size={15} className="text-coral-500" />
          Hẹn chăm sóc lại
          {ngayHen && !ngayTiepTheo && (
            <span className="font-normal text-ink-400">· đang hẹn {ngayHen}</span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {NHANH.map((n) => (
            <button type="button" key={n.ngay} onClick={() => congNgay(n.ngay)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-ink-600 hover:border-coral-500 hover:text-coral-500">
              {n.label}
            </button>
          ))}
          <input type="date" value={ngayTiepTheo} onChange={(e) => setNgayTiepTheo(e.target.value)}
            className="rounded-lg border border-slate-200 px-2 py-1 text-xs outline-none focus:border-coral-500" />
          {ngayTiepTheo && (
            <button type="button" onClick={() => setNgayTiepTheo('')}
              className="text-xs text-ink-400 hover:text-rose-500">Bỏ chọn</button>
          )}
        </div>
      </div>

      <Button type="submit" disabled={saving} className="mt-3 w-full">
        <Plus size={15} /> {saving ? 'Đang lưu...' : 'Lưu chăm sóc' + (ngayTiepTheo ? ' & đặt lịch hẹn' : '')}
      </Button>
    </form>
  )
}
