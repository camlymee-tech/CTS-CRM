import { layHet } from '../lib/layHet'
import { useEffect, useMemo, useState } from 'react'
import { Download, Users, Trophy, PhoneCall, Hourglass, MessageCircle, UserPlus, AlertTriangle } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { layNhanSu } from '../lib/nhanSu'
import { Select, Input } from './ui'
import { useTrangThai } from '../lib/StatusContext'
import { homNayLocal, ngayLocal, dinhDangNgay } from '../lib/ngay'
import { maChuaLienHe, maKhNgheMay, tinhCanGoiLai, SO_NGAY_GOI_LAI } from '../lib/nhacViec'
import { hienPt2 } from '../lib/dashboardXlsx'
import { xuatBangXlsx } from '../lib/baoCaoXlsx'
import { laAdmin, laLeader, laQuanLy, laSale } from '../lib/quyen'

const TABS = [
  { key: 'tong_quan', label: 'Tổng quan' },
  { key: 'muc_tieu', label: 'Báo cáo mục tiêu' },
]

const MAU_HEX = {
  slate: '#94a3b8', orange: '#fb923c', amber: '#f59e0b', emerald: '#10b981', teal: '#14b8a6',
  violet: '#8b5cf6', rose: '#f43f5e', coral: '#ff7a00', sky: '#0ea5e9', navy: '#0a2463',
}

const pad = (n) => String(n).padStart(2, '0')
const ymd = homNayLocal
const dmy = dinhDangNgay

// Khoảng ngày [từ, đến] (đều tính cả hai đầu)
function khoangKy(ky, tu, den) {
  const d = new Date()
  const hom = ymd(d)
  if (ky === 'tat_ca') return ['0000-01-01', hom]
  if (ky === 'hom_nay') return [hom, hom]
  if (ky === 'hom_qua') { const x = new Date(); x.setDate(x.getDate() - 1); return [ymd(x), ymd(x)] }
  if (ky === '7') { const x = new Date(); x.setDate(x.getDate() - 6); return [ymd(x), hom] }
  if (ky === 'thang_nay') return [`${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`, hom]
  return [tu || hom, den || tu || hom]
}

export default function BaoCaoPage({ currentProfile }) {
  const quanLy = laQuanLy(currentProfile)   // admin hoặc leader: có ô lọc Sale (leader chỉ thấy team mình)
  const { options: TRANG_THAI, statuses } = useTrangThai()
  const [tab, setTab] = useState('tong_quan')
  const [ky, setKy] = useState('thang_nay')
  const [tu, setTu] = useState(homNayLocal())
  const [den, setDen] = useState(homNayLocal())
  const [locSale, setLocSale] = useState('')
  const [locPhong, setLocPhong] = useState('')
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
    const chiCuaMinh = laSale(currentProfile)
    const truyVanProfiles = layNhanSu()
    // Sale không xem trực tiếp được khách/nhật ký của đồng nghiệp: dùng hàm team_* (chỉ trả số liệu, không có tên/SĐT khách)
    const [a, b, c, d, e, f] = chiCuaMinh ? await Promise.all([
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
    const khongAdmin = profiles.filter((p) => !laAdmin(p))
    if (laAdmin(currentProfile)) return khongAdmin
    if (currentProfile?.phong_ban) return khongAdmin.filter((p) => p.phong_ban === currentProfile.phong_ban)
    return khongAdmin.filter((p) => p.id === currentProfile?.id)
  }, [profiles, currentProfile])
  const xemChuaChia = false   // chỉ xem data chưa chia cho sale nào
  const dsPhong = useMemo(() => [...new Set(thanhVien.map((p) => p.phong_ban).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi')), [thanhVien])
  const thanhVienLoc = useMemo(() => (locPhong ? thanhVien.filter((p) => p.phong_ban === locPhong) : thanhVien), [thanhVien, locPhong])
  const saleDangXem = quanLy && !xemChuaChia ? locSale : ''
  const dsSale = useMemo(() => {
    if (xemChuaChia) return []
    return saleDangXem ? thanhVienLoc.filter((p) => p.id === saleDangXem) : thanhVienLoc
  }, [thanhVienLoc, saleDangXem, xemChuaChia])
  const idSale = useMemo(() => new Set(dsSale.map((s) => s.id)), [dsSale])

  const maChua = maChuaLienHe(statuses)
  const maNghe = maKhNgheMay(statuses)
  // Quy ước: đổi trạng thái từ "Chưa liên hệ" sang bất kỳ trạng thái nào = 1 lần KH liên hệ được
  const tachLog = (l) => { const [tu, den] = String(l.chi_tiet || '').split(' → '); return { tu, den, doi: !!tu && !!den && tu !== den } }
  const laNgheMay = (l) => { const x = tachLog(l); return x.doi && maChua.includes(x.tu) }
  // Đổi trạng thái từ trạng thái khác (không phải Chưa liên hệ) sang trạng thái mới = 1 lượt chăm sóc
  const laChamSoc = (l) => { const x = tachLog(l); return x.doi && !maChua.includes(x.tu) }

  // Dữ liệu đã lọc theo sale
  const khach = useMemo(() => (xemChuaChia ? customers.filter((c) => !c.sale_id) : customers.filter((c) => idSale.has(c.sale_id))), [customers, idSale, xemChuaChia])
  const logLoc = useMemo(() => logs.filter((l) => idSale.has(l.user_id)), [logs, idSale])
  const ngayCs = (x) => ngayLocal(x.ngay_thuc_hien || x.created_at)

  // Khách cần gọi lại (tồn quá 7 ngày) — tình trạng hiện tại
  const canGoiLai = useMemo(
    () => tinhCanGoiLai({ khach: customers, logs, statuses, isAdmin: true }).filter((r) => idSale.has(r.saleId)),
    [customers, logs, statuses, idSale])

  // Mục tiêu theo (ngày, sale)
  const dongMucTieu = useMemo(() => {
    // Chỉ xét những ngày thực sự có mục tiêu trong kỳ (không giới hạn số ngày, khoảng dài không bị cắt)
    const ngays = [...new Set([...soMt.map((x) => x.ngay), ...chonMt.map((x) => x.ngay)])].filter((n) => n >= tuNgay && n <= denNgay).sort()
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
        const mt = mtNghe || 0   // % hoàn thành chỉ tính KH liên hệ được; khách gọi lại thuộc chăm sóc, không cộng vào
        const ht = nghe   // liên hệ được có thể vượt mục tiêu
        out.push({ ngay, sale: s, mtNghe: mtNghe ?? null, nghe, mtLai: chon.length, xong, mt, ht, pt: mt ? ht / mt : null })
      }
    }
    return out.sort((a, b) => (a.ngay < b.ngay ? 1 : a.ngay > b.ngay ? -1 : a.sale.full_name.localeCompare(b.sale.full_name, 'vi')))
  }, [tuNgay, denNgay, dsSale, soMt, chonMt, logs, cs, maChua.join(), maNghe.join()])

  const laAdminHan = laAdmin(currentProfile)
  const tenPB = (s) => s.phong_ban || 'Chưa có phòng ban'
  const tb1 = (x) => (Math.round(x * 10) / 10).toLocaleString('vi-VN')

  // ===== Tab 1: Tổng quan — khách theo trạng thái, lọc theo ngày thêm khách =====
  // Tổng quan = (data mới chia/tìm trong kỳ mà vẫn chưa gọi) + (khách sale đã liên hệ được trong kỳ), mỗi khách 1 lần, theo trạng thái hiện tại
  const khachKy = useMemo(() => {
    const daLienHe = new Set()
    for (const l of logLoc) if (laNgheMay(l) && trongKy(ngayLocal(l.created_at))) daLienHe.add(l.customer_id)
    return khach.filter((c) => daLienHe.has(c.id) || (trongKy(ngayLocal(c.created_at)) && maChua.includes(c.trang_thai_cham_soc)))
  }, [khach, logLoc, tuNgay, denNgay, maChua.join()])
  const demTT = useMemo(() => TRANG_THAI.map((b) => ({ ...b, so: khachKy.filter((c) => c.trang_thai_cham_soc === b.ma).length })), [khachKy, TRANG_THAI])

  // Admin: chia theo từng phòng (thêm dòng "Chưa chia sale" cho khách chưa có sale)
  const bangPhong = useMemo(() => {
    if (!laAdminHan) return []
    const m = new Map()
    const lay = (k) => { if (!m.has(k)) m.set(k, { ten: k, dem: {}, tong: 0, soSale: 0 }); return m.get(k) }
    const phongCua = new Map()
    for (const s of dsSale) { phongCua.set(s.id, tenPB(s)); lay(tenPB(s)).soSale += 1 }
    for (const c of khachKy) { if (!c.sale_id) continue; const o = lay(phongCua.get(c.sale_id) || 'Chưa có phòng ban'); o.dem[c.trang_thai_cham_soc] = (o.dem[c.trang_thai_cham_soc] || 0) + 1; o.tong += 1 }
    return [...m.values()].sort((a, b) => a.ten.localeCompare(b.ten, 'vi'))
  }, [laAdminHan, dsSale, khachKy, customers, locSale, locPhong, xemChuaChia, tuNgay, denNgay])

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
      if (laLeader(sl) && mine.length === 0) continue
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
      luot: (() => {
        // Lượt chăm sóc = khách/ngày có cập nhật chăm sóc mới HOẶC đổi trạng thái (trừ Chưa liên hệ → khác); mỗi khách chỉ tính 1 lần/ngày
        const set = new Set()
        for (const x of cs) { const d = ngayCs(x); if (x.sale_id === s.id && trongKy(d)) set.add(`${x.customer_id}|${d}`) }
        for (const l of logs) { const d = ngayLocal(l.created_at); if (l.user_id === s.id && trongKy(d) && laChamSoc(l)) set.add(`${l.customer_id}|${d}`) }
        for (const k of lanLienHeDau) set.delete(k)
        return set.size
      })(),
      nghe: logs.filter((l) => l.user_id === s.id && trongKy(ngayLocal(l.created_at)) && laNgheMay(l)).length,
      ht, mt, pt: mt ? ht / mt : null,
      ton: canGoiLai.filter((r) => r.saleId === s.id).length,
    }
  }), [dsSale, customers, cs, logs, dongMucTieu, canGoiLai, tuNgay, denNgay, maChua.join(), maNghe.join()])

  const dongHienThi = useMemo(() => dongSale.filter((r) => !laLeader(r.sale) || r.phuTrach > 0 || r.mt > 0 || r.luot > 0), [dongSale])
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

  const tenKy = ky === 'tat_ca' ? 'Tất cả thời gian' : ky === 'hom_nay' ? `Hôm nay (${dmy(tuNgay)})` : ky === 'hom_qua' ? `Hôm qua (${dmy(tuNgay)})` : `${dmy(tuNgay)} – ${dmy(denNgay)}`
  const tenSaleXem = quanLy ? (xemChuaChia ? 'Data chưa chia' : locSale ? dsSale[0]?.full_name : locPhong ? `Phòng ${locPhong}` : (laLeader(currentProfile) ? `Phòng ${currentProfile.phong_ban || ''}` : 'Tất cả sale')) : `Phòng ${currentProfile?.phong_ban || ''}`
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
      heads: ['Sale', 'Số data phụ trách', 'Data sale tìm kiếm', 'Lượt chăm sóc', 'KH liên hệ được', 'Hoàn thành / mục tiêu', '% hoàn thành', `Khách tồn quá ${SO_NGAY_GOI_LAI} ngày`],
      rows, tenFile: `bao-cao-muc-tieu-${tuNgay}.xlsx`,
    })
  }

  const thD = 'border border-navy-800 px-4 py-2.5'
  const td = 'border border-slate-200 px-4 py-2.5'

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
            <option value="hom_qua">Hôm qua</option>
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
          {laAdminHan && (
            <Select label="Phòng" value={locPhong} onChange={(e) => { setLocPhong(e.target.value); setLocSale('') }} className="w-44">
              <option value="">Tất cả phòng</option>
              {dsPhong.map((p) => <option key={p} value={p}>{p}</option>)}
            </Select>
          )}
          {quanLy && (
            <Select label="Sale" value={locSale} onChange={(e) => setLocSale(e.target.value)} className="w-64">
              <option value="">{locPhong ? `Tất cả sale phòng ${locPhong}` : 'Tất cả sale'}</option>
              {thanhVienLoc.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
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
            {tab === 'tong_quan' && (() => {
              const tong = khachKy.length
              const maChot = TRANG_THAI.filter((b) => b.la_chot).map((b) => b.ma)
              const soChot = khachKy.filter((c) => maChot.includes(c.trang_thai_cham_soc)).length
              const soChua = khachKy.filter((c) => maChua.includes(c.trang_thai_cham_soc)).length
              const daLH = tong - soChua
              const pc = (x) => (tong ? x / tong : 0)
              const tiLeChotRow = (dem, tongRow) => { const lh = tongRow - maChua.reduce((a, m) => a + (dem[m] || 0), 0); return lh > 0 ? hienPt2(demChot(dem) / lh) : '—' }
              const demChot = (dem) => maChot.reduce((a, m) => a + (dem[m] || 0), 0)
              return (
                <>
                  {/* Chỉ số chính */}
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <TheKpi lon tieuDe="Tổng khách hàng" so={tong.toLocaleString('vi-VN')} phu={tenKy} icon={Users} />
                    <TheKpi tieuDe="Tỷ lệ chốt" so={daLH > 0 ? hienPt2(soChot / daLH) : '—'} phu={`${soChot.toLocaleString('vi-VN')} chốt / ${daLH.toLocaleString('vi-VN')} khách liên hệ được`} tone="emerald" icon={Trophy} />
                    <TheKpi tieuDe="Đã liên hệ" so={daLH.toLocaleString('vi-VN')} phu={`${hienPt2(pc(daLH))} tổng số khách`} tone="sky" icon={PhoneCall} />
                    <TheKpi tieuDe="Chưa liên hệ" so={soChua.toLocaleString('vi-VN')} phu={soChua ? `${hienPt2(pc(soChua))} — cần gọi sớm` : 'Đã liên hệ hết'} tone="amber" icon={Hourglass} />
                  </div>

                  {/* Cơ cấu trạng thái */}
                  <section className="rounded-2xl bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h2 className="font-display text-base font-semibold text-navy-900">Cơ cấu khách theo trạng thái</h2>
                      <p className="text-xs text-ink-400">Trạng thái hiện tại · khách thêm trong kỳ · Tỷ lệ chốt = khách chốt ÷ khách liên hệ được (không ở Chưa liên hệ)</p>
                    </div>
                    <div className="mt-4 flex h-4 overflow-hidden rounded-full bg-slate-100">
                      {demTT.filter((b) => b.so > 0).map((b) => (
                        <div key={b.ma} style={{ width: `${pc(b.so) * 100}%`, backgroundColor: MAU_HEX[b.mau] || MAU_HEX.slate }} title={`${b.ten}: ${b.so}`} />
                      ))}
                    </div>
                    <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                      {demTT.map((b) => {
                        const m = MAU_HEX[b.mau] || MAU_HEX.slate
                        return (
                          <div key={b.ma} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3" style={{ borderLeft: `4px solid ${m}` }}>
                            <p className="text-xs leading-snug text-ink-600">{b.ten}</p>
                            <p className="mt-1 flex items-baseline gap-2">
                              <span className="font-display text-2xl font-bold text-navy-900">{b.so.toLocaleString('vi-VN')}</span>
                              <span className="text-xs font-medium" style={{ color: m }}>{hienPt2(pc(b.so))}</span>
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  </section>

                  {laAdminHan && (
                    <section className="rounded-2xl bg-white p-5 shadow-sm">
                      <h2 className="mb-3 font-display text-base font-semibold text-navy-900">So sánh các phòng</h2>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-sm">
                          <thead>
                            <tr className="bg-navy-900 text-left font-semibold text-white">
                              <th className={thD}>Phòng</th>
                              <th className={`${thD} text-center`}>Số sale</th>
                              <th className={`${thD} text-center`}>Tổng khách</th>
                              {TRANG_THAI.map((b) => <th key={b.ma} className={`${thD} text-center`}>{b.ten}</th>)}
                              <th className={`${thD} text-center`}>Tỷ lệ chốt</th>
                            </tr>
                          </thead>
                          <tbody>
                            {bangPhong.length === 0 ? (
                              <tr><td colSpan={4 + TRANG_THAI.length} className={`${td} py-6 text-center text-ink-400`}>Chưa có dữ liệu.</td></tr>
                            ) : bangPhong.map((o) => (
                              <tr key={o.ten} className={o.chua ? 'bg-amber-50/70' : 'odd:bg-white even:bg-slate-50/50'}>
                                <td className={`${td} font-semibold text-navy-900`}>{o.ten}</td>
                                <td className={`${td} text-center`}>{o.chua ? '—' : o.soSale}</td>
                                <td className={`${td} bg-blue-50/60 text-center font-display text-base font-bold text-navy-900`}>{o.tong.toLocaleString('vi-VN')}</td>
                                {TRANG_THAI.map((b) => <td key={b.ma} className={`${td} text-center ${o.dem[b.ma] ? 'text-navy-900' : 'text-slate-300'}`}>{o.dem[b.ma] || 0}</td>)}
                                <td className={`${td} text-center font-semibold text-emerald-600`}>{tiLeChotRow(o.dem, o.tong)}</td>
                              </tr>
                            ))}
                            {bangPhong.length > 1 && (() => {
                              const dem = {}
                              for (const o of bangPhong) for (const [k, v] of Object.entries(o.dem)) dem[k] = (dem[k] || 0) + v
                              const t = bangPhong.reduce((a, o) => a + o.tong, 0)
                              return (
                                <tr className="bg-navy-900 font-semibold text-white">
                                  <td className={td}>TỔNG CỘNG</td>
                                  <td className={`${td} text-center`}>{bangPhong.reduce((a, o) => a + o.soSale, 0)}</td>
                                  <td className={`${td} text-center font-display text-base`}>{t.toLocaleString('vi-VN')}</td>
                                  {TRANG_THAI.map((b) => <td key={b.ma} className={`${td} text-center`}>{dem[b.ma] || 0}</td>)}
                                  <td className={`${td} text-center`}>{tiLeChotRow(dem, t)}</td>
                                </tr>
                              )
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  )}

                  {!xemChuaChia && (
                  <section className="rounded-2xl bg-white p-5 shadow-sm">
                    <h2 className="mb-1 font-display text-base font-semibold text-navy-900">Chi tiết từng phòng — từng sale</h2>
                    <p className="mb-3 text-sm text-ink-400">Tổng khách = data mới chia/tìm trong kỳ mà chưa gọi (cột Chưa liên hệ) + khách sale đã liên hệ được trong kỳ, theo trạng thái hiện tại. Mỗi khách tính 1 lần. Tỷ lệ chốt = KH chốt / KH đã liên hệ được.</p>
                    <BangChiTietPhong chiTiet={chiTiet} trangThai={TRANG_THAI} tiLeChotRow={tiLeChotRow} />
                  </section>
                  )}
                </>
              )
            })()}

            {/* ===== 2. Báo cáo mục tiêu ===== */}
            {tab === 'muc_tieu' && (
              <>
                {/* Chỉ số tổng */}
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
                  <div className="col-span-2 flex items-center gap-4 rounded-2xl bg-navy-900 px-5 py-4 text-white shadow-sm md:col-span-3 xl:col-span-2">
                    <Vong pt={tatCa.ptTong} size={84} sang />
                    <div>
                      <p className="text-sm text-white/70">Hoàn thành mục tiêu</p>
                      <p className="mt-0.5 font-display text-3xl font-bold">{tatCa.ptTong == null ? '—' : hienPt2(tatCa.ptTong)}</p>
                      <p className="mt-0.5 text-xs text-white/60">{tatCa.sum.ht.toLocaleString('vi-VN')} / {tatCa.sum.mt.toLocaleString('vi-VN')} việc · {tenKy}</p>
                    </div>
                  </div>
                  <TheKpi tieuDe="KH liên hệ được" so={tatCa.sum.nghe.toLocaleString('vi-VN')} phu={`TB ${tb1(tatCa.n ? tatCa.sum.nghe / tatCa.n : 0)} / sale`} tone="sky" icon={PhoneCall} nho />
                  <TheKpi tieuDe="Lượt chăm sóc" so={tatCa.sum.luot.toLocaleString('vi-VN')} phu={`TB ${tb1(tatCa.n ? tatCa.sum.luot / tatCa.n : 0)} / sale`} tone="emerald" icon={MessageCircle} nho />
                  <TheKpi tieuDe="Data sale tìm kiếm" so={tatCa.sum.moi.toLocaleString('vi-VN')} phu={`TB ${tb1(tatCa.n ? tatCa.sum.moi / tatCa.n : 0)} / sale`} tone="violet" icon={UserPlus} nho />
                  <TheKpi tieuDe={`Tồn quá ${SO_NGAY_GOI_LAI} ngày`} so={tatCa.sum.ton.toLocaleString('vi-VN')} phu="khách cần gọi lại" tone="rose" icon={AlertTriangle} nho />
                </div>

                {/* So sánh các phòng */}
                {nhomPhong.length > 0 && (
                  <section className="rounded-2xl bg-white p-5 shadow-sm">
                    <h2 className="font-display text-base font-semibold text-navy-900">Hoàn thành mục tiêu theo phòng</h2>
                    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {[...nhomPhong].sort((x, y) => (y.ptTong ?? -1) - (x.ptTong ?? -1)).map((g) => (
                        <div key={g.ten} className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-display font-semibold text-navy-900">Phòng {g.ten}</p>
                              <p className="text-xs text-ink-400">{g.n} sale · {g.sum.ht} / {g.sum.mt} việc</p>
                            </div>
                            <p className={`font-display text-2xl font-bold ${mauChu(g.ptTong)}`}>{g.ptTong == null ? '—' : hienPt2(g.ptTong)}</p>
                          </div>
                          <Thanh pt={g.ptTong} className="mt-3" />
                          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs text-ink-600">
                            <div><p className="font-display text-base font-bold text-navy-900">{tb1(g.sum.nghe / g.n)}</p>liên hệ được / sale</div>
                            <div><p className="font-display text-base font-bold text-navy-900">{tb1(g.sum.luot / g.n)}</p>chăm sóc / sale</div>
                            <div><p className={`font-display text-base font-bold ${g.sum.ton > 0 ? 'text-rose-500' : 'text-navy-900'}`}>{g.sum.ton}</p>khách tồn</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Bảng chi tiết */}
                <section className="rounded-2xl bg-white p-5 shadow-sm">
                  <h2 className="mb-1 font-display text-base font-semibold text-navy-900">Chi tiết từng phòng — từng sale</h2>
                  <p className="mb-3 text-xs text-ink-400">Mục tiêu = số KH liên hệ được sale tự đặt + số khách cần gọi lại sale đã chọn. KH liên hệ được = khách đổi từ Chưa liên hệ sang trạng thái khác. Lượt chăm sóc = số khách có cập nhật chăm sóc mới hoặc đổi trạng thái (trừ Chưa liên hệ → khác), mỗi khách tính 1 lần/ngày; ngày khách vừa đổi từ Chưa liên hệ thì chỉ tính KH liên hệ được.</p>
                  {nhomPhong.length === 0
                    ? <p className="py-6 text-center text-sm text-ink-400">{xemChuaChia ? 'Data chưa chia chưa thuộc sale nào nên chưa có mục tiêu.' : 'Chưa có sale nào.'}</p>
                    : <BangMucTieuPhong nhomPhong={nhomPhong} tatCa={tatCa} soNgay={SO_NGAY_GOI_LAI} tb1={tb1} />}
                </section>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const mauThanh = (p) => (p == null ? 'bg-slate-300' : p >= 1 ? 'bg-emerald-500' : p >= 0.5 ? 'bg-amber-400' : 'bg-rose-400')
const mauChu = (p) => (p == null ? 'text-ink-400' : p >= 1 ? 'text-emerald-600' : p >= 0.5 ? 'text-amber-600' : 'text-rose-500')

function Thanh({ pt, className = '' }) {
  return (
    <div className={`h-2.5 overflow-hidden rounded-full bg-slate-200 ${className}`}>
      <div className={`h-full rounded-full ${mauThanh(pt)}`} style={{ width: `${Math.min(Math.max((pt || 0) * 100, pt ? 2 : 0), 100)}%` }} />
    </div>
  )
}

// Ô % hoàn thành: số + thanh tiến độ
function OPt({ pt }) {
  return (
    <div className="flex items-center gap-2.5">
      <Thanh pt={pt} className="h-2 flex-1" />
      <span className={`w-16 text-right font-semibold ${mauChu(pt)}`}>{pt == null ? '—' : hienPt2(pt)}</span>
    </div>
  )
}

// Vòng tròn tiến độ
function Vong({ pt, size = 80, sang = false }) {
  const r = (size - 12) / 2
  const c = 2 * Math.PI * r
  const v = Math.min(Math.max(pt || 0, 0), 1)
  return (
    <svg width={size} height={size} className="flex-none -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={sang ? 'rgba(255,255,255,0.18)' : '#e2e8f0'} strokeWidth="8" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="8" strokeLinecap="round"
        stroke={pt != null && pt >= 1 ? '#34d399' : '#ff7a00'} strokeDasharray={c} strokeDashoffset={c * (1 - v)} />
    </svg>
  )
}

const TONE = {
  emerald: { vien: '#10b981', chu: 'text-emerald-600', nen: 'bg-emerald-50', icon: 'text-emerald-600' },
  sky: { vien: '#0ea5e9', chu: 'text-sky-600', nen: 'bg-sky-50', icon: 'text-sky-600' },
  amber: { vien: '#f59e0b', chu: 'text-amber-600', nen: 'bg-amber-50', icon: 'text-amber-600' },
  violet: { vien: '#8b5cf6', chu: 'text-violet-600', nen: 'bg-violet-50', icon: 'text-violet-600' },
  rose: { vien: '#f43f5e', chu: 'text-rose-500', nen: 'bg-rose-50', icon: 'text-rose-500' },
}

// Thẻ chỉ số: lon = thẻ nền xanh đậm (chỉ số quan trọng nhất)
function TheKpi({ tieuDe, so, phu, tone, icon: Icon, lon = false, nho = false }) {
  if (lon) {
    return (
      <div className="flex items-center justify-between rounded-2xl bg-navy-900 px-6 py-5 text-white shadow-sm">
        <div>
          <p className="text-sm text-white/70">{tieuDe}</p>
          <p className="mt-1 font-display text-4xl font-bold">{so}</p>
          {phu && <p className="mt-1 text-xs text-white/60">{phu}</p>}
        </div>
        {Icon && <Icon size={34} className="text-white/30" />}
      </div>
    )
  }
  const t = TONE[tone] || TONE.sky
  return (
    <div className="rounded-2xl bg-white px-5 py-4 shadow-sm" style={{ borderTop: `4px solid ${t.vien}` }}>
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-600">{tieuDe}</p>
        {Icon && <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${t.nen}`}><Icon size={16} className={t.icon} /></span>}
      </div>
      <p className={`mt-1 font-display ${nho ? 'text-2xl' : 'text-3xl'} font-bold ${t.chu}`}>{so}</p>
      {phu && <p className="mt-1 text-xs text-ink-400">{phu}</p>}
    </div>
  )
}

// Chi tiết từng phòng: mỗi phòng là một khối riêng (tên phòng + tóm tắt ở đầu, bảng từng sale, dòng tổng phòng)
function BangChiTietPhong({ chiTiet, trangThai, tiLeChotRow }) {
  if (chiTiet.length === 0) return <p className="py-6 text-center text-sm text-ink-400">Chưa có dữ liệu.</p>
  const o = 'border border-slate-200 px-3 py-2.5'
  return (
    <div className="space-y-6">
      {chiTiet.map((g) => (
        <div key={g.ten} className="overflow-hidden rounded-2xl border-2 border-navy-900/15">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-navy-900 px-5 py-3 text-white">
            <div className="flex items-center gap-3">
              <span className="h-8 w-1.5 rounded-full bg-coral-500" />
              <p className="font-display text-lg font-bold">Phòng {g.ten}</p>
              <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium">{g.rows.length} sale</span>
            </div>
            <div className="flex items-center gap-5 text-sm">
              <span className="text-white/70">Tổng khách <b className="ml-1 font-display text-lg text-white">{g.tong.toLocaleString('vi-VN')}</b></span>
              <span className="text-white/70">Tỷ lệ chốt <b className="ml-1 font-display text-lg text-emerald-300">{tiLeChotRow(g.dem, g.tong)}</b></span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] table-fixed border-collapse text-sm">
              <colgroup>
                <col style={{ width: '17%' }} /><col style={{ width: '8%' }} />
                {trangThai.map((b) => <col key={b.ma} />)}
                <col style={{ width: '8%' }} />
              </colgroup>
              <thead>
                <tr className="bg-slate-100 text-xs font-semibold text-ink-600">
                  <th className={`${o} text-left`}>Sale</th>
                  <th className={`${o} text-center`}>Tổng khách</th>
                  {trangThai.map((b) => <th key={b.ma} className={`${o} text-center leading-tight`}>{b.ten}</th>)}
                  <th className={`${o} text-center`}>Tỷ lệ chốt</th>
                </tr>
              </thead>
              <tbody>
                {g.rows.map((r) => (
                  <tr key={r.sale.id} className="bg-white hover:bg-blue-50/40">
                    <td className={`${o} font-semibold text-navy-900`}>{r.sale.full_name}</td>
                    <td className={`${o} text-center font-display text-base font-bold text-navy-900`}>{r.tong.toLocaleString('vi-VN')}</td>
                    {trangThai.map((b) => <td key={b.ma} className={`${o} text-center ${r.dem[b.ma] ? 'font-semibold text-navy-900' : 'text-slate-300'}`}>{r.dem[b.ma] || 0}</td>)}
                    <td className={`${o} text-center font-semibold text-emerald-600`}>{tiLeChotRow(r.dem, r.tong)}</td>
                  </tr>
                ))}
                <tr className="bg-amber-50 font-bold text-navy-900">
                  <td className={o}>Tổng phòng {g.ten}</td>
                  <td className={`${o} text-center font-display text-base`}>{g.tong.toLocaleString('vi-VN')}</td>
                  {trangThai.map((b) => <td key={b.ma} className={`${o} text-center`}>{g.dem[b.ma] || 0}</td>)}
                  <td className={`${o} text-center text-emerald-600`}>{tiLeChotRow(g.dem, g.tong)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}

// Báo cáo mục tiêu — mỗi phòng một khối riêng: thanh tên phòng (tóm tắt), bảng từng sale, dòng tổng và trung bình
function BangMucTieuPhong({ nhomPhong, tatCa, soNgay, tb1 }) {
  const o = 'border border-slate-200 px-3 py-2.5'
  const tomTat = (ten, g, tb, cls) => {
    const f = tb ? (x) => tb1(x / g.n) : (x) => x
    const pt = tb ? g.ptTb : g.ptTong
    return (
      <tr className={`font-bold ${cls}`}>
        <td className={o}>{ten}</td>
        <td className={`${o} text-center`}>{f(g.sum.phuTrach)}</td>
        <td className={`${o} text-center`}>{f(g.sum.moi)}</td>
        <td className={`${o} text-center`}>{f(g.sum.luot)}</td>
        <td className={`${o} text-center`}>{f(g.sum.nghe)}</td>
        <td className={`${o} text-center`}>{f(g.sum.ht)} / {f(g.sum.mt)}</td>
        <td className={o}><OPt pt={pt} /></td>
        <td className={`${o} text-center ${g.sum.ton > 0 ? 'text-rose-500' : 'text-ink-400'}`}>{f(g.sum.ton)}</td>
      </tr>
    )
  }
  const khung = (g, children, tieuDe, phu) => (
    <div key={g.ten} className="overflow-hidden rounded-2xl border-2 border-navy-900/15">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-navy-900 px-5 py-3 text-white">
        <div className="flex items-center gap-3">
          <span className="h-8 w-1.5 rounded-full bg-coral-500" />
          <p className="font-display text-lg font-bold">{tieuDe}</p>
          <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium">{g.n} sale</span>
        </div>
        <div className="flex items-center gap-5 text-sm">
          <span className="text-white/70">Hoàn thành <b className="ml-1 font-display text-lg text-white">{g.sum.ht.toLocaleString('vi-VN')} / {g.sum.mt.toLocaleString('vi-VN')}</b></span>
          <span className="text-white/70">% hoàn thành <b className="ml-1 font-display text-lg text-emerald-300">{g.ptTong == null ? '—' : hienPt2(g.ptTong)}</b></span>
          {phu}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] table-fixed border-collapse text-sm">
          <colgroup>
            <col style={{ width: '18%' }} /><col style={{ width: '10%' }} /><col style={{ width: '9%' }} /><col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} /><col style={{ width: '11%' }} /><col style={{ width: '20%' }} /><col style={{ width: '12%' }} />
          </colgroup>
          <thead>
            <tr className="bg-slate-100 text-xs font-semibold text-ink-600">
              <th className={`${o} text-left`}>Sale</th>
              <th className={`${o} text-center`}>Số data phụ trách</th>
              <th className={`${o} text-center`}>Data sale tìm kiếm</th>
              <th className={`${o} text-center`}>Lượt chăm sóc</th>
              <th className={`${o} text-center`}>KH liên hệ được</th>
              <th className={`${o} text-center`}>Hoàn thành / mục tiêu</th>
              <th className={`${o} text-center`}>% hoàn thành</th>
              <th className={`${o} text-center`}>Khách tồn quá {soNgay} ngày</th>
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  )
  return (
    <div className="space-y-6">
      {nhomPhong.map((g) => khung(g, (
        <>
          {g.rows.map((r) => (
            <tr key={r.sale.id} className="bg-white hover:bg-blue-50/40">
              <td className={`${o} font-semibold text-navy-900`}>{r.sale.full_name}</td>
              <td className={`${o} text-center`}>{r.phuTrach}</td>
              <td className={`${o} text-center`}>{r.moi}</td>
              <td className={`${o} text-center`}>{r.luot}</td>
              <td className={`${o} text-center`}>{r.nghe}</td>
              <td className={`${o} text-center font-semibold text-navy-900`}>{r.ht} / {r.mt}</td>
              <td className={o}><OPt pt={r.pt} /></td>
              <td className={`${o} text-center font-semibold ${r.ton > 0 ? 'text-rose-500' : 'text-ink-400'}`}>{r.ton}</td>
            </tr>
          ))}
          {tomTat(`Tổng phòng ${g.ten}`, g, false, 'bg-amber-50 text-navy-900')}
          {tomTat('Trung bình / sale', g, true, 'bg-orange-50 text-navy-900')}
        </>
      ), `Phòng ${g.ten}`, null))}
      {nhomPhong.length > 1 && (
        <div className="overflow-hidden rounded-2xl border-2 border-navy-900">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-navy-900 px-5 py-3 text-white">
            <p className="font-display text-lg font-bold">Toàn công ty <span className="ml-2 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium">{tatCa.n} sale</span></p>
            <div className="flex items-center gap-5 text-sm">
              <span className="text-white/70">Hoàn thành <b className="ml-1 font-display text-lg text-white">{tatCa.sum.ht.toLocaleString('vi-VN')} / {tatCa.sum.mt.toLocaleString('vi-VN')}</b></span>
              <span className="text-white/70">% hoàn thành <b className="ml-1 font-display text-lg text-emerald-300">{tatCa.ptTong == null ? '—' : hienPt2(tatCa.ptTong)}</b></span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] table-fixed border-collapse text-sm">
              <colgroup>
                <col style={{ width: '18%' }} /><col style={{ width: '10%' }} /><col style={{ width: '9%' }} /><col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} /><col style={{ width: '11%' }} /><col style={{ width: '20%' }} /><col style={{ width: '12%' }} />
              </colgroup>
              <tbody>
                {tomTat('TỔNG TOÀN CÔNG TY', tatCa, false, 'bg-amber-50 text-navy-900')}
                {tomTat('Trung bình / sale toàn công ty', tatCa, true, 'bg-orange-50 text-navy-900')}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
