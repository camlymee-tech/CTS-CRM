// Tính số liệu trang Báo cáo (không có giao diện). BaoCaoPage chỉ lấy kết quả ở đây để hiển thị / xuất Excel.
// Mọi công thức giữ nguyên như khi còn nằm trong BaoCaoPage.jsx.
import { homNayLocal, ngayLocal, dinhDangNgay } from './ngay'
import { maChuaLienHe, tinhCanGoiLai, SO_NGAY_GOI_LAI } from './nhacViec'
import { hienPt2 } from './dashboardXlsx'
import { laAdmin, laLeader, laQuanLy } from './quyen'

const pad = (n) => String(n).padStart(2, '0')
const ymd = homNayLocal
const dmy = dinhDangNgay

// Khoảng ngày [từ, đến] (đều tính cả hai đầu)
export function khoangKy(ky, tu, den) {
  const d = new Date()
  const hom = ymd(d)
  if (ky === 'tat_ca') return ['0000-01-01', hom]
  if (ky === 'hom_nay') return [hom, hom]
  if (ky === 'hom_qua') { const x = new Date(); x.setDate(x.getDate() - 1); return [ymd(x), ymd(x)] }
  if (ky === '7') { const x = new Date(); x.setDate(x.getDate() - 6); return [ymd(x), hom] }
  if (ky === 'thang_nay') return [`${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`, hom]
  return [tu || hom, den || tu || hom]
}

export const tb1 = (x) => (Math.round(x * 10) / 10).toLocaleString('vi-VN')
export const tenPB = (s) => s.phong_ban || 'Chưa có phòng ban'
export const mauThanh = (p) => (p == null ? 'bg-slate-300' : p >= 1 ? 'bg-emerald-500' : p >= 0.5 ? 'bg-amber-400' : 'bg-rose-400')
export const mauChu = (p) => (p == null ? 'text-ink-400' : p >= 1 ? 'text-emerald-600' : p >= 0.5 ? 'text-amber-600' : 'text-rose-500')

// Tỷ lệ chốt của 1 dòng: khách chốt ÷ khách liên hệ được (không ở Chưa liên hệ)
export function tiLeChot(dem, tongRow, maChua, maChot) {
  const lh = tongRow - maChua.reduce((a, m) => a + (dem[m] || 0), 0)
  return lh > 0 ? hienPt2(maChot.reduce((a, m) => a + (dem[m] || 0), 0) / lh) : '—'
}

/**
 * Tính toàn bộ số liệu báo cáo.
 * Dữ liệu: customers, profiles, cs (lượt chăm sóc), logs (nhật ký đổi trạng thái), soMt (mục tiêu số), chonMt (khách chọn gọi lại)
 * Bộ lọc: ky, tu, den, locSale, locPhong · statuses / trangThai từ useTrangThai()
 */
export function tinhBaoCao({ customers, profiles, cs, logs, soMt, chonMt, statuses, trangThai, currentProfile, ky, tu, den, locSale, locPhong }) {
  const quanLy = laQuanLy(currentProfile)
  const [tuNgay, denNgay] = khoangKy(ky, tu, den)
  const trongKy = (x) => !!x && x >= tuNgay && x <= denNgay

  // Phạm vi xem: admin = tất cả phòng · leader và sale = các thành viên cùng phòng ban của mình
  const khongAdmin = profiles.filter((p) => !laAdmin(p))
  const thanhVien = laAdmin(currentProfile) ? khongAdmin
    : currentProfile?.phong_ban ? khongAdmin.filter((p) => p.phong_ban === currentProfile.phong_ban)
      : khongAdmin.filter((p) => p.id === currentProfile?.id)
  const xemChuaChia = false   // chỉ xem data chưa chia cho sale nào
  const dsPhong = [...new Set(thanhVien.map((p) => p.phong_ban).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi'))
  const thanhVienLoc = locPhong ? thanhVien.filter((p) => p.phong_ban === locPhong) : thanhVien
  const saleDangXem = quanLy && !xemChuaChia ? locSale : ''
  const dsSale = xemChuaChia ? [] : saleDangXem ? thanhVienLoc.filter((p) => p.id === saleDangXem) : thanhVienLoc
  const idSale = new Set(dsSale.map((s) => s.id))

  const maChua = maChuaLienHe(statuses)
  // Quy ước: đổi trạng thái từ "Chưa liên hệ" sang bất kỳ trạng thái nào = 1 lần KH liên hệ được
  const tachLog = (l) => { const [tu, den] = String(l.chi_tiet || '').split(' → '); return { tu, den, doi: !!tu && !!den && tu !== den } }
  const laNgheMay = (l) => { const x = tachLog(l); return x.doi && maChua.includes(x.tu) }
  // Đổi trạng thái từ trạng thái khác (không phải Chưa liên hệ) sang trạng thái mới = 1 lượt chăm sóc
  const laChamSoc = (l) => { const x = tachLog(l); return x.doi && !maChua.includes(x.tu) }

  // Dữ liệu đã lọc theo sale
  const khach = xemChuaChia ? customers.filter((c) => !c.sale_id) : customers.filter((c) => idSale.has(c.sale_id))
  const logLoc = logs.filter((l) => idSale.has(l.user_id))
  const ngayCs = (x) => ngayLocal(x.ngay_thuc_hien || x.created_at)

  // Khách cần gọi lại (tồn quá 7 ngày) — tình trạng hiện tại
  const canGoiLai = tinhCanGoiLai({ khach: customers, logs, statuses, isAdmin: true }).filter((r) => idSale.has(r.saleId))

  // Mục tiêu theo (ngày, sale)
  const dongMucTieu = (() => {
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
  })()

  // ===== Tab 1: Tổng quan — khách theo trạng thái, lọc theo ngày thêm khách =====
  // Tổng quan = (data mới chia/tìm trong kỳ mà vẫn chưa gọi) + (khách sale đã liên hệ được trong kỳ), mỗi khách 1 lần, theo trạng thái hiện tại
  const khachKy = (() => {
    const daLienHe = new Set()
    for (const l of logLoc) if (laNgheMay(l) && trongKy(ngayLocal(l.created_at))) daLienHe.add(l.customer_id)
    return khach.filter((c) => daLienHe.has(c.id) || (trongKy(ngayLocal(c.created_at)) && maChua.includes(c.trang_thai_cham_soc)))
  })()
  const demTT = trangThai.map((b) => ({ ...b, so: khachKy.filter((c) => c.trang_thai_cham_soc === b.ma).length }))

  // Admin: chia theo từng phòng (thêm dòng "Chưa chia sale" cho khách chưa có sale)
  const bangPhong = (() => {
    if (!laAdmin(currentProfile)) return []
    const m = new Map()
    const lay = (k) => { if (!m.has(k)) m.set(k, { ten: k, dem: {}, tong: 0, soSale: 0 }); return m.get(k) }
    const phongCua = new Map()
    for (const s of dsSale) { phongCua.set(s.id, tenPB(s)); lay(tenPB(s)).soSale += 1 }
    for (const c of khachKy) { if (!c.sale_id) continue; const o = lay(phongCua.get(c.sale_id) || 'Chưa có phòng ban'); o.dem[c.trang_thai_cham_soc] = (o.dem[c.trang_thai_cham_soc] || 0) + 1; o.tong += 1 }
    return [...m.values()].sort((a, b) => a.ten.localeCompare(b.ten, 'vi'))
  })()

  // Ngày khách đã chuyển từ "Chưa liên hệ" → trong ngày đó các lần đổi tiếp theo chỉ tính là KH liên hệ được, không tính chăm sóc
  const lanLienHeDau = new Set()
  for (const l of logs) if (laNgheMay(l)) lanLienHeDau.add(`${l.customer_id}|${ngayLocal(l.created_at)}`)

  // Chi tiết: từng phòng → từng sale (admin thấy mọi phòng · leader, sale chỉ thấy phòng mình)
  const chiTiet = (() => {
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
  })()

  // ===== Tab 2: Báo cáo mục tiêu — từng phòng, từng sale, tổng & trung bình =====
  const dongSale = dsSale.map((s) => {
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
  })

  const dongHienThi = dongSale.filter((r) => !laLeader(r.sale) || r.phuTrach > 0 || r.mt > 0 || r.luot > 0)
  const KEYS = ['phuTrach', 'moi', 'luot', 'nghe', 'ht', 'mt', 'ton']
  const gopNhom = (ten, rows) => {
    const sum = Object.fromEntries(KEYS.map((k) => [k, rows.reduce((a, r) => a + r[k], 0)]))
    const co = rows.filter((r) => r.pt != null)
    return { ten, rows, sum, n: rows.length, ptTong: sum.mt ? sum.ht / sum.mt : null, ptTb: co.length ? co.reduce((a, r) => a + r.pt, 0) / co.length : null }
  }
  const nhomPhong = (() => {
    const m = new Map()
    for (const r of dongHienThi) { const k = tenPB(r.sale); if (!m.has(k)) m.set(k, []); m.get(k).push(r) }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'vi')).map(([ten, rows]) => gopNhom(ten, rows))
  })()
  const tatCa = gopNhom('Toàn công ty', dongHienThi)

  const tenKy = ky === 'tat_ca' ? 'Tất cả thời gian' : ky === 'hom_nay' ? `Hôm nay (${dmy(tuNgay)})` : ky === 'hom_qua' ? `Hôm qua (${dmy(tuNgay)})` : `${dmy(tuNgay)} – ${dmy(denNgay)}`
  const tenSaleXem = quanLy ? (xemChuaChia ? 'Data chưa chia' : locSale ? dsSale[0]?.full_name : locPhong ? `Phòng ${locPhong}` : (laLeader(currentProfile) ? `Phòng ${currentProfile.phong_ban || ''}` : 'Tất cả sale')) : `Phòng ${currentProfile?.phong_ban || ''}`
  const phuDe = `Kỳ: ${tenKy} · ${tenSaleXem || ''}`

  return { tuNgay, denNgay, xemChuaChia, dsPhong, thanhVienLoc, maChua, khachKy, demTT, bangPhong, chiTiet, nhomPhong, tatCa, tenKy, phuDe }
}

// Dữ liệu file Excel của tab đang xem (đưa thẳng vào xuatBangXlsx)
export function duLieuExcel(tab, bc, trangThai) {
  const { chiTiet, bangPhong, nhomPhong, tatCa, phuDe, tuNgay } = bc
  if (tab === 'tong_quan') {
    const rows = []
    const tongCong = { tong: 0, dem: {} }
    const cong = (o) => { tongCong.tong += o.tong; for (const [k, v] of Object.entries(o.dem)) tongCong.dem[k] = (tongCong.dem[k] || 0) + v }
    for (const g of chiTiet) {
      for (const r of g.rows) rows.push([g.ten, r.sale.full_name, r.tong, ...trangThai.map((b) => r.dem[b.ma] || 0)])
      rows.push([`Tổng phòng ${g.ten}`, '', g.tong, ...trangThai.map((b) => g.dem[b.ma] || 0)])
      cong(g)
    }
    const chua = bangPhong.find((o) => o.chua)
    if (chua) { rows.push(['Chưa chia sale', '', chua.tong, ...trangThai.map((b) => chua.dem[b.ma] || 0)]); cong(chua) }
    if (chiTiet.length > 1 || chua) rows.push(['TỔNG CỘNG', '', tongCong.tong, ...trangThai.map((b) => tongCong.dem[b.ma] || 0)])
    return {
      tieuDe: 'Tổng quan – khách theo trạng thái (từng phòng, từng sale)', phuDe,
      heads: ['Phòng', 'Sale', 'Tổng khách', ...trangThai.map((b) => b.ten)],
      rows, tenFile: `bao-cao-tong-quan-${tuNgay}.xlsx`,
    }
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
  return {
    tieuDe: 'Báo cáo mục tiêu', phuDe,
    heads: ['Sale', 'Số data phụ trách', 'Data sale tìm kiếm', 'Lượt chăm sóc', 'KH liên hệ được', 'Hoàn thành / mục tiêu', '% hoàn thành', `Khách tồn quá ${SO_NGAY_GOI_LAI} ngày`],
    rows, tenFile: `bao-cao-muc-tieu-${tuNgay}.xlsx`,
  }
}
