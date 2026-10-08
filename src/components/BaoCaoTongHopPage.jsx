import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, FileDown } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { Button, Input, Select } from './ui'
import { NGUON_KHACH_OPTIONS, labelOf, formatVnd, giaTruocVat } from '../lib/constants'
import { khoangNgay } from '../lib/doanhSo'
import { useTrangThai } from '../lib/StatusContext'

// Báo cáo tổng hợp để nộp cho sếp: (1) doanh số theo từng dịch vụ,
// (2) hiệu quả từng nguồn data. Xuất ra Excel đúng 2 bảng này.

const DONG_DV = [
  { key: 'ads_moi', ten: 'Ads mới', mau: 'bg-violet-500' },
  { key: 'ads_tai_ky', ten: 'Ads tái ký', mau: 'bg-indigo-500' },
  { key: 'xay_shop', ten: 'Seller ( Tối ưu, xây shop)', mau: 'bg-coral-500' },
  { key: 'mall', ten: 'Mall', mau: 'bg-sky-500' },
  { key: 'follow', ten: 'Follow', mau: 'bg-teal-500' },
  { key: 'nhan_ban', ten: 'Nhân bản', mau: 'bg-amber-400' },
  { key: 'khac', ten: 'Dịch vụ bổ sung khác', mau: 'bg-slate-400' },
]

// Dòng báo cáo của 1 dịch vụ trong đơn
export function phanLoai(ten, loaiDon) {
  const t = ten || ''
  if (/mall/i.test(t)) return 'mall'
  if (/follow/i.test(t)) return 'follow'
  if (/nhân bản|nhan ban/i.test(t)) return 'nhan_ban'
  if (/quảng cáo|quang cao|\bads\b/i.test(t)) return loaiDon === 'tai_ky' ? 'ads_tai_ky' : 'ads_moi'
  if (/xây shop|tối ưu/i.test(t)) return 'xay_shop'
  return 'khac'
}

const pad = (n) => String(n).padStart(2, '0')
const ngayCua = (v) => {
  if (!v) return ''
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return String(v).slice(0, 10)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
const phanTram = (a, b) => (b > 0 ? Math.round((a / b) * 100) : null)
const hienPhanTram = (v) => (v === null ? '—' : `${v}%`)
const ngayHienThi = (s) => (s ? s.split('-').reverse().join('/') : '')

export default function BaoCaoTongHopPage() {
  const { maHoanHuy } = useTrangThai()
  const [orders, setOrders] = useState([])
  const [items, setItems] = useState([])
  const [customers, setCustomers] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [ky, setKy] = useState('thang_nay')
  const [tu, setTu] = useState('')
  const [den, setDen] = useState('')
  const [sale, setSale] = useState('')
  const [dangXuat, setDangXuat] = useState(false)
  const [dangXuatPdf, setDangXuatPdf] = useState(false)
  const baoCaoRef = useRef(null)

  useEffect(() => {
    (async () => {
      const [{ data: o }, { data: it }, { data: c }, { data: p }] = await Promise.all([
        supabase.from('orders').select('*'),
        supabase.from('order_items').select('*'),
        supabase.from('customers').select('id, nguon_khach, created_at, trang_thai_cham_soc, sale_id'),
        supabase.from('profiles').select('id, full_name').order('full_name'),
      ])
      setOrders(o || []); setItems(it || []); setCustomers(c || []); setProfiles(p || [])
      setLoading(false)
    })()
  }, [])

  const [tuNgay, denNgay] = useMemo(() => khoangNgay(ky, tu, den), [ky, tu, den])

  const kq = useMemo(() => {
    const khach = new Map(customers.map((c) => [c.id, c]))
    const laHoanHuy = (o) => o.trang_thai === 'huy' || maHoanHuy.includes(khach.get(o.customer_id)?.trang_thai_cham_soc)
    const trongKy = (d) => d && (!tuNgay || d >= tuNgay) && (!denNgay || d <= denNgay)

    // Đơn tính doanh số: chốt trong kỳ, không hoàn/huỷ, đúng sale đang lọc
    const don = orders.filter((o) => trongKy(o.ngay_chot) && !laHoanHuy(o) && (!sale || o.sale_id === sale))
    const donMap = new Map(don.map((o) => [o.id, o]))
    const itemCua = new Map()
    for (const it of items) {
      if (!donMap.has(it.order_id)) continue
      if (!itemCua.has(it.order_id)) itemCua.set(it.order_id, [])
      itemCua.get(it.order_id).push(it)
    }

    // ---- Bảng 1: theo dịch vụ (chưa VAT) ----
    const dv = Object.fromEntries(DONG_DV.map((d) => [d.key, { shops: new Set(), tien: 0 }]))
    for (const o of don) {
      for (const it of itemCua.get(o.id) || []) {
        const k = phanLoai(it.ten_dich_vu, o.loai_don)
        dv[k].shops.add(o.customer_id)
        dv[k].tien += giaTruocVat(it.gia)
      }
    }
    const bang1 = DONG_DV.map((d) => ({ ...d, soShop: dv[d.key].shops.size, tien: dv[d.key].tien }))
      .filter((d) => d.key !== 'khac' || d.soShop > 0 || d.tien > 0)
    const tong1 = { soShop: bang1.reduce((a, r) => a + r.soShop, 0), tien: bang1.reduce((a, r) => a + r.tien, 0) }

    // ---- Bảng 2: theo nguồn data ----
    // Chỉ các nguồn đang bật trong phần quản lý nguồn; khách thuộc nguồn đã tắt không tính vào bảng này
    const nguonKeys = NGUON_KHACH_OPTIONS.map((o) => o.value)
    const ng = Object.fromEntries(nguonKeys.map((k) => [k, { data: 0, tt: new Set(), tong: new Set(), tien: 0 }]))
    const keyNguon = (c) => (c?.nguon_khach && ng[c.nguon_khach] ? c.nguon_khach : null)
    const taoTrongKy = new Set()
    for (const c of customers) {
      if (sale && c.sale_id !== sale) continue
      if (!trongKy(ngayCua(c.created_at))) continue
      const kn = keyNguon(c)
      if (!kn) continue
      ng[kn].data += 1
      taoTrongKy.add(c.id)
    }
    for (const o of don) {
      const c = khach.get(o.customer_id)
      if (!c) continue
      const k = keyNguon(c)
      if (!k) continue
      const ds = itemCua.get(o.id)
      ng[k].tien += ds && ds.length ? ds.reduce((a, i) => a + (Number(i.gia) || 0), 0) : Number(o.gia_tri) || 0
      if (o.loai_don !== 'tai_ky') {
        ng[k].tong.add(o.customer_id)
        if (taoTrongKy.has(o.customer_id)) ng[k].tt.add(o.customer_id)
      }
    }
    const bang2 = nguonKeys.map((k) => ({
      key: k, ten: labelOf(NGUON_KHACH_OPTIONS, k) || k,
      data: ng[k].data, tt: ng[k].tt.size, tong: ng[k].tong.size, tien: ng[k].tien,
    }))
    const tong2 = bang2.reduce((a, r) => ({ data: a.data + r.data, tt: a.tt + r.tt, tong: a.tong + r.tong, tien: a.tien + r.tien }),
      { data: 0, tt: 0, tong: 0, tien: 0 })

    const shopChot = new Set(don.map((o) => o.customer_id)).size
    return { bang1, tong1, bang2, tong2, shopChot, soDon: don.length }
  }, [orders, items, customers, maHoanHuy, tuNgay, denNgay, sale, loading])

  const { bang1, tong1, bang2, tong2, shopChot } = kq
  const tenKy = tuNgay || denNgay ? `${ngayHienThi(tuNgay) || '...'} → ${ngayHienThi(denNgay) || '...'}` : 'Tất cả thời gian'
  const maxTien1 = Math.max(1, ...bang1.map((r) => r.tien))
  const maxData2 = Math.max(1, ...bang2.map((r) => Math.max(r.data, r.tong)))

  async function xuatExcel() {
    setDangXuat(true)
    try {
      const { default: ExcelJS } = await import('exceljs')
      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet('Bao cao tong hop')
      const XANH = 'FFC9DAF8', KEM = 'FFFFF2CC'
      const vien = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
      const tien = '#,##0" đ"'
      ws.columns = [{ width: 26 }, { width: 18 }, { width: 22 }, { width: 18 }, { width: 22 }, { width: 18 }, { width: 24 }]

      ws.mergeCells('A1:G1')
      ws.getCell('A1').value = 'BÁO CÁO TỔNG HỢP DOANH SỐ & NGUỒN DATA'
      ws.getCell('A1').font = { bold: true, size: 14 }
      ws.mergeCells('A2:G2')
      ws.getCell('A2').value = `Kỳ báo cáo: ${tenKy}${sale ? ' · Sale: ' + (profiles.find((p) => p.id === sale)?.full_name || '') : ' · Tất cả sale'}`
      ws.getCell('A2').font = { italic: true, color: { argb: 'FF555555' } }

      const dauBang = (row, nhan) => {
        nhan.forEach((t, i) => {
          const c = ws.getCell(row, i + 1)
          c.value = t
          c.font = { bold: true }
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XANH } }
          c.alignment = { horizontal: 'center', vertical: 'bottom', wrapText: true }
          c.border = vien
        })
        ws.getRow(row).height = 62
      }

      // Các chỉ số tổng (giống 4 ô trên màn hình)
      const kpi = [
        ['Doanh số (chưa VAT)', tong1.tien, tien],
        ['Số shop đã chốt', shopChot, '0'],
        ['Data nhận', tong2.data, '0'],
        ['Tỷ lệ chốt tổng', phanTram(tong2.tong, tong2.data) === null ? '' : phanTram(tong2.tong, tong2.data) / 100, '0%'],
      ]
      kpi.forEach(([nhan, gt, fmt], i) => {
        const a = ws.getCell(4, i + 1), b = ws.getCell(5, i + 1)
        a.value = nhan; a.font = { size: 10, color: { argb: 'FF555555' } }
        b.value = gt; b.numFmt = fmt; b.font = { bold: true, size: 15, color: { argb: 'FF4338CA' } }
        for (const c of [a, b]) { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }; c.border = vien; c.alignment = { horizontal: 'left', vertical: 'middle' } }
      })
      ws.getRow(5).height = 28

      // Bảng 1
      let r = 7
      dauBang(r, ['Dịch vụ', 'Số lượng shop', 'Doanh số tổng (chưa tính VAT)'])
      for (const d of bang1) {
        r += 1
        ws.getCell(r, 1).value = d.ten
        ws.getCell(r, 2).value = d.soShop
        ws.getCell(r, 3).value = d.tien
        ws.getCell(r, 3).numFmt = tien
        for (let i = 1; i <= 3; i++) ws.getCell(r, i).border = vien
      }
      r += 1
      ws.getCell(r, 1).value = 'Tổng'
      ws.getCell(r, 2).value = tong1.soShop
      ws.getCell(r, 3).value = tong1.tien
      ws.getCell(r, 3).numFmt = tien
      for (let i = 1; i <= 3; i++) {
        const c = ws.getCell(r, i)
        c.font = { bold: true }; c.border = vien
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XANH } }
      }

      // Bảng 2
      r += 3
      dauBang(r, ['Nguồn data', 'Số lượng data trong tháng', 'Số job chốt trực tiếp trong tháng', 'Tỷ lệ chốt trực tiếp %',
        'Số job chốt tổng (bao gồm data tháng cũ)', 'Tỷ lệ chốt tổng %', 'Doanh số từ các nguồn (tính cả VAT)'])
      const dong2 = [...bang2, { ten: 'Tổng', ...tong2, tong_dong: true }]
      for (const d of dong2) {
        r += 1
        const v = [d.ten, d.data, d.tt, phanTram(d.tt, d.data), d.tong, phanTram(d.tong, d.data), d.tien]
        v.forEach((x, i) => {
          const c = ws.getCell(r, i + 1)
          c.value = i === 3 || i === 5 ? (x === null ? '' : x / 100) : x
          if (i === 3 || i === 5) c.numFmt = '0%'
          if (i === 6) c.numFmt = '#,##0'
          if (i > 0 && i < 6) c.alignment = { horizontal: 'center' }
          c.border = vien
          if (i === 6) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: KEM } }
          if (d.tong_dong) { c.font = { bold: true }; if (i !== 6) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XANH } } }
        })
      }

      const buf = await wb.xlsx.writeBuffer()
      const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
      const a = document.createElement('a')
      a.href = url
      const d = new Date()
      a.download = `BaoCaoTongHop_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.xlsx`
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    } finally {
      setDangXuat(false)
    }
  }

  // Xuất PDF giống hệt màn hình: chụp phần dashboard + 2 bảng rồi ghép thành các trang A4,
  // chỉ cắt ở khoảng trống giữa các khối (không cắt đôi bảng/biểu đồ nếu vừa 1 trang)
  // Dựng bản in bằng style trực tiếp (màu hex) nên không phụ thuộc CSS của web
  function dungBanIn() {
    const C = { navy: '#0f1f3d', ink: '#475569', mute: '#94a3b8', line: '#e2e8f0', xanh: '#e0f2fe', chu: '#4338ca', cam: '#fff7e0', coral: '#f0624d' }
    const vnd = (v) => new Intl.NumberFormat('vi-VN').format(Math.round(v))
    const mauDv = { ads_moi: '#8b5cf6', ads_tai_ky: '#6366f1', xay_shop: '#f0624d', mall: '#0ea5e9', follow: '#14b8a6', nhan_ban: '#fbbf24', khac: '#94a3b8' }
    const card = 'background:#fff;border-radius:16px;padding:20px;box-shadow:0 1px 3px rgba(0,0,0,.08);'
    const tdS = `border:1px solid ${C.line};padding:10px 12px;font-size:13px;`
    const thS = `border:1px solid ${C.line};padding:12px;font-size:13px;font-weight:700;background:${C.xanh};color:${C.navy};`
    const kpi = (n, g, p, m) => `<div style="flex:1;padding:16px 20px;border-left:1px solid ${C.line};"><div style="font-size:13px;color:${C.ink}">${n}</div><div style="font-size:28px;font-weight:700;color:${m || C.navy};margin-top:4px">${g}</div><div style="font-size:11px;color:${C.mute};margin-top:2px">${p || ''}</div></div>`
    const bar = (pct, mau) => `<div style="height:9px;border-radius:9px;background:#f1f5f9;overflow:hidden;margin-top:4px"><div style="height:100%;width:${Math.max(0, Math.min(100, pct))}%;background:${mau};border-radius:9px"></div></div>`
    const nguoi = sale ? (profiles.find((p) => p.id === sale)?.full_name || '') : 'Tất cả sale'
    const h = `
<div style="width:1100px;padding:24px;background:#f4f6f9;color:${C.navy};font-family:Arial,Helvetica,sans-serif;box-sizing:border-box;">
 <div data-blk style="padding:0 4px 16px"><div style="font-size:22px;font-weight:700">BÁO CÁO TỔNG HỢP DOANH SỐ &amp; NGUỒN DATA</div><div style="font-size:13px;color:${C.ink};margin-top:4px">Kỳ báo cáo: ${tenKy} · ${nguoi}</div></div>
 <div data-blk style="display:flex;${card}padding:0;overflow:hidden;margin-bottom:16px">
  ${kpi('Doanh số (chưa VAT)', formatVnd(tong1.tien), 'đã trừ hoàn / huỷ', C.chu).replace('border-left:1px solid ' + C.line + ';', '')}
  ${kpi('Số shop đã chốt', shopChot, 'shop có đơn trong kỳ', '#14b8a6')}
  ${kpi('Data nhận', tong2.data, 'khách mới tạo trong kỳ')}
  ${kpi('Tỷ lệ chốt tổng', hienPhanTram(phanTram(tong2.tong, tong2.data)), `${tong2.tong} job chốt / ${tong2.data} data`, C.coral)}
 </div>
 <div data-blk style="display:flex;gap:16px;margin-bottom:16px">
  <div style="${card}flex:1"><div style="font-size:14px;font-weight:700;margin-bottom:12px">Doanh số theo dịch vụ</div>
   ${bang1.map((d) => `<div style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;font-size:13px"><span style="color:${C.ink}">${d.ten} <span style="font-size:11px;color:${C.mute}">· ${d.soShop} shop</span></span><b>${formatVnd(d.tien)}</b></div>${bar((d.tien / maxTien1) * 100, mauDv[d.key])}</div>`).join('')}
  </div>
  <div style="${card}flex:1"><div style="font-size:14px;font-weight:700;margin-bottom:12px">Nguồn data: data nhận và job chốt <span style="font-size:11px;font-weight:400;color:${C.mute}">(xám: Data · cam: Chốt tổng)</span></div>
   ${bang2.map((n) => `<div style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;font-size:13px"><span style="color:${C.ink}">${n.ten}</span><span style="font-size:11px;color:${C.mute}">${n.data} data · ${n.tong} chốt · <b style="color:${C.coral}">${hienPhanTram(phanTram(n.tong, n.data))}</b></span></div>${bar((n.data / maxData2) * 100, '#cbd5e1')}${bar((n.tong / maxData2) * 100, C.coral)}</div>`).join('')}
  </div>
 </div>
 <div data-blk style="${card}margin-bottom:16px"><div style="font-size:14px;font-weight:700;margin-bottom:12px">Bảng 1 — Doanh số theo dịch vụ</div>
  <table style="width:100%;border-collapse:collapse"><thead><tr><th style="${thS}text-align:left">Dịch vụ</th><th style="${thS}text-align:right">Số lượng shop</th><th style="${thS}text-align:right">Doanh số tổng (chưa tính VAT)</th></tr></thead><tbody>
  ${bang1.map((d) => `<tr><td style="${tdS}">${d.ten}</td><td style="${tdS}text-align:right">${d.soShop}</td><td style="${tdS}text-align:right">${formatVnd(d.tien)}</td></tr>`).join('')}
  <tr style="background:${C.xanh};font-weight:700;color:${C.chu}"><td style="${tdS}font-size:15px">Tổng</td><td style="${tdS}font-size:15px;text-align:right">${tong1.soShop}</td><td style="${tdS}font-size:15px;text-align:right">${formatVnd(tong1.tien)}</td></tr></tbody></table></div>
 <div data-blk style="${card}"><div style="font-size:14px;font-weight:700;margin-bottom:12px">Bảng 2 — Hiệu quả theo nguồn data</div>
  <table style="width:100%;border-collapse:collapse"><thead><tr><th style="${thS}text-align:left">Nguồn data</th><th style="${thS}text-align:center">Số lượng data trong tháng</th><th style="${thS}text-align:center">Số job chốt trực tiếp trong tháng</th><th style="${thS}text-align:center">Tỷ lệ chốt trực tiếp %</th><th style="${thS}text-align:center">Số job chốt tổng (bao gồm data tháng cũ)</th><th style="${thS}text-align:center">Tỷ lệ chốt tổng %</th><th style="${thS}text-align:center">Doanh số từ các nguồn (tính cả VAT)</th></tr></thead><tbody>
  ${bang2.map((n) => `<tr><td style="${tdS}">${n.ten}</td><td style="${tdS}text-align:center">${n.data}</td><td style="${tdS}text-align:center">${n.tt}</td><td style="${tdS}text-align:center">${hienPhanTram(phanTram(n.tt, n.data))}</td><td style="${tdS}text-align:center">${n.tong}</td><td style="${tdS}text-align:center">${hienPhanTram(phanTram(n.tong, n.data))}</td><td style="${tdS}text-align:right;background:${C.cam}">${vnd(n.tien)}</td></tr>`).join('')}
  <tr style="background:${C.xanh};font-weight:700;color:${C.chu}"><td style="${tdS}font-size:15px">Tổng</td><td style="${tdS}text-align:center">${tong2.data}</td><td style="${tdS}text-align:center">${tong2.tt}</td><td style="${tdS}text-align:center">${hienPhanTram(phanTram(tong2.tt, tong2.data))}</td><td style="${tdS}text-align:center">${tong2.tong}</td><td style="${tdS}text-align:center">${hienPhanTram(phanTram(tong2.tong, tong2.data))}</td><td style="${tdS}text-align:right;background:${C.cam}">${vnd(tong2.tien)}</td></tr></tbody></table>
  <div style="margin-top:12px;font-size:11px;color:${C.mute}">Job chốt trực tiếp = data tạo trong kỳ và chốt đơn mới trong kỳ. Job chốt tổng = mọi đơn mới chốt trong kỳ (kể cả data tháng cũ), nên tỷ lệ có thể trên 100%. Đơn tái ký và đơn hoàn / huỷ không tính vào job chốt.</div></div>
</div>`
    const host = document.createElement('div')
    host.style.cssText = 'position:fixed;left:-20000px;top:0;'
    host.innerHTML = h
    document.body.appendChild(host)
    return host
  }

  async function xuatPdf() {
    setDangXuatPdf(true)
    let host
    try {
      host = dungBanIn()
      const el = host.firstElementChild
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')])
      const cv = await html2canvas(el, { scale: 2, backgroundColor: '#f4f6f9', useCORS: true })
      const W = el.clientWidth
      const rongMm = 190, leMm = 10, caoMm = 297 - 2 * leMm
      const heSo = cv.width / W
      const cao1Trang = (caoMm / rongMm) * W
      const goc = el.getBoundingClientRect()
      const khoi = [...el.querySelectorAll('[data-blk]')].map((k) => { const b = k.getBoundingClientRect(); return { top: b.top - goc.top, bottom: b.bottom - goc.top } })
      const tong = goc.height
      const cat = []
      let bd = 0, dem = 0
      while (bd + cao1Trang < tong - 4 && dem++ < 30) {
        const gh = bd + cao1Trang
        const dinh = khoi.find((k) => k.top < gh - 1 && k.bottom > gh + 1)
        const diem = dinh && dinh.top > bd + cao1Trang * 0.15 ? dinh.top - 8 : gh
        cat.push(diem); bd = diem
      }
      const moc = [0, ...cat.map((y) => Math.round(y * heSo)), cv.height]
      const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
      for (let i = 0; i < moc.length - 1; i++) {
        const y = moc[i], h = moc[i + 1] - moc[i]
        if (h < 3) continue
        const p = document.createElement('canvas')
        p.width = cv.width; p.height = h
        const pc = p.getContext('2d')
        pc.fillStyle = '#f4f6f9'; pc.fillRect(0, 0, p.width, h)
        pc.drawImage(cv, 0, y, cv.width, h, 0, 0, cv.width, h)
        if (i > 0) pdf.addPage()
        pdf.setFillColor(244, 246, 249); pdf.rect(0, 0, 210, 297, 'F')
        pdf.addImage(p.toDataURL('image/jpeg', 0.95), 'JPEG', leMm, leMm, rongMm, (h * rongMm) / cv.width)
      }
      const url = URL.createObjectURL(pdf.output('blob'))
      const a = document.createElement('a')
      const d = new Date()
      a.href = url
      a.download = `BaoCaoTongHop_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.pdf`
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    } finally {
      if (host) host.remove()
      setDangXuatPdf(false)
    }
  }

  const th = 'border border-slate-200 px-3 py-3 font-semibold'
  const td = 'border border-slate-200 px-3 py-2.5 tabular-nums'

  return (
    <div className="h-full overflow-y-auto">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-8 py-5">
        <div>
          <h1 className="font-display text-xl font-bold text-navy-900">Báo cáo tổng hợp</h1>
          <p className="text-sm text-ink-600">
            Doanh số theo dịch vụ và hiệu quả từng nguồn data — {tenKy}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={xuatExcel} disabled={loading || dangXuat}>
            <Download size={16} /> {dangXuat ? 'Đang xuất...' : 'Xuất Excel (chỉ số liệu)'}
          </Button>
          <Button onClick={xuatPdf} disabled={loading || dangXuatPdf}>
            <FileDown size={16} /> {dangXuatPdf ? 'Đang xuất...' : 'Xuất báo cáo (giống màn hình)'}
          </Button>
        </div>
      </header>

      <div className="space-y-5 px-8 py-6">
        <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-white p-4 shadow-sm">
          <Select label="Kỳ" value={ky} onChange={(e) => setKy(e.target.value)} className="w-44">
            <option value="thang_nay">Tháng này</option>
            <option value="thang_truoc">Tháng trước</option>
            <option value="quy_nay">Quý này</option>
            <option value="nam_nay">Năm nay</option>
            <option value="tat_ca">Tất cả thời gian</option>
            <option value="tuy_chon">Chọn ngày...</option>
          </Select>
          {ky === 'tuy_chon' && (
            <>
              <Input label="Từ ngày" type="date" value={tu} onChange={(e) => setTu(e.target.value)} />
              <Input label="Đến ngày" type="date" value={den} onChange={(e) => setDen(e.target.value)} />
            </>
          )}
          <Select label="Sale" value={sale} onChange={(e) => setSale(e.target.value)} className="w-48">
            <option value="">Tất cả sale</option>
            {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </Select>
        </div>

        <div ref={baoCaoRef} className="space-y-5">
        {/* Chỉ số tổng */}
        <div className="grid grid-cols-2 divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-sm sm:grid-cols-4 sm:divide-y-0 sm:divide-x">
          <Kpi nhan="Doanh số (chưa VAT)" giaTri={formatVnd(tong1.tien)} chu="text-indigo-700" phu="đã trừ hoàn / huỷ" />
          <Kpi nhan="Số shop đã chốt" giaTri={shopChot} chu="text-teal-500" phu="shop có đơn trong kỳ" />
          <Kpi nhan="Data nhận" giaTri={tong2.data} phu="khách mới tạo trong kỳ" />
          <Kpi nhan="Tỷ lệ chốt tổng" giaTri={hienPhanTram(phanTram(tong2.tong, tong2.data))} chu="text-coral-500"
            phu={`${tong2.tong} job chốt / ${tong2.data} data`} />
        </div>

        {/* Dashboard */}
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-navy-900">Doanh số theo dịch vụ</h3>
            <div className="mt-4 space-y-3">
              {bang1.map((d) => (
                <div key={d.key}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-ink-600">{d.ten} <span className="text-xs text-ink-400">· {d.soShop} shop</span></span>
                    <b className="text-navy-900">{formatVnd(d.tien)}</b>
                  </div>
                  <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${d.mau}`} style={{ width: `${(d.tien / maxTien1) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-navy-900">Nguồn data: data nhận và job chốt</h3>
              <span className="flex items-center gap-3 text-xs text-ink-400">
                <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-slate-300" />Data</span>
                <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-coral-500" />Chốt tổng</span>
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {bang2.map((n) => (
                <div key={n.key}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-ink-600">{n.ten}</span>
                    <span className="text-xs text-ink-400">
                      {n.data} data · {n.tong} chốt · <b className="text-coral-500">{hienPhanTram(phanTram(n.tong, n.data))}</b>
                    </span>
                  </div>
                  <div className="mt-1 space-y-1">
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-slate-300" style={{ width: `${(n.data / maxData2) * 100}%` }} />
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-coral-500" style={{ width: `${(n.tong / maxData2) * 100}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Bảng 1 */}
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-navy-900">Bảng 1 — Doanh số theo dịch vụ</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-sky-100 text-left text-navy-900">
                  <th className={th}>Dịch vụ</th>
                  <th className={`${th} text-right`}>Số lượng shop</th>
                  <th className={`${th} text-right`}>Doanh số tổng (chưa tính VAT)</th>
                </tr>
              </thead>
              <tbody>
                {bang1.map((d) => (
                  <tr key={d.key}>
                    <td className={td}>{d.ten}</td>
                    <td className={`${td} text-right`}>{d.soShop}</td>
                    <td className={`${td} text-right`}>{formatVnd(d.tien)}</td>
                  </tr>
                ))}
                <tr className="bg-sky-100 text-base font-bold text-indigo-700 [&>td]:py-3.5">
                  <td className={td}>Tổng</td>
                  <td className={`${td} text-right`}>{tong1.soShop}</td>
                  <td className={`${td} text-right`}>{formatVnd(tong1.tien)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Bảng 2 */}
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-navy-900">Bảng 2 — Hiệu quả theo nguồn data</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-sm">
              <thead>
                <tr className="bg-sky-100 text-navy-900">
                  <th className={`${th} text-left`}>Nguồn data</th>
                  <th className={`${th} text-center`}>Số lượng data trong tháng</th>
                  <th className={`${th} text-center`}>Số job chốt trực tiếp trong tháng</th>
                  <th className={`${th} text-center`}>Tỷ lệ chốt trực tiếp %</th>
                  <th className={`${th} text-center`}>Số job chốt tổng (bao gồm data tháng cũ)</th>
                  <th className={`${th} text-center`}>Tỷ lệ chốt tổng %</th>
                  <th className={`${th} text-center`}>Doanh số từ các nguồn (tính cả VAT)</th>
                </tr>
              </thead>
              <tbody>
                {bang2.map((n) => (
                  <tr key={n.key}>
                    <td className={td}>{n.ten}</td>
                    <td className={`${td} text-center`}>{n.data}</td>
                    <td className={`${td} text-center`}>{n.tt}</td>
                    <td className={`${td} text-center`}>{hienPhanTram(phanTram(n.tt, n.data))}</td>
                    <td className={`${td} text-center`}>{n.tong}</td>
                    <td className={`${td} text-center`}>{hienPhanTram(phanTram(n.tong, n.data))}</td>
                    <td className={`${td} bg-amber-50 text-right`}>{new Intl.NumberFormat('vi-VN').format(Math.round(n.tien))}</td>
                  </tr>
                ))}
                <tr className="bg-sky-100 text-base font-bold text-indigo-700 [&>td]:py-3.5">
                  <td className={td}>Tổng</td>
                  <td className={`${td} text-center`}>{tong2.data}</td>
                  <td className={`${td} text-center`}>{tong2.tt}</td>
                  <td className={`${td} text-center`}>{hienPhanTram(phanTram(tong2.tt, tong2.data))}</td>
                  <td className={`${td} text-center`}>{tong2.tong}</td>
                  <td className={`${td} text-center`}>{hienPhanTram(phanTram(tong2.tong, tong2.data))}</td>
                  <td className={`${td} bg-amber-50 text-right`}>{new Intl.NumberFormat('vi-VN').format(Math.round(tong2.tien))}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-ink-400">
            Job chốt trực tiếp = data tạo trong kỳ và chốt đơn mới trong kỳ. Job chốt tổng = mọi đơn mới chốt trong kỳ (kể cả data tháng cũ), nên tỷ lệ có thể trên 100%.
            Đơn tái ký và đơn hoàn / huỷ không tính vào job chốt.
          </p>
        </section>
        </div>
      </div>
    </div>
  )
}

function Kpi({ nhan, giaTri, phu, chu = 'text-navy-900' }) {
  return (
    <div className="px-5 py-4">
      <p className="text-sm text-ink-600">{nhan}</p>
      <p className={`mt-1 font-display text-3xl font-bold tabular-nums ${chu}`}>{giaTri}</p>
      {phu && <p className="mt-0.5 text-xs text-ink-400">{phu}</p>}
    </div>
  )
}
