import { useEffect, useMemo, useState } from 'react'
import { Phone, Plus, X, Target, CircleCheck } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { Button, Select, Input, Badge } from './ui'
import { useTrangThai } from '../lib/StatusContext'
import { homNayLocal } from '../lib/taiKy'
import { maChuaLienHe, maKhNgheMay } from '../lib/nhacViec'

// Mục tiêu ngày: (1) số khách chuyển từ "Chưa liên hệ" sang "KH nghe máy" hôm nay,
// (2) danh sách khách cần liên hệ lại do sale tự chọn — tự báo "Đã hoàn thành" khi đổi trạng thái hoặc có trao đổi mới.
export default function MucTieuNgay({ currentProfile, customers, onMoKhach }) {
  const { statuses, tenTrangThai, classTrangThai } = useTrangThai()
  const [rows, setRows] = useState([])
  const [logs, setLogs] = useState([])
  const [loi, setLoi] = useState('')
  const [tim, setTim] = useState('')
  const [chon, setChon] = useState('')
  const [mucTieu, setMucTieu] = useState({ kh_nghe_may: '', lien_he_lai: '' })   // số mục tiêu sale tự điền

  const homNay = homNayLocal()
  const homNayUtc = new Date().toISOString().slice(0, 10)
  const isAdmin = currentProfile?.role === 'admin'

  useEffect(() => { load() }, [customers])

  async function load() {
    const dauNgay = new Date(); dauNgay.setHours(0, 0, 0, 0)
    const [{ data: mt, error }, { data: lg }, { data: so }] = await Promise.all([
      supabase.from('muc_tieu_ngay').select('*').eq('user_id', currentProfile.id).eq('ngay', homNay).order('created_at'),
      supabase.from('customer_logs').select('customer_id, user_id, hanh_dong, chi_tiet, created_at')
        .eq('hanh_dong', 'Đổi trạng thái').gte('created_at', dauNgay.toISOString()),
      supabase.from('muc_tieu_so').select('loai, muc_tieu').eq('user_id', currentProfile.id).eq('ngay', homNay),
    ])
    setMucTieu({
      kh_nghe_may: so?.find((x) => x.loai === 'kh_nghe_may')?.muc_tieu ?? '',
      lien_he_lai: so?.find((x) => x.loai === 'lien_he_lai')?.muc_tieu ?? '',
    })
    if (error) setLoi(error.message.includes('muc_tieu_ngay') ? 'Cần chạy file SQL migration_36 để dùng phần chọn khách cần liên hệ lại.' : error.message)
    else setLoi('')
    setRows(mt || [])
    setLogs(lg || [])
  }

  const khachTheoId = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers])

  // ---- Mục tiêu 1: KH nghe máy ----
  const maChua = maChuaLienHe(statuses)
  const maNghe = maKhNgheMay(statuses)
  const soNgheMay = logs.filter((l) => {
    if (l.user_id !== currentProfile.id) return false
    const [tu, den] = String(l.chi_tiet || '').split(' → ')
    return maChua.includes(tu) && maNghe.includes(den)
  }).length
  const conChuaLienHe = customers.filter((c) =>
    maChua.includes(c.trang_thai_cham_soc) && (isAdmin || c.sale_id === currentProfile.id)).length

  // ---- Mục tiêu 2: Khách cần liên hệ lại ----
  const danhSach = rows.map((r) => khachTheoId.get(r.customer_id)).filter(Boolean)
  const daXong = (c) =>
    c.ngay_lien_he_gan_nhat === homNay || c.ngay_lien_he_gan_nhat === homNayUtc ||
    logs.some((l) => l.customer_id === c.id)
  const soXong = danhSach.filter(daXong).length

  const daChonIds = new Set(rows.map((r) => r.customer_id))
  const lua = useMemo(() => {
    const t = tim.trim().toLowerCase()
    return customers
      .filter((c) => !daChonIds.has(c.id) && (isAdmin || c.sale_id === currentProfile.id))
      .filter((c) => !t || `${c.ten_khach} ${c.sdt || ''} ${c.ma_khach || ''}`.toLowerCase().includes(t))
      .sort((a, b) => (a.ten_khach || '').localeCompare(b.ten_khach || '', 'vi'))
      .slice(0, 60)
  }, [customers, tim, rows])

  // Sale tự điền số mục tiêu của mình cho hôm nay; để trống = bỏ mục tiêu
  async function luuMucTieu(loai) {
    const v = String(mucTieu[loai]).trim()
    if (v === '') {
      await supabase.from('muc_tieu_so').delete().eq('user_id', currentProfile.id).eq('ngay', homNay).eq('loai', loai)
      return
    }
    const so = Math.max(0, Math.round(Number(v) || 0))
    setMucTieu((m) => ({ ...m, [loai]: so }))
    const { error } = await supabase.from('muc_tieu_so').upsert(
      { user_id: currentProfile.id, ngay: homNay, loai, muc_tieu: so }, { onConflict: 'user_id,ngay,loai' })
    if (error) setLoi(error.message.includes('muc_tieu_so') ? 'Cần chạy file SQL migration_36 để lưu mục tiêu.' : error.message)
  }

  const oSoMucTieu = (loai) => (
    <input type="number" min="0" value={mucTieu[loai]} placeholder="Nhập số"
      onChange={(e) => setMucTieu((m) => ({ ...m, [loai]: e.target.value }))}
      onBlur={() => luuMucTieu(loai)}
      onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur() }}
      className="h-12 w-28 rounded-xl border-2 border-slate-300 bg-slate-50 px-2 text-center font-display text-2xl font-bold text-navy-900 outline-none focus:border-coral-500" />
  )
  const tienDo = (xong, loai) => (mucTieu[loai] !== '' ? `${xong} / ${mucTieu[loai]}` : String(xong))
  const daDat = (xong, loai) => mucTieu[loai] !== '' && Number(mucTieu[loai]) > 0 && xong >= Number(mucTieu[loai])

  async function them() {
    if (!chon) return
    const { error } = await supabase.from('muc_tieu_ngay')
      .insert({ user_id: currentProfile.id, customer_id: chon, ngay: homNay })
    if (error) { setLoi('Không thêm được: ' + error.message); return }
    setChon(''); setTim(''); load()
  }

  async function bo(c) {
    await supabase.from('muc_tieu_ngay').delete()
      .eq('user_id', currentProfile.id).eq('customer_id', c.id).eq('ngay', homNay)
    load()
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Target size={18} className="text-coral-500" />
        <h2 className="font-display text-lg font-semibold text-navy-900">Mục tiêu ngày</h2>
      </div>

      {/* Mục tiêu 1 */}
      <table className="mb-3 w-full border-collapse text-sm">
        <tbody>
          <tr>
            <td className="border border-slate-200 bg-slate-50 px-4 py-4 font-display text-lg font-semibold text-navy-900" style={{ width: '22%' }}>KH nghe máy</td>
            <td className="border border-slate-200 px-4 py-3 text-ink-600">
              Khách chuyển từ trạng thái <b className="text-navy-900">Chưa liên hệ</b> sang <b className="text-navy-900">KH nghe máy</b> trong hôm nay
              <span className="text-ink-400"> · còn {conChuaLienHe} khách chưa liên hệ</span>
            </td>
            <td className="border border-slate-200 px-4 py-3 text-center" style={{ width: 190 }}>
              <span className="mb-1.5 block text-sm font-semibold uppercase tracking-wide text-ink-600">Mục tiêu</span>
              {oSoMucTieu('kh_nghe_may')}
            </td>
            <td className="border border-slate-200 px-4 py-3 text-center" style={{ width: 190 }}>
              <span className="mb-1.5 block text-sm font-semibold uppercase tracking-wide text-ink-600">Hoàn thành</span>
              <p className={`font-display text-4xl font-bold ${daDat(soNgheMay, 'kh_nghe_may') ? 'text-emerald-600' : 'text-navy-900'}`}>{tienDo(soNgheMay, 'kh_nghe_may')}</p>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Mục tiêu 2 */}
      <table className="mb-4 w-full border-collapse text-sm">
        <tbody>
          <tr>
            <td className="border border-slate-200 bg-slate-50 px-4 py-4 font-display text-lg font-semibold text-navy-900" style={{ width: '22%' }}>Khách cần liên hệ lại</td>
            <td className="border border-slate-200 px-4 py-3 text-ink-600">
              Tự báo <b className="text-navy-900">Đã hoàn thành</b> khi bạn đổi trạng thái hoặc ghi trao đổi mới cho khách
            </td>
            <td className="border border-slate-200 px-4 py-3 text-center" style={{ width: 190 }}>
              <span className="mb-1.5 block text-sm font-semibold uppercase tracking-wide text-ink-600">Mục tiêu</span>
              {oSoMucTieu('lien_he_lai')}
            </td>
            <td className="border border-slate-200 px-4 py-3 text-center" style={{ width: 190 }}>
              <span className="mb-1.5 block text-sm font-semibold uppercase tracking-wide text-ink-600">Hoàn thành</span>
              <p className={`font-display text-4xl font-bold ${daDat(soXong, 'lien_he_lai') ? 'text-emerald-600' : 'text-navy-900'}`}>{tienDo(soXong, 'lien_he_lai')}</p>
            </td>
          </tr>
        </tbody>
      </table>

      <div className="mb-3 flex flex-wrap items-end gap-2">
        <div className="w-56">
          <Input label="Tìm khách" value={tim} onChange={(e) => setTim(e.target.value)} placeholder="Tên hoặc số điện thoại" />
        </div>
        <div className="min-w-[260px] flex-1">
          <Select label="Chọn khách từ danh sách" value={chon} onChange={(e) => setChon(e.target.value)}>
            <option value="">-- Chọn khách --</option>
            {lua.map((c) => <option key={c.id} value={c.id}>{c.ten_khach}{c.sdt ? ` · ${c.sdt}` : ''}</option>)}
          </Select>
        </div>
        <Button type="button" onClick={them} disabled={!chon}><Plus size={15} /> Thêm</Button>
      </div>
      {loi && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{loi}</p>}

      {danhSach.length === 0 ? (
        <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-ink-400">Chưa chọn khách nào. Chọn khách ở ô phía trên để đưa vào mục tiêu hôm nay.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-100 text-left text-sm font-semibold text-navy-900">
                <th className="border border-slate-200 px-4 py-2.5">Khách hàng</th>
                <th className="border border-slate-200 px-4 py-2.5">Điện thoại</th>
                <th className="border border-slate-200 px-4 py-2.5">Trạng thái</th>
                <th className="border border-slate-200 px-4 py-2.5">Kết quả</th>
                <th className="border border-slate-200 px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {danhSach.map((c) => {
                const xong = daXong(c)
                return (
                  <tr key={c.id} className="cursor-pointer hover:bg-slate-50" onClick={() => onMoKhach(c)}>
                    <td className="border border-slate-200 px-4 py-2.5">
                      <p className="font-medium text-navy-900">{c.ten_khach}</p>
                      <p className="text-xs text-ink-400">{c.ma_khach}</p>
                    </td>
                    <td className="border border-slate-200 px-4 py-2.5 text-ink-600">{c.sdt || '—'}</td>
                    <td className="border border-slate-200 px-4 py-2.5">
                      <Badge className={classTrangThai(c.trang_thai_cham_soc)}>{tenTrangThai(c.trang_thai_cham_soc)}</Badge>
                    </td>
                    <td className="border border-slate-200 px-4 py-2.5">
                      {xong
                        ? <Badge className="bg-emerald-100 text-emerald-700"><CircleCheck size={12} className="mr-1 inline" />Đã hoàn thành</Badge>
                        : <Badge className="bg-slate-100 text-slate-500">Chưa liên hệ lại</Badge>}
                    </td>
                    <td className="whitespace-nowrap border border-slate-200 px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <a href={c.sdt ? `tel:${c.sdt}` : undefined}
                        className={`mr-2 inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                          c.sdt ? 'bg-teal-50 text-teal-600 hover:bg-teal-100' : 'text-ink-400'}`}>
                        <Phone size={13} /> Gọi
                      </a>
                      <button type="button" onClick={() => bo(c)} title="Bỏ khỏi danh sách hôm nay"
                        className="text-ink-400 hover:text-rose-500"><X size={15} /></button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
