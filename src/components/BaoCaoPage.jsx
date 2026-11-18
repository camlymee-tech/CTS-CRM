import { layHet } from '../lib/layHet'
import { useEffect, useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { Select, Input } from './ui'
import { useTrangThai } from '../lib/StatusContext'
import { homNayLocal } from '../lib/taiKy'
import { ngayLocal } from '../lib/danhSachKhach'
import { maChuaLienHe, maKhNgheMay, tinhCanGoiLai, SO_NGAY_GOI_LAI } from '../lib/nhacViec'
import { hienPt2 } from '../lib/dashboardXlsx'
import { xuatBangXlsx } from '../lib/baoCaoXlsx'
import { laQuanLy, locNhanSu } from '../lib/quyen'

const TABS = [
  { key: 'tong_quan', label: 'Tổng quan' },
  { key: 'hieu_suat', label: 'Hiệu suất sale' },
  { key: 'muc_tieu', label: 'Mục tiêu ngày' },
  { key: 'khu_vuc', label: 'Khu vực & trạng thái' },
]

const MAU_HEX = {
  slate: '#94a3b8', orange: '#fb923c', amber: '#f59e0b', emerald: '#10b981', teal: '#14b8a6',
  violet: '#8b5cf6', rose: '#f43f5e', coral: '#ff7a00', sky: '#0ea5e9', navy: '#0a2463',
}

const pad = (n) => String(n).padStart(2, '0')
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const dmy = (s) => String(s).split('-').reverse().join('/')

// Khoảng ngày [từ, đến] (đều tính cả hai đầu)
function khoangKy(ky, tu, den) {
  const d = new Date()
  const hom = ymd(d)
  if (ky === 'hom_nay') return [hom, hom]
  if (ky === '7') { const x = new Date(); x.setDate(x.getDate() - 6); return [ymd(x), hom] }
  if (ky === 'thang_nay') return [`${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`, hom]
  return [tu || hom, den || tu || hom]
}

// Liệt kê các ngày trong khoảng (tối đa 62 ngày)
function cacNgay(tu, den) {
  const out = []
  const d = new Date(`${tu}T00:00:00`)
  const cuoi = new Date(`${den}T00:00:00`)
  while (d <= cuoi && out.length < 62) { out.push(ymd(d)); d.setDate(d.getDate() + 1) }
  return out
}

export default function BaoCaoPage({ currentProfile }) {
  const laAdmin = laQuanLy(currentProfile)   // admin hoặc leader: có ô lọc Sale (leader chỉ thấy team mình)
  const { options: TRANG_THAI, statuses } = useTrangThai()
  const [tab, setTab] = useState('tong_quan')
  const [ky, setKy] = useState('thang_nay')
  const [tu, setTu] = useState(homNayLocal())
  const [den, setDen] = useState(homNayLocal())
  const [locSale, setLocSale] = useState('')
  const [loading, setLoading] = useState(true)
  const [customers, setCustomers] = useState([])
  const [profiles, setProfiles] = useState([])
  const [cs, setCs] = useState([])          // lượt chăm sóc
  const [logs, setLogs] = useState([])      // nhật ký đổi trạng thái
  const [soMt, setSoMt] = useState([])      // mục tiêu số
  const [chonMt, setChonMt] = useState([])  // khách chọn gọi lại

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [a, b, c, d, e, f] = await Promise.all([
      layHet(() => supabase.from('customers').select('id, ten_khach, sale_id, trang_thai_cham_soc, khu_vuc, created_at, ngay_lien_he_gan_nhat').order('id')),
      supabase.from('profiles').select('id, full_name, role, phong_ban').order('full_name'),
      layHet(() => supabase.from('customer_interactions').select('customer_id, sale_id, ngay_thuc_hien, created_at').order('id')),
      supabase.from('customer_logs').select('customer_id, user_id, hanh_dong, chi_tiet, created_at')
        .eq('hanh_dong', 'Đổi trạng thái').order('created_at', { ascending: false }).limit(10000),
      supabase.from('muc_tieu_so').select('user_id, ngay, loai, muc_tieu'),
      supabase.from('muc_tieu_ngay').select('user_id, ngay, customer_id'),
    ])
    setCustomers(a.data || []); setProfiles(b.data || []); setCs(c.data || [])
    setLogs(d.data || []); setSoMt(e.data || []); setChonMt(f.data || [])
    setLoading(false)
  }

  const [tuNgay, denNgay] = useMemo(() => khoangKy(ky, tu, den), [ky, tu, den])
  const trongKy = (x) => !!x && x >= tuNgay && x <= denNgay

  // Sale chỉ xem số của mình
  const saleDangXem = laAdmin ? locSale : currentProfile?.id
  const dsSale = useMemo(() => {
    const sales = locNhanSu(currentProfile, profiles).filter((p) => p.role !== 'admin')
    return saleDangXem ? sales.filter((p) => p.id === saleDangXem) : sales
  }, [profiles, saleDangXem, currentProfile])
  const idSale = useMemo(() => new Set(dsSale.map((s) => s.id)), [dsSale])

  const maChua = maChuaLienHe(statuses)
  const maNghe = maKhNgheMay(statuses)
  const laNgheMay = (l) => {
    const [t, d] = String(l.chi_tiet || '').split(' → ')
    return maChua.includes(t) && maNghe.includes(d)
  }

  // Dữ liệu đã lọc theo sale
  const khach = useMemo(() => customers.filter((c) => idSale.has(c.sale_id)), [customers, idSale])
  const csLoc = useMemo(() => cs.filter((x) => idSale.has(x.sale_id)), [cs, idSale])
  const logLoc = useMemo(() => logs.filter((l) => idSale.has(l.user_id)), [logs, idSale])
  const ngayCs = (x) => ngayLocal(x.ngay_thuc_hien || x.created_at)

  // Khách cần gọi lại (tồn quá 7 ngày) — tình trạng hiện tại
  const canGoiLai = useMemo(
    () => tinhCanGoiLai({ khach: customers, logs, statuses, isAdmin: true }).filter((r) => idSale.has(r.saleId)),
    [customers, logs, statuses, idSale])

  // Mục tiêu theo (ngày, sale)
  const dongMucTieu = useMemo(() => {
    const ngays = cacNgay(tuNgay, denNgay)
    const out = []
    for (const ngay of ngays) {
      for (const s of dsSale) {
        const mtNghe = soMt.find((x) => x.user_id === s.id && x.ngay === ngay && x.loai === 'kh_nghe_may')?.muc_tieu
        const chon = chonMt.filter((x) => x.user_id === s.id && x.ngay === ngay)
        if (mtNghe == null && chon.length === 0) continue
        const nghe = logs.filter((l) => l.user_id === s.id && ngayLocal(l.created_at) === ngay && laNgheMay(l)).length
        const xong = chon.filter((x) =>
          cs.some((i) => i.customer_id === x.customer_id && ngayCs(i) === ngay) ||
          logs.some((l) => l.customer_id === x.customer_id && ngayLocal(l.created_at) === ngay)).length
        const mt = (mtNghe || 0) + chon.length
        const ht = Math.min(nghe, mtNghe || 0) + xong
        out.push({ ngay, sale: s, mtNghe: mtNghe ?? null, nghe, mtLai: chon.length, xong, mt, ht, pt: mt ? ht / mt : null })
      }
    }
    return out.sort((a, b) => (a.ngay < b.ngay ? 1 : a.ngay > b.ngay ? -1 : a.sale.full_name.localeCompare(b.sale.full_name, 'vi')))
  }, [tuNgay, denNgay, dsSale, soMt, chonMt, logs, cs, maChua.join(), maNghe.join()])

  // Hiệu suất từng sale
  const dongSale = useMemo(() => dsSale.map((s) => {
    const mtS = dongMucTieu.filter((r) => r.sale.id === s.id)
    const mt = mtS.reduce((a, r) => a + r.mt, 0)
    const ht = mtS.reduce((a, r) => a + r.ht, 0)
    return {
      sale: s,
      phuTrach: customers.filter((c) => c.sale_id === s.id).length,
      moi: customers.filter((c) => c.sale_id === s.id && trongKy(ngayLocal(c.created_at))).length,
      luot: cs.filter((x) => x.sale_id === s.id && trongKy(ngayCs(x))).length,
      doiTt: logs.filter((l) => l.user_id === s.id && trongKy(ngayLocal(l.created_at))).length,
      nghe: logs.filter((l) => l.user_id === s.id && trongKy(ngayLocal(l.created_at)) && laNgheMay(l)).length,
      ht, mt, pt: mt ? ht / mt : null,
      ton: canGoiLai.filter((r) => r.saleId === s.id).length,
    }
  }), [dsSale, customers, cs, logs, dongMucTieu, canGoiLai, tuNgay, denNgay, maChua.join(), maNghe.join()])

  const tong = useMemo(() => {
    const t = { moi: 0, luot: 0, doiTt: 0, nghe: 0, ht: 0, mt: 0 }
    for (const r of dongSale) { t.moi += r.moi; t.luot += r.luot; t.doiTt += r.doiTt; t.nghe += r.nghe; t.ht += r.ht; t.mt += r.mt }
    return t
  }, [dongSale])

  // Khách theo trạng thái (hiện tại)
  const theoTrangThai = useMemo(() => {
    const n = khach.length
    return TRANG_THAI.map((b) => {
      const so = khach.filter((c) => c.trang_thai_cham_soc === b.ma).length
      return { ...b, so, pt: n ? so / n : 0 }
    }).filter((b) => b.so > 0)
  }, [khach, TRANG_THAI])

  // Khu vực × trạng thái
  const bangKhuVuc = useMemo(() => {
    const m = new Map()
    for (const c of khach) {
      const k = c.khu_vuc || 'Chưa nhập khu vực'
      if (!m.has(k)) m.set(k, {})
      m.get(k)[c.trang_thai_cham_soc] = (m.get(k)[c.trang_thai_cham_soc] || 0) + 1
    }
    return [...m.entries()].map(([ten, dem]) => ({ ten, dem, tong: Object.values(dem).reduce((a, b) => a + b, 0) }))
      .sort((a, b) => b.tong - a.tong)
  }, [khach])

  const tenKy = ky === 'hom_nay' ? `Hôm nay (${dmy(tuNgay)})` : `${dmy(tuNgay)} – ${dmy(denNgay)}`
  const tenSaleXem = laAdmin ? (locSale ? dsSale[0]?.full_name : (currentProfile?.role === 'leader' ? `Team ${currentProfile.phong_ban || ''}` : 'Tất cả sale')) : currentProfile?.full_name
  const phuDe = `Kỳ: ${tenKy} · ${tenSaleXem || ''}`

  // ===== Excel =====
  function taiExcel() {
    if (tab === 'tong_quan') {
      return xuatBangXlsx({
        tieuDe: 'Tổng quan', phuDe,
        heads: ['Chỉ số', 'Giá trị'],
        rows: [
          ['Khách mới thêm', tong.moi], ['Lượt chăm sóc', tong.luot], ['Khách đổi trạng thái', tong.doiTt],
          ['KH nghe máy', tong.nghe], ['Hoàn thành mục tiêu', tong.mt ? hienPt2(tong.ht / tong.mt) : '—'],
          ['Khách cần gọi lại', canGoiLai.length],
          ...theoTrangThai.map((b) => [`Số khách – ${b.ten}`, b.so]),
        ],
        tenFile: `bao-cao-tong-quan-${tuNgay}.xlsx`,
      })
    }
    if (tab === 'hieu_suat') {
      return xuatBangXlsx({
        tieuDe: 'Hiệu suất sale', phuDe,
        heads: ['Sale', 'Số khách phụ trách', 'Khách mới', 'Lượt chăm sóc', 'KH nghe máy', 'Hoàn thành / mục tiêu', '% hoàn thành', `Khách tồn quá ${SO_NGAY_GOI_LAI} ngày`],
        rows: dongSale.map((r) => [r.sale.full_name, r.phuTrach, r.moi, r.luot, r.nghe, `${r.ht} / ${r.mt}`, r.pt == null ? '—' : hienPt2(r.pt), r.ton]),
        tenFile: `bao-cao-hieu-suat-sale-${tuNgay}.xlsx`,
      })
    }
    if (tab === 'muc_tieu') {
      return xuatBangXlsx({
        tieuDe: 'Mục tiêu ngày', phuDe,
        heads: ['Ngày', 'Sale', 'Mục tiêu KH nghe máy', 'Đã nghe máy', 'Khách cần gọi lại (mục tiêu)', 'Đã gọi lại', 'Mục tiêu', 'Hoàn thành', '% đạt'],
        rows: dongMucTieu.map((r) => [dmy(r.ngay), r.sale.full_name, r.mtNghe ?? '—', r.nghe, r.mtLai, r.xong, r.mt, r.ht, r.pt == null ? '—' : hienPt2(r.pt)]),
        tenFile: `bao-cao-muc-tieu-ngay-${tuNgay}.xlsx`,
      })
    }
    return xuatBangXlsx({
      tieuDe: 'Khu vực & trạng thái', phuDe: `Toàn bộ khách hiện có · ${tenSaleXem || ''}`,
      heads: ['Khu vực', 'Tổng', ...TRANG_THAI.map((b) => b.ten)],
      rows: bangKhuVuc.map((r) => [r.ten, r.tong, ...TRANG_THAI.map((b) => r.dem[b.ma] || 0)]),
      tenFile: 'bao-cao-khu-vuc-trang-thai.xlsx',
    })
  }

  const th = 'border border-slate-200 px-4 py-2.5'
  const td = 'border border-slate-200 px-4 py-2.5'

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex gap-1 border-b border-slate-200 bg-white px-8 pt-3">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-3 py-2.5 text-sm transition ${
              tab === t.key ? 'border-coral-500 font-medium text-navy-900' : 'border-transparent text-ink-600 hover:text-navy-900'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-8 mt-6 flex flex-wrap items-end gap-3 rounded-2xl bg-white p-4 shadow-sm">
          {tab !== 'khu_vuc' && (
            <>
              <Select label="Kỳ báo cáo" value={ky} onChange={(e) => setKy(e.target.value)} className="w-44">
                <option value="hom_nay">Hôm nay</option>
                <option value="7">7 ngày qua</option>
                <option value="thang_nay">Tháng này</option>
                <option value="tuy_chon">Chọn ngày...</option>
              </Select>
              {ky === 'tuy_chon' && (
                <>
                  <Input label="Từ ngày" type="date" value={tu} onChange={(e) => setTu(e.target.value)} />
                  <Input label="Đến ngày" type="date" value={den} onChange={(e) => setDen(e.target.value)} />
                </>
              )}
            </>
          )}
          {laAdmin && (
            <Select label="Sale" value={locSale} onChange={(e) => setLocSale(e.target.value)} className="w-52">
              <option value="">Tất cả sale</option>
              {locNhanSu(currentProfile, profiles).filter((p) => p.role !== 'admin').map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </Select>
          )}
          <button type="button" onClick={taiExcel} disabled={loading}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-ink-600 hover:border-coral-500 hover:text-coral-500">
            <Download size={15} /> Tải Excel
          </button>
        </div>

        {loading ? (
          <p className="py-16 text-center text-ink-400">Đang tải...</p>
        ) : (
          <div className="space-y-5 p-8">
            {/* ===== 1. Tổng quan ===== */}
            {tab === 'tong_quan' && (
              <>
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
                  <The nhan="Khách mới thêm" so={tong.moi} />
                  <The nhan="Lượt chăm sóc" so={tong.luot} />
                  <The nhan="Khách đổi trạng thái" so={tong.doiTt} />
                  <The nhan="KH nghe máy" so={tong.nghe} />
                  <The nhan="Hoàn thành mục tiêu" so={tong.mt ? hienPt2(tong.ht / tong.mt) : '—'}
                    phu={tong.mt ? `${tong.ht} / ${tong.mt} việc` : 'Chưa đặt mục tiêu trong kỳ'} cam />
                  <The nhan="Khách cần gọi lại" so={canGoiLai.length} phu={`Báo giá / hẹn đi đơn quá ${SO_NGAY_GOI_LAI} ngày`} />
                </div>

                <section className="rounded-2xl bg-white p-5 shadow-sm">
                  <h2 className="font-display text-base font-semibold text-navy-900">Số khách theo trạng thái</h2>
                  <p className="mt-0.5 text-xs text-ink-400">Tình trạng hiện tại của khách đang phụ trách, không phụ thuộc kỳ báo cáo.</p>
                  {theoTrangThai.length === 0 ? (
                    <p className="py-10 text-center text-sm text-ink-400">Chưa có khách nào.</p>
                  ) : (
                    <>
                      <div className="mt-4 flex h-3.5 overflow-hidden rounded-full bg-slate-100">
                        {theoTrangThai.map((b) => (
                          <div key={b.ma} style={{ width: `${b.pt * 100}%`, backgroundColor: MAU_HEX[b.mau] || MAU_HEX.slate }} title={`${b.ten}: ${b.so} khách`} />
                        ))}
                      </div>
                      <ul className="mt-4 divide-y divide-slate-100">
                        {theoTrangThai.map((b) => {
                          const m = MAU_HEX[b.mau] || MAU_HEX.slate
                          return (
                            <li key={b.ma} className="grid grid-cols-[minmax(150px,240px)_1fr_auto] items-center gap-4 py-2.5">
                              <div className="flex items-center gap-2.5">
                                <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ backgroundColor: m }} />
                                <span className="font-medium text-navy-900">{b.ten}</span>
                              </div>
                              <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                                <div className="h-full rounded-full" style={{ width: `${Math.max(b.pt * 100, 2)}%`, backgroundColor: m }} />
                              </div>
                              <div className="w-32 text-right">
                                <span className="font-display text-lg font-bold text-navy-900">{b.so}</span>
                                <span className="ml-2 text-sm text-ink-400">{hienPt2(b.pt)}</span>
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    </>
                  )}
                </section>
              </>
            )}

            {/* ===== 2. Hiệu suất sale ===== */}
            {tab === 'hieu_suat' && (
              <section className="rounded-2xl bg-white p-5 shadow-sm">
                <h2 className="mb-3 font-display text-base font-semibold text-navy-900">Hiệu suất từng sale <span className="text-sm font-normal text-ink-400">({tenKy})</span></h2>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-100 text-left font-semibold text-navy-900">
                        <th className={th}>Sale</th>
                        <th className={`${th} text-center`}>Số khách phụ trách</th>
                        <th className={`${th} text-center`}>Khách mới</th>
                        <th className={`${th} text-center`}>Lượt chăm sóc</th>
                        <th className={`${th} text-center`}>KH nghe máy</th>
                        <th className={`${th} text-center`}>Hoàn thành / mục tiêu</th>
                        <th className={`${th} text-center`}>% hoàn thành</th>
                        <th className={`${th} text-center`}>Khách tồn quá {SO_NGAY_GOI_LAI} ngày</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dongSale.length === 0 ? (
                        <tr><td colSpan={8} className={`${td} py-6 text-center text-ink-400`}>Chưa có sale nào.</td></tr>
                      ) : dongSale.map((r) => (
                        <tr key={r.sale.id}>
                          <td className={`${td} font-medium text-navy-900`}>{r.sale.full_name}</td>
                          <td className={`${td} text-center`}>{r.phuTrach}</td>
                          <td className={`${td} text-center`}>{r.moi}</td>
                          <td className={`${td} text-center`}>{r.luot}</td>
                          <td className={`${td} text-center`}>{r.nghe}</td>
                          <td className={`${td} text-center`}>{r.ht} / {r.mt}</td>
                          <td className={`${td} text-center font-semibold ${r.pt != null && r.pt >= 1 ? 'text-emerald-600' : 'text-navy-900'}`}>{r.pt == null ? '—' : hienPt2(r.pt)}</td>
                          <td className={`${td} text-center font-semibold ${r.ton > 0 ? 'text-rose-500' : 'text-ink-400'}`}>{r.ton}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* ===== 3. Mục tiêu ngày ===== */}
            {tab === 'muc_tieu' && (
              <section className="rounded-2xl bg-white p-5 shadow-sm">
                <h2 className="mb-1 font-display text-base font-semibold text-navy-900">Mục tiêu ngày theo từng sale <span className="text-sm font-normal text-ink-400">({tenKy})</span></h2>
                <p className="mb-3 text-xs text-ink-400">Mục tiêu = số KH nghe máy sale tự đặt + số khách cần gọi lại sale đã chọn. Chỉ hiện những ngày có đặt mục tiêu.</p>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-100 text-left font-semibold text-navy-900">
                        <th className={th}>Ngày</th>
                        <th className={th}>Sale</th>
                        <th className={`${th} text-center`}>KH nghe máy (đạt / mục tiêu)</th>
                        <th className={`${th} text-center`}>Gọi lại (đạt / mục tiêu)</th>
                        <th className={`${th} text-center`}>Hoàn thành / mục tiêu</th>
                        <th className={`${th} text-center`}>% đạt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dongMucTieu.length === 0 ? (
                        <tr><td colSpan={6} className={`${td} py-6 text-center text-ink-400`}>Chưa có mục tiêu nào trong kỳ này.</td></tr>
                      ) : dongMucTieu.map((r) => (
                        <tr key={r.ngay + r.sale.id}>
                          <td className={td}>{dmy(r.ngay)}</td>
                          <td className={`${td} font-medium text-navy-900`}>{r.sale.full_name}</td>
                          <td className={`${td} text-center`}>{r.nghe} / {r.mtNghe ?? '—'}</td>
                          <td className={`${td} text-center`}>{r.xong} / {r.mtLai}</td>
                          <td className={`${td} text-center`}>{r.ht} / {r.mt}</td>
                          <td className={`${td} text-center font-semibold ${r.pt != null && r.pt >= 1 ? 'text-emerald-600' : r.pt != null && r.pt < 0.5 ? 'text-rose-500' : 'text-navy-900'}`}>{r.pt == null ? '—' : hienPt2(r.pt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* ===== 4. Khu vực & trạng thái ===== */}
            {tab === 'khu_vuc' && (
              <section className="rounded-2xl bg-white p-5 shadow-sm">
                <h2 className="mb-1 font-display text-base font-semibold text-navy-900">Khách theo khu vực và trạng thái</h2>
                <p className="mb-3 text-xs text-ink-400">Tính trên toàn bộ khách hiện có của {laAdmin ? (locSale ? 'sale đang chọn' : (currentProfile?.role === 'leader' ? 'team của bạn' : 'cả team')) : 'bạn'}.</p>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-100 text-left font-semibold text-navy-900">
                        <th className={th}>Khu vực</th>
                        <th className={`${th} text-center`}>Tổng</th>
                        {TRANG_THAI.map((b) => <th key={b.ma} className={`${th} text-center`}>{b.ten}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {bangKhuVuc.length === 0 ? (
                        <tr><td colSpan={2 + TRANG_THAI.length} className={`${td} py-6 text-center text-ink-400`}>Chưa có khách nào.</td></tr>
                      ) : bangKhuVuc.map((r) => (
                        <tr key={r.ten}>
                          <td className={`${td} font-medium text-navy-900`}>{r.ten}</td>
                          <td className={`${td} text-center font-semibold text-navy-900`}>{r.tong}</td>
                          {TRANG_THAI.map((b) => (
                            <td key={b.ma} className={`${td} text-center ${r.dem[b.ma] ? 'text-navy-900' : 'text-slate-300'}`}>{r.dem[b.ma] || 0}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function The({ nhan, so, phu, cam = false }) {
  return (
    <div className="rounded-2xl bg-white px-5 py-4 shadow-sm">
      <p className="text-sm text-ink-600">{nhan}</p>
      <p className={`mt-1 font-display text-3xl font-bold ${cam ? 'text-coral-500' : 'text-navy-900'}`}>{so}</p>
      {phu && <p className="mt-1 text-xs text-ink-400">{phu}</p>}
    </div>
  )
}
