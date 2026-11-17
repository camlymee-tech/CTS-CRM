import { useEffect, useMemo, useState } from 'react'
import { Phone, Plus, X, Target, CircleCheck, Lock, Clock } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { Button, Select, Input, Badge } from './ui'
import { useTrangThai } from '../lib/StatusContext'
import { homNayLocal } from '../lib/taiKy'
import { maChuaLienHe, maKhNgheMay } from '../lib/nhacViec'
import { laQuanLy, locNhanSu } from '../lib/quyen'

// Mục tiêu ngày: (1) số khách chuyển từ "Chưa liên hệ" sang "KH nghe máy" hôm nay,
// (2) danh sách khách cần liên hệ lại do sale tự chọn — tự báo "Đã hoàn thành" khi đổi trạng thái hoặc có trao đổi mới.
export default function MucTieuNgay({ currentProfile, customers, onMoKhach }) {
  // Quản trị / leader xem báo cáo mục tiêu của sale (leader: chỉ team mình); sale mới là người nhập và làm
  if (laQuanLy(currentProfile)) return <KhuQuanLy currentProfile={currentProfile} customers={customers} onMoKhach={onMoKhach} />
  return <MucTieuCuaToi nguoiDung={currentProfile} customers={customers} onMoKhach={onMoKhach} />
}

// Giờ hiện tại theo giờ Việt Nam (để khoá đặt mục tiêu sau 10h sáng)
const GIO_KHOA = 10
function gioVN() {
  const t = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false, hour: '2-digit', minute: '2-digit' })
  const [h, m] = t.split(':').map(Number)
  return { h, m }
}

// Quản trị: xem báo cáo cả team, và đặt / chỉnh mục tiêu thay cho sale (nhất là sau 10h khi sale đã bị khoá)
function KhuQuanLy({ currentProfile, customers, onMoKhach }) {
  const [sales, setSales] = useState([])
  const [saleId, setSaleId] = useState('')
  useEffect(() => {
    supabase.from('profiles').select('id, full_name, role, phong_ban').order('full_name')
      .then(({ data }) => setSales(locNhanSu(currentProfile, data || []).filter((x) => x.role !== 'admin')))
  }, [])
  const sale = sales.find((x) => x.id === saleId)
  return (
    <>
      <BaoCaoMucTieu customers={customers} currentProfile={currentProfile} />
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2 className="font-display text-lg font-semibold text-navy-900">Đặt / chỉnh mục tiêu cho sale</h2>
          <span className="text-xs text-ink-400">Sale chỉ tự đặt được trước 10h sáng. Sau 10h do quản lý đặt.</span>
          <div className="ml-auto w-56">
            <Select value={saleId} onChange={(e) => setSaleId(e.target.value)}>
              <option value="">-- Chọn sale --</option>
              {sales.map((x) => <option key={x.id} value={x.id}>{x.full_name}</option>)}
            </Select>
          </div>
        </div>
        {sale
          ? <MucTieuCuaToi key={sale.id} nguoiDung={currentProfile} chuNhan={sale} quanLy customers={customers} onMoKhach={onMoKhach} nhung />
          : <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-ink-400">Chọn một sale để đặt hoặc chỉnh mục tiêu hôm nay cho bạn ấy.</p>}
      </div>
    </>
  )
}

function MucTieuCuaToi({ nguoiDung, chuNhan, quanLy = false, nhung = false, customers, onMoKhach }) {
  const currentProfile = chuNhan || nguoiDung   // chủ của bộ mục tiêu đang xem
  const [gio, setGio] = useState(gioVN())
  useEffect(() => { const t = setInterval(() => setGio(gioVN()), 30000); return () => clearInterval(t) }, [])
  const khoa = !quanLy && gio.h >= GIO_KHOA        // sale bị khoá sau 10h sáng
  const { statuses, tenTrangThai, classTrangThai } = useTrangThai()
  const [rows, setRows] = useState([])
  const [logs, setLogs] = useState([])
  const [loi, setLoi] = useState('')
  const [tt, setTt] = useState('')   // trạng thái đang chọn để lọc danh sách khách
  const [chon, setChon] = useState('')
  const [mucTieu, setMucTieu] = useState({ kh_nghe_may: '', lien_he_lai: '' })   // số mục tiêu sale tự điền

  const homNay = homNayLocal()
  const homNayUtc = new Date().toISOString().slice(0, 10)
  const isAdmin = false   // luôn lọc theo chủ bộ mục tiêu

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
    if (!tt) return []
    return customers
      .filter((c) => !daChonIds.has(c.id) && (isAdmin || c.sale_id === currentProfile.id))
      .filter((c) => c.trang_thai_cham_soc === tt)
      .sort((a, b) => (a.ten_khach || '').localeCompare(b.ten_khach || '', 'vi'))
      .slice(0, 60)
  }, [customers, tt, rows])

  // Sale tự điền số mục tiêu của mình cho hôm nay; để trống = bỏ mục tiêu
  async function luuMucTieu(loai) {
    if (khoa) return
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
    <input type="number" min="0" value={mucTieu[loai]}
      onChange={(e) => setMucTieu((m) => ({ ...m, [loai]: e.target.value }))}
      onBlur={() => luuMucTieu(loai)}
      onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur() }} disabled={khoa}
      className="h-12 w-28 rounded-xl border-2 border-slate-300 bg-slate-50 px-2 text-center font-display text-2xl font-bold text-navy-900 outline-none focus:border-coral-500 disabled:cursor-not-allowed disabled:opacity-60" />
  )
  const tienDo = (xong, loai) => (mucTieu[loai] !== '' ? `${xong} / ${mucTieu[loai]}` : String(xong))
  const daDat = (xong, loai) => mucTieu[loai] !== '' && Number(mucTieu[loai]) > 0 && xong >= Number(mucTieu[loai])

  async function them() {
    if (!chon || khoa) return
    const { error } = await supabase.from('muc_tieu_ngay')
      .insert({ user_id: currentProfile.id, customer_id: chon, ngay: homNay })
    if (error) { setLoi('Không thêm được: ' + error.message); return }
    setChon(''); load()
  }

  async function bo(c) {
    if (khoa) return
    await supabase.from('muc_tieu_ngay').delete()
      .eq('user_id', currentProfile.id).eq('customer_id', c.id).eq('ngay', homNay)
    load()
  }

  return (
    <div className={nhung ? '' : 'rounded-2xl bg-white p-5 shadow-sm'}>
      {!nhung && (
        <div className="mb-4 flex items-center gap-2">
          <Target size={18} className="text-coral-500" />
          <h2 className="font-display text-lg font-semibold text-navy-900">Mục tiêu ngày</h2>
        </div>
      )}
      {!quanLy && (khoa ? (
        <p className="mb-4 flex items-center gap-2 rounded-lg bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
          <Lock size={15} /> Đã quá 10h sáng nên mục tiêu hôm nay đã khoá. Cần quản lý đặt hoặc chỉnh mục tiêu giúp bạn.
        </p>
      ) : (
        <p className="mb-4 flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          <Clock size={15} /> Đặt mục tiêu ngày trước <b>10:00 sáng</b> (còn {(GIO_KHOA - gio.h) * 60 - gio.m} phút). Sau 10h hệ thống sẽ khoá, chỉ quản lý đặt được.
        </p>
      ))}

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
              <p className="font-display text-4xl font-bold text-navy-900">{danhSach.length}</p>
              <span className="text-xs text-ink-400">= số khách đã chọn</span>
            </td>
            <td className="border border-slate-200 px-4 py-3 text-center" style={{ width: 190 }}>
              <span className="mb-1.5 block text-sm font-semibold uppercase tracking-wide text-ink-600">Hoàn thành</span>
              <p className={`font-display text-4xl font-bold ${danhSach.length > 0 && soXong >= danhSach.length ? 'text-emerald-600' : 'text-navy-900'}`}>{soXong} / {danhSach.length}</p>
            </td>
          </tr>
        </tbody>
      </table>

      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Target size={16} className="text-coral-500" />
        <h3 className="font-display text-base font-semibold text-navy-900">Danh sách khách cần liên hệ lại hôm nay</h3>
        <Badge className="bg-coral-50 text-coral-600">{danhSach.length} khách</Badge>
      </div>
      {!khoa && <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p className="mb-2 text-xs text-ink-600">Thêm khách vào danh sách: chọn <b>trạng thái</b> trước, rồi chọn khách trong trạng thái đó.</p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-64">
            <Select label="1. Chọn trạng thái" value={tt} onChange={(e) => { setTt(e.target.value); setChon('') }}>
              <option value="">-- Chọn trạng thái --</option>
              {statuses.filter((x) => x.active !== false).map((x) => <option key={x.ma} value={x.ma}>{x.ten}</option>)}
            </Select>
          </div>
          <div className="min-w-[260px] flex-1">
            <Select label={tt ? `2. Chọn khách (${lua.length} khách)` : '2. Chọn khách'} value={chon} onChange={(e) => setChon(e.target.value)} disabled={!tt}>
              <option value="">{!tt ? 'Chọn trạng thái trước' : lua.length ? '-- Chọn khách --' : 'Không còn khách ở trạng thái này'}</option>
              {lua.map((c) => <option key={c.id} value={c.id}>{c.ten_khach}{c.sdt ? ` · ${c.sdt}` : ''}</option>)}
            </Select>
          </div>
          <Button type="button" onClick={them} disabled={!chon}><Plus size={15} /> Thêm vào hôm nay</Button>
        </div>
      </div>}
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
                      {!khoa && (
                        <button type="button" onClick={() => bo(c)} title="Bỏ khỏi danh sách hôm nay"
                          className="text-ink-400 hover:text-rose-500"><X size={15} /></button>
                      )}
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


// ---- Báo cáo mục tiêu ngày của từng sale (chỉ xem) — dành cho quản trị ----
function BaoCaoMucTieu({ customers, currentProfile }) {
  const { statuses } = useTrangThai()
  const [ngay, setNgay] = useState(homNayLocal())
  const [sales, setSales] = useState([])
  const [so, setSo] = useState([])
  const [chon, setChon] = useState([])
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [ngay])

  async function load() {
    setLoading(true)
    const dau = new Date(`${ngay}T00:00:00`); const cuoi = new Date(dau); cuoi.setDate(cuoi.getDate() + 1)
    const [{ data: p }, { data: a }, { data: b }, { data: c }] = await Promise.all([
      supabase.from('profiles').select('id, full_name, role, phong_ban').order('full_name'),
      supabase.from('muc_tieu_so').select('user_id, loai, muc_tieu').eq('ngay', ngay),
      supabase.from('muc_tieu_ngay').select('user_id, customer_id').eq('ngay', ngay),
      supabase.from('customer_logs').select('customer_id, user_id, hanh_dong, chi_tiet, created_at')
        .eq('hanh_dong', 'Đổi trạng thái').gte('created_at', dau.toISOString()).lt('created_at', cuoi.toISOString()),
    ])
    setSales(locNhanSu(currentProfile, p || []).filter((x) => x.role !== 'admin'))
    setSo(a || []); setChon(b || []); setLogs(c || [])
    setLoading(false)
  }

  const maChua = maChuaLienHe(statuses)
  const maNghe = maKhNgheMay(statuses)
  const khachTheoId = new Map(customers.map((c) => [c.id, c]))

  const dong = sales.map((sl) => {
    const mt = (loai) => so.find((x) => x.user_id === sl.id && x.loai === loai)?.muc_tieu
    const nghe = logs.filter((l) => {
      if (l.user_id !== sl.id) return false
      const [tu, den] = String(l.chi_tiet || '').split(' → ')
      return maChua.includes(tu) && maNghe.includes(den)
    }).length
    const ds = chon.filter((x) => x.user_id === sl.id).map((x) => khachTheoId.get(x.customer_id)).filter(Boolean)
    const xong = ds.filter((c) => c.ngay_lien_he_gan_nhat === ngay || logs.some((l) => l.customer_id === c.id)).length
    return { sl, nghe, mtNghe: mt('kh_nghe_may'), xong, tong: ds.length, mtLai: ds.length }
  })

  const o = (xong, mt) => (
    <>
      <span className={`font-display text-2xl font-bold ${mt > 0 && xong >= mt ? 'text-emerald-600' : 'text-navy-900'}`}>{xong}</span>
      <span className="font-display text-xl text-ink-400"> / {mt ?? '—'}</span>
    </>
  )

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Target size={18} className="text-coral-500" />
        <h2 className="font-display text-lg font-semibold text-navy-900">Báo cáo mục tiêu ngày của team</h2>
        <input type="date" value={ngay} onChange={(e) => setNgay(e.target.value)}
          className="ml-auto rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-navy-900" />
      </div>
      {loading ? <p className="py-6 text-center text-ink-400">Đang tải...</p> : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-100 text-left text-sm font-semibold text-navy-900">
                <th className="border border-slate-200 px-4 py-2.5">Sale</th>
                <th className="border border-slate-200 px-4 py-2.5 text-center">KH nghe máy (hoàn thành / mục tiêu)</th>
                <th className="border border-slate-200 px-4 py-2.5 text-center">Khách cần liên hệ lại (hoàn thành / mục tiêu)</th>
              </tr>
            </thead>
            <tbody>
              {dong.length === 0 ? (
                <tr><td colSpan={3} className="border border-slate-200 px-4 py-6 text-center text-ink-400">Chưa có sale nào.</td></tr>
              ) : dong.map((r) => (
                <tr key={r.sl.id}>
                  <td className="border border-slate-200 px-4 py-3 font-medium text-navy-900">{r.sl.full_name}</td>
                  <td className="border border-slate-200 px-4 py-3 text-center">{o(r.nghe, r.mtNghe)}</td>
                  <td className="border border-slate-200 px-4 py-3 text-center">
                    {o(r.xong, r.mtLai)}
                    <p className="text-xs text-ink-400">đã chọn {r.tong} khách</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
