import { layHet } from '../lib/layHet'
import { Fragment, useEffect, useMemo, useState } from 'react'
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
  { key: 'muc_tieu', label: 'Báo cáo mục tiêu' },
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
  if (ky === 'tat_ca') return ['0000-01-01', hom]
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
    const laSale = currentProfile?.role === 'sale'
    const truyVanProfiles = supabase.from('profiles').select('id, full_name, role, phong_ban').order('full_name')
    // Sale không xem trực tiếp được khách/nhật ký của đồng nghiệp: dùng hàm team_* (chỉ trả số liệu, không có tên/SĐT khách)
    const [a, b, c, d, e, f] = laSale ? await Promise.all([
      layHet(() => supabase.rpc('team_khach')),
      truyVanProfiles,
      layHet(() => supabase.rpc('team_interactions')),
      layHet(() => supabase.rpc('team_logs')),
      layHet(() => supabase.rpc('team_muc_tieu_so')),
      layHet(() => supabase.rpc('team_muc_tieu_ngay')),
    ]) : await Promise.all([
      layHet(() => supabase.from('customers').select('id, ten_khach, sale_id, trang_thai_cham_soc, khu_vuc, created_at, ngay_lien_he_gan_nhat').order('id')),
      truyVanProfiles,
      layHet(() => supabase.from('customer_interactions').select('customer_id, sale_id, ngay_thuc_hien, created_at').order('id')),
      layHet(() => supabase.from('customer_logs').select('customer_id, user_id, hanh_dong, chi_tiet, created_at')
        .eq('hanh_dong', 'Đổi trạng thái').order('created_at', { ascending: false }).order('id')),
      layHet(() => supabase.from('muc_tieu_so').select('user_id, ngay, loai, muc_tieu').order('user_id').order('ngay').order('loai')),
      layHet(() => supabase.from('muc_tieu_ngay').select('user_id, ngay, customer_id').order('user_id').order('ngay').order('customer_id')),
    ])
    setCustomers(a.data || []); setProfiles(b.data || []); setCs(c.data || [])
    setLogs(d.data || []); setSoMt(e.data || []); setChonMt(f.data || [])
    setLoading(false)
  }

  const [tuNgay, denNgay] = useMemo(() => khoangKy(ky, tu, den), [ky, tu, den])
  const trongKy = (x) => !!x && x >= tuNgay && x <= denNgay

  // Phạm vi xem: admin = tất cả phòng · leader và sale = các thành viên cùng phòng ban của mình
  const thanhVien = useMemo(() => {
    const khongAdmin = profiles.filter((p) => p.role !== 'admin')
    if (currentProfile?.role === 'admin') return khongAdmin
    if (currentProfile?.phong_ban) return khongAdmin.filter((p) => p.phong_ban === currentProfile.phong_ban)
    return khongAdmin.filter((p) => p.id === currentProfile?.id)
  }, [profiles, currentProfile])
  const saleDangXem = laAdmin ? locSale : ''
  const dsSale = useMemo(() => (saleDangXem ? thanhVien.filter((p) => p.id === saleDangXem) : thanhVien), [thanhVien, saleDangXem])
  const idSale = useMemo(() => new Set(dsSale.map((s) => s.id)), [dsSale])

  const maChua = maChuaLienHe(statuses)
  const maNghe = maKhNgheMay(statuses)
  // Quy ước: đổi trạng thái từ "Chưa liên hệ" sang bất kỳ trạng thái nào = 1 lần KH liên hệ được
  const tachLog = (l) => { const [tu, den] = String(l.chi_tiet || '').split(' → '); return { tu, den, doi: !!tu && !!den && tu !== den } }
  const laNgheMay = (l) => { const x = tachLog(l); return x.doi && maChua.includes(x.tu) }
  // Đổi trạng thái từ trạng thái khác (không phải Chưa liên hệ) sang trạng thái mới = 1 lượt chăm sóc
  const laChamSoc = (l) => { const x = tachLog(l); return x.doi && !maChua.includes(x.tu) }

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

  const laAdminHan = currentProfile?.role === 'admin'
  const tenPB = (s) => s.phong_ban || 'Chưa có phòng ban'
  const tb1 = (x) => (Math.round(x * 10) / 10).toLocaleString('vi-VN')

  // ===== Tab 1: Tổng quan — khách theo trạng thái, lọc theo ngày thêm khách =====
  const khachKy = useMemo(() => khach.filter((c) => trongKy(ngayLocal(c.created_at))), [khach, tuNgay, denNgay])
  const demTT = useMemo(() => TRANG_THAI.map((b) => ({ ...b, so: khachKy.filter((c) => c.trang_thai_cham_soc === b.ma).length })), [khachKy, TRANG_THAI])

  // Admin: chia theo từng phòng (thêm dòng "Chưa chia sale" cho khách chưa có sale)
  const bangPhong = useMemo(() => {
    if (!laAdminHan) return []
    const m = new Map()
    const lay = (k) => { if (!m.has(k)) m.set(k, { ten: k, dem: {}, tong: 0, soSale: 0 }); return m.get(k) }
    const phongCua = new Map()
    for (const s of dsSale) { phongCua.set(s.id, tenPB(s)); lay(tenPB(s)).soSale += 1 }
    for (const c of khachKy) { const o = lay(phongCua.get(c.sale_id) || 'Chưa có phòng ban'); o.dem[c.trang_thai_cham_soc] = (o.dem[c.trang_thai_cham_soc] || 0) + 1; o.tong += 1 }
    if (!locSale) {
      const chua = customers.filter((c) => !c.sale_id && trongKy(ngayLocal(c.created_at)))
      if (chua.length) {
        const o = lay('Chưa chia sale'); o.chua = true
        for (const c of chua) { o.dem[c.trang_thai_cham_soc] = (o.dem[c.trang_thai_cham_soc] || 0) + 1; o.tong += 1 }
      }
    }
    return [...m.values()].sort((a, b) => (a.chua ? 1 : 0) - (b.chua ? 1 : 0) || a.ten.localeCompare(b.ten, 'vi'))
  }, [laAdminHan, dsSale, khachKy, customers, locSale, tuNgay, denNgay])

  // Ngày khách đã chuyển từ "Chưa liên hệ" → trong ngày đó các lần đổi tiếp theo chỉ tính là KH liên hệ được, không tính chăm sóc
  const lanLienHeDau = useMemo(() => {
    const set = new Set()
    for (const l of logs) if (laNgheMay(l)) set.add(`${l.customer_id}|${ngayLocal(l.created_at)}`)
    return set
  }, [logs, maChua.join()])

  // Chi tiết: từng phòng → từng sale (admin thấy mọi phòng · leader, sale chỉ thấy phòng mình)
  const chiTiet = useMemo(() => {
    const m = new Map()
    for (const sl of dsSale) {
      const mine = khachKy.filter((c) => c.sale_id === sl.id)
      if (sl.role === 'leader' && mine.length === 0) continue
      const dem = {}
      for (const c of mine) dem[c.trang_thai_cham_soc] = (dem[c.trang_thai_cham_soc] || 0) + 1
      const k = tenPB(sl)
      if (!m.has(k)) m.set(k, [])
      m.get(k).push({ sale: sl, dem, tong: mine.length })
    }
    return [...m.entries()].sort((x, y) => x[0].localeCompare(y[0], 'vi')).map(([ten, rows]) => {
      const dem = {}; let tong = 0
      for (const r of rows) { tong += r.tong; for (const [k, v] of Object.entries(r.dem)) dem[k] = (dem[k] || 0) + v }
      return { ten, rows, dem, tong }
    })
  }, [dsSale, khachKy])

  // ===== Tab 2: Báo cáo mục tiêu — từng phòng, từng sale, tổng & trung bình =====
  const dongSale = useMemo(() => dsSale.map((s) => {
    const mtS = dongMucTieu.filter((r) => r.sale.id === s.id)
    const mt = mtS.reduce((a, r) => a + r.mt, 0)
    const ht = mtS.reduce((a, r) => a + r.ht, 0)
    return {
      sale: s,
      phuTrach: customers.filter((c) => c.sale_id === s.id).length,
      moi: customers.filter((c) => c.sale_id === s.id && trongKy(ngayLocal(c.created_at))).length,
      luot: logs.filter((l) => l.user_id === s.id && trongKy(ngayLocal(l.created_at)) && laChamSoc(l) && !lanLienHeDau.has(`${l.customer_id}|${ngayLocal(l.created_at)}`)).length,
      nghe: logs.filter((l) => l.user_id === s.id && trongKy(ngayLocal(l.created_at)) && laNgheMay(l)).length,
      ht, mt, pt: mt ? ht / mt : null,
      ton: canGoiLai.filter((r) => r.saleId === s.id).length,
    }
  }), [dsSale, customers, cs, logs, dongMucTieu, canGoiLai, tuNgay, denNgay, maChua.join(), maNghe.join()])

  const dongHienThi = useMemo(() => dongSale.filter((r) => r.sale.role !== 'leader' || r.phuTrach > 0 || r.mt > 0 || r.luot > 0), [dongSale])
  const KEYS = ['phuTrach', 'moi', 'luot', 'nghe', 'ht', 'mt', 'ton']
  const gopNhom = (ten, rows) => {
    const sum = Object.fromEntries(KEYS.map((k) => [k, rows.reduce((a, r) => a + r[k], 0)]))
    const co = rows.filter((r) => r.pt != null)
    return { ten, rows, sum, n: rows.length, ptTong: sum.mt ? sum.ht / sum.mt : null, ptTb: co.length ? co.reduce((a, r) => a + r.pt, 0) / co.length : null }
  }
  const nhomPhong = useMemo(() => {
    const m = new Map()
    for (const r of dongHienThi) { const k = tenPB(r.sale); if (!m.has(k)) m.set(k, []); m.get(k).push(r) }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'vi')).map(([ten, rows]) => gopNhom(ten, rows))
  }, [dongHienThi])
  const tatCa = useMemo(() => gopNhom('Toàn công ty', dongHienThi), [dongHienThi])

  const tenKy = ky === 'tat_ca' ? 'Tất cả thời gian' : ky === 'hom_nay' ? `Hôm nay (${dmy(tuNgay)})` : `${dmy(tuNgay)} – ${dmy(denNgay)}`
  const tenSaleXem = laAdmin ? (locSale ? dsSale[0]?.full_name : (currentProfile?.role === 'leader' ? `Phòng ${currentProfile.phong_ban || ''}` : 'Tất cả sale')) : `Phòng ${currentProfile?.phong_ban || ''}`
  const phuDe = `Kỳ: ${tenKy} · ${tenSaleXem || ''}`

  // ===== Excel =====
  function taiExcel() {
    if (tab === 'tong_quan') {
      const rows = []
      const tongCong = { tong: 0, dem: {} }
      const cong = (o) => { tongCong.tong += o.tong; for (const [k, v] of Object.entries(o.dem)) tongCong.dem[k] = (tongCong.dem[k] || 0) + v }
      for (const g of chiTiet) {
        for (const r of g.rows) rows.push([g.ten, r.sale.full_name, r.tong, ...TRANG_THAI.map((b) => r.dem[b.ma] || 0)])
        rows.push([`Tổng phòng ${g.ten}`, '', g.tong, ...TRANG_THAI.map((b) => g.dem[b.ma] || 0)])
        cong(g)
      }
      const chua = bangPhong.find((o) => o.chua)
      if (chua) { rows.push(['Chưa chia sale', '', chua.tong, ...TRANG_THAI.map((b) => chua.dem[b.ma] || 0)]); cong(chua) }
      if (chiTiet.length > 1 || chua) rows.push(['TỔNG CỘNG', '', tongCong.tong, ...TRANG_THAI.map((b) => tongCong.dem[b.ma] || 0)])
      return xuatBangXlsx({
        tieuDe: 'Tổng quan – khách theo trạng thái (từng phòng, từng sale)', phuDe,
        heads: ['Phòng', 'Sale', 'Tổng khách', ...TRANG_THAI.map((b) => b.ten)],
        rows, tenFile: `bao-cao-tong-quan-${tuNgay}.xlsx`,
      })
    }
    const hang = (ten, o, tb) => {
      const f = tb ? (x) => tb1(x / o.n) : (x) => x
      return [ten, f(o.sum.phuTrach), f(o.sum.moi), f(o.sum.luot), f(o.sum.nghe), `${f(o.sum.ht)} / ${f(o.sum.mt)}`, (tb ? o.ptTb : o.ptTong) == null ? '—' : hienPt2(tb ? o.ptTb : o.ptTong), f(o.sum.ton)]
    }
    const rows = []
    for (const g of nhomPhong) {
      rows.push([`PHÒNG ${g.ten}`, '', '', '', '', '', '', ''])
      for (const r of g.rows) rows.push([r.sale.full_name, r.phuTrach, r.moi, r.luot, r.nghe, `${r.ht} / ${r.mt}`, r.pt == null ? '—' : hienPt2(r.pt), r.ton])
      rows.push(hang(`Tổng phòng ${g.ten}`, g, false))
      rows.push(hang('Trung bình / sale', g, true))
    }
    if (nhomPhong.length > 1) { rows.push(hang('TỔNG TOÀN CÔNG TY', tatCa, false)); rows.push(hang('Trung bình / sale toàn công ty', tatCa, true)) }
    return xuatBangXlsx({
      tieuDe: 'Báo cáo mục tiêu', phuDe,
      heads: ['Sale', 'Số khách phụ trách', 'Khách mới', 'Lượt chăm sóc', 'KH liên hệ được', 'Hoàn thành / mục tiêu', '% hoàn thành', `Khách tồn quá ${SO_NGAY_GOI_LAI} ngày`],
      rows, tenFile: `bao-cao-muc-tieu-${tuNgay}.xlsx`,
    })
  }

  const th = 'border border-slate-200 px-4 py-2.5'
  const td = 'border border-slate-200 px-4 py-2.5'
  const pctCls = (p) => (p != null && p >= 1 ? 'text-emerald-600' : p != null && p < 0.5 ? 'text-rose-500' : 'text-navy-900')

  // Hai dòng tóm tắt của một nhóm: Tổng + Trung bình / sale
  const DongTomTat = ({ ten, o, tb, cls }) => {
    const f = tb ? (x) => tb1(x / o.n) : (x) => x
    const pt = tb ? o.ptTb : o.ptTong
    const toi = cls.includes('bg-navy')   // dòng nền xanh đậm: giữ chữ trắng
    return (
      <tr className={`font-semibold ${cls}`}>
        <td className={td}>{ten}</td>
        <td className={`${td} text-center`}>{f(o.sum.phuTrach)}</td>
        <td className={`${td} text-center`}>{f(o.sum.moi)}</td>
        <td className={`${td} text-center`}>{f(o.sum.luot)}</td>
        <td className={`${td} text-center`}>{f(o.sum.nghe)}</td>
        <td className={`${td} text-center`}>{f(o.sum.ht)} / {f(o.sum.mt)}</td>
        <td className={`${td} text-center ${toi ? '' : pctCls(pt)}`}>{pt == null ? '—' : hienPt2(pt)}</td>
        <td className={`${td} text-center ${toi ? '' : o.sum.ton > 0 ? 'text-rose-500' : 'text-ink-400'}`}>{f(o.sum.ton)}</td>
      </tr>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex gap-1 border-b border-slate-200 bg-white px-8 pt-3">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => { setTab(t.key); if (t.key === 'muc_tieu' && ky === 'tat_ca') setKy('thang_nay') }}
            className={`-mb-px border-b-2 px-3 py-2.5 text-sm transition ${
              tab === t.key ? 'border-coral-500 font-medium text-navy-900' : 'border-transparent text-ink-600 hover:text-navy-900'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-8 mt-6 flex flex-wrap items-end gap-3 rounded-2xl bg-white p-4 shadow-sm">
          <Select label="Kỳ báo cáo" value={ky} onChange={(e) => setKy(e.target.value)} className="w-44">
            {tab === 'tong_quan' && <option value="tat_ca">Tất cả thời gian</option>}
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
          {laAdmin && (
            <Select label="Sale" value={locSale} onChange={(e) => setLocSale(e.target.value)} className="w-52">
              <option value="">Tất cả sale</option>
              {thanhVien.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
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
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  <div className="rounded-2xl bg-navy-900 px-5 py-4 shadow-sm">
                    <p className="text-sm text-white/70">Tổng khách hàng</p>
                    <p className="mt-1 font-display text-3xl font-bold text-white">{khachKy.length}</p>
                  </div>
                  {demTT.map((b) => (
                    <div key={b.ma} className="rounded-2xl bg-white px-5 py-4 shadow-sm">
                      <p className="flex items-center gap-2 text-sm text-ink-600">
                        <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ backgroundColor: MAU_HEX[b.mau] || MAU_HEX.slate }} />{b.ten}
                      </p>
                      <p className="mt-1 font-display text-3xl font-bold text-navy-900">{b.so}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-ink-400">Số khách theo trạng thái hiện tại · tính các khách được thêm trong kỳ báo cáo ({tenKy}).</p>

                {laAdminHan && (
                  <section className="rounded-2xl bg-white p-5 shadow-sm">
                    <h2 className="mb-3 font-display text-base font-semibold text-navy-900">Khách theo trạng thái — từng phòng <span className="text-sm font-normal text-ink-400">({tenKy})</span></h2>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-sm">
                        <thead>
                          <tr className="bg-slate-100 text-left font-semibold text-navy-900">
                            <th className={th}>Phòng</th>
                            <th className={`${th} text-center`}>Số sale</th>
                            <th className={`${th} text-center`}>Tổng khách</th>
                            {TRANG_THAI.map((b) => <th key={b.ma} className={`${th} text-center`}>{b.ten}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {bangPhong.length === 0 ? (
                            <tr><td colSpan={3 + TRANG_THAI.length} className={`${td} py-6 text-center text-ink-400`}>Chưa có dữ liệu.</td></tr>
                          ) : bangPhong.map((o) => (
                            <tr key={o.ten} className={o.chua ? 'bg-amber-50/60' : ''}>
                              <td className={`${td} font-medium text-navy-900`}>{o.ten}</td>
                              <td className={`${td} text-center`}>{o.chua ? '—' : o.soSale}</td>
                              <td className={`${td} text-center font-semibold text-navy-900`}>{o.tong}</td>
                              {TRANG_THAI.map((b) => <td key={b.ma} className={`${td} text-center ${o.dem[b.ma] ? 'text-navy-900' : 'text-slate-300'}`}>{o.dem[b.ma] || 0}</td>)}
                            </tr>
                          ))}
                          {bangPhong.length > 1 && (
                            <tr className="bg-slate-50 font-semibold text-navy-900">
                              <td className={td}>Tổng cộng</td>
                              <td className={`${td} text-center`}>{bangPhong.reduce((a, o) => a + o.soSale, 0)}</td>
                              <td className={`${td} text-center`}>{bangPhong.reduce((a, o) => a + o.tong, 0)}</td>
                              {TRANG_THAI.map((b) => <td key={b.ma} className={`${td} text-center`}>{bangPhong.reduce((a, o) => a + (o.dem[b.ma] || 0), 0)}</td>)}
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}

                <section className="rounded-2xl bg-white p-5 shadow-sm">
                  <h2 className="mb-3 font-display text-base font-semibold text-navy-900">Chi tiết từng phòng — từng sale <span className="text-sm font-normal text-ink-400">({tenKy})</span></h2>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="bg-slate-100 text-left font-semibold text-navy-900">
                          <th className={th}>Sale</th>
                          <th className={`${th} text-center`}>Tổng khách</th>
                          {TRANG_THAI.map((b) => <th key={b.ma} className={`${th} text-center`}>{b.ten}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {chiTiet.length === 0 ? (
                          <tr><td colSpan={2 + TRANG_THAI.length} className={`${td} py-6 text-center text-ink-400`}>Chưa có dữ liệu.</td></tr>
                        ) : chiTiet.map((g) => (
                          <Fragment key={g.ten}>
                            <tr className="bg-blue-50">
                              <td colSpan={2 + TRANG_THAI.length} className={`${td} font-display font-semibold text-navy-900`}>Phòng {g.ten} <span className="text-xs font-normal text-ink-400">· {g.rows.length} sale</span></td>
                            </tr>
                            {g.rows.map((r) => (
                              <tr key={r.sale.id}>
                                <td className={`${td} pl-7 font-medium text-navy-900`}>{r.sale.full_name}</td>
                                <td className={`${td} text-center font-semibold text-navy-900`}>{r.tong}</td>
                                {TRANG_THAI.map((b) => <td key={b.ma} className={`${td} text-center ${r.dem[b.ma] ? 'text-navy-900' : 'text-slate-300'}`}>{r.dem[b.ma] || 0}</td>)}
                              </tr>
                            ))}
                            <tr className="bg-slate-50 font-semibold text-navy-900">
                              <td className={td}>Tổng phòng {g.ten}</td>
                              <td className={`${td} text-center`}>{g.tong}</td>
                              {TRANG_THAI.map((b) => <td key={b.ma} className={`${td} text-center`}>{g.dem[b.ma] || 0}</td>)}
                            </tr>
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}

            {/* ===== 2. Báo cáo mục tiêu ===== */}
            {tab === 'muc_tieu' && (
              <section className="rounded-2xl bg-white p-5 shadow-sm">
                <h2 className="mb-1 font-display text-base font-semibold text-navy-900">Báo cáo mục tiêu <span className="text-sm font-normal text-ink-400">({tenKy})</span></h2>
                <p className="mb-3 text-xs text-ink-400">Mục tiêu = số KH liên hệ được sale tự đặt + số khách cần gọi lại sale đã chọn. KH liên hệ được = khách đổi từ Chưa liên hệ sang trạng thái khác. Lượt chăm sóc = khách đổi từ trạng thái khác (không phải Chưa liên hệ) sang trạng thái mới; nếu cùng ngày khách vừa đổi từ Chưa liên hệ thì chỉ tính KH liên hệ được. Mỗi phòng có dòng Tổng phòng và dòng Trung bình / sale.</p>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-100 text-left font-semibold text-navy-900">
                        <th className={th}>Sale</th>
                        <th className={`${th} text-center`}>Số khách phụ trách</th>
                        <th className={`${th} text-center`}>Khách mới</th>
                        <th className={`${th} text-center`}>Lượt chăm sóc</th>
                        <th className={`${th} text-center`}>KH liên hệ được</th>
                        <th className={`${th} text-center`}>Hoàn thành / mục tiêu</th>
                        <th className={`${th} text-center`}>% hoàn thành</th>
                        <th className={`${th} text-center`}>Khách tồn quá {SO_NGAY_GOI_LAI} ngày</th>
                      </tr>
                    </thead>
                    <tbody>
                      {nhomPhong.length === 0 ? (
                        <tr><td colSpan={8} className={`${td} py-6 text-center text-ink-400`}>Chưa có sale nào.</td></tr>
                      ) : nhomPhong.map((g) => (
                        <Fragment key={g.ten}>
                          <tr className="bg-blue-50">
                            <td colSpan={8} className={`${td} font-display font-semibold text-navy-900`}>Phòng {g.ten} <span className="text-xs font-normal text-ink-400">· {g.n} sale</span></td>
                          </tr>
                          {g.rows.map((r) => (
                            <tr key={r.sale.id}>
                              <td className={`${td} pl-7 font-medium text-navy-900`}>{r.sale.full_name}</td>
                              <td className={`${td} text-center`}>{r.phuTrach}</td>
                              <td className={`${td} text-center`}>{r.moi}</td>
                              <td className={`${td} text-center`}>{r.luot}</td>
                              <td className={`${td} text-center`}>{r.nghe}</td>
                              <td className={`${td} text-center`}>{r.ht} / {r.mt}</td>
                              <td className={`${td} text-center font-semibold ${pctCls(r.pt)}`}>{r.pt == null ? '—' : hienPt2(r.pt)}</td>
                              <td className={`${td} text-center font-semibold ${r.ton > 0 ? 'text-rose-500' : 'text-ink-400'}`}>{r.ton}</td>
                            </tr>
                          ))}
                          <DongTomTat ten={`Tổng phòng ${g.ten}`} o={g} tb={false} cls="bg-slate-50 text-navy-900" />
                          <DongTomTat ten="Trung bình / sale" o={g} tb cls="bg-orange-50 text-navy-900" />
                        </Fragment>
                      ))}
                      {nhomPhong.length > 1 && (
                        <>
                          <DongTomTat ten="TỔNG TOÀN CÔNG TY" o={tatCa} tb={false} cls="bg-navy-900 text-white" />
                          <DongTomTat ten="Trung bình / sale toàn công ty" o={tatCa} tb cls="bg-navy-900/90 text-white" />
                        </>
                      )}
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
