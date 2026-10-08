import { useEffect, useMemo, useState } from 'react'
import { Download, FileDown, Save, Wand2 } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { Button, Select } from './ui'
import { NGUON_KHACH_OPTIONS, labelOf, formatVnd, giaTruocVat } from '../lib/constants'
import { useTrangThai } from '../lib/StatusContext'
import { phanLoai } from './BaoCaoTongHopPage'

// Mục tiêu hàng tháng theo từng nhân sự (theo mẫu Google Sheet của team):
// Số data theo nguồn → tỷ lệ chốt → số HĐ; Số HĐ × giá trị TB theo dịch vụ → doanh thu mục tiêu.
// Số thực tế lấy tự động từ khách và đơn trong app.

const DV = [
  { key: 'ads', ten: 'ADS', loai: ['ads_moi'], gia: 3000000 },
  { key: 'xay_shop', ten: 'Xây shop (Seller)', loai: ['xay_shop'], gia: 10000000 },
  { key: 'mall', ten: 'Mall', loai: ['mall'], gia: 5000000 },
]
const pad = (n) => String(n).padStart(2, '0')
const so = (v) => Number(v) || 0
const nghin = (v) => new Intl.NumberFormat('vi-VN').format(Math.round(so(v)))
const pt = (a, b) => (b > 0 ? Math.round((a / b) * 100) : null)
const hienPt = (v) => (v === null ? '—' : `${v}%`)
const ngayCua = (v) => {
  if (!v) return ''
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? String(v).slice(0, 10) : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
const thangTruoc = (t) => { const [y, m] = t.split('-').map(Number); const d = new Date(y, m - 2, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}` }
const khoang = (t) => { const [y, m] = t.split('-').map(Number); return [`${t}-01`, `${t}-${pad(new Date(y, m, 0).getDate())}`] }

// Mục tiêu 1 người: tính các số suy ra
function tinhMt(f, nguon) {
  const data = Object.fromEntries(nguon.map((n) => [n.key, so(f?.data?.[n.key])]))
  const chot = Object.fromEntries(nguon.map((n) => [n.key, so(f?.chot?.[n.key])]))
  const hdNguon = Object.fromEntries(nguon.map((n) => [n.key, Math.round((data[n.key] * chot[n.key]) / 100)]))
  const tongData = nguon.reduce((a, n) => a + data[n.key], 0)
  const tongHdNguon = nguon.reduce((a, n) => a + hdNguon[n.key], 0)
  const dv = Object.fromEntries(DV.map((d) => {
    const hd = so(f?.dv?.[d.key]?.hd), gia = so(f?.dv?.[d.key]?.gia)
    return [d.key, { hd, gia, dt: hd * gia }]
  }))
  const tongHd = DV.reduce((a, d) => a + dv[d.key].hd, 0)
  const tongDt = DV.reduce((a, d) => a + dv[d.key].dt, 0)
  return { data, chot, hdNguon, tongData, tongHdNguon, dv, tongHd, tongDt, giaTb: tongHd ? tongDt / tongHd : 0 }
}

export default function MucTieuNhanSuPage() {
  const { maHoanHuy } = useTrangThai()
  const nguon = NGUON_KHACH_OPTIONS.map((o) => ({ key: o.value, ten: o.label }))
  const [orders, setOrders] = useState([])
  const [items, setItems] = useState([])
  const [customers, setCustomers] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const hn = new Date()
  const [thang, setThang] = useState(`${hn.getFullYear()}-${pad(hn.getMonth() + 1)}`)
  const [mt, setMt] = useState({})          // sale_key -> du_lieu
  const [chon, setChon] = useState('')
  const [daSua, setDaSua] = useState(false)
  const [dangLuu, setDangLuu] = useState(false)
  const [thongBao, setThongBao] = useState('')
  const [cheDo, setCheDo] = useState('truoc')
  const [dangXuat, setDangXuat] = useState('')

  useEffect(() => {
    (async () => {
      const [{ data: o }, { data: it }, { data: c }, { data: p }] = await Promise.all([
        supabase.from('orders').select('*'),
        supabase.from('order_items').select('*'),
        supabase.from('customers').select('id, nguon_khach, created_at, trang_thai_cham_soc, sale_id'),
        supabase.from('profiles').select('id, full_name').order('full_name'),
      ])
      setOrders(o || []); setItems(it || []); setCustomers(c || []); setProfiles(p || [])
      setChon((p && p[0] && p[0].id) || '')
      setLoading(false)
    })()
  }, [])

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('muc_tieu_nhan_su').select('*').eq('thang', thang)
      setMt(Object.fromEntries((data || []).filter((r) => r.thang === thang || !r.thang).map((r) => [r.sale_key, r.du_lieu || {}])))
      setDaSua(false); setThongBao('')
    })()
  }, [thang])

  // Số thực tế của 1 tháng, theo từng sale
  function thucTeThang(t) {
    const [tu, den] = khoang(t)
    const trong = (d) => d && d >= tu && d <= den
    const khach = new Map(customers.map((c) => [c.id, c]))
    const hoan = (o) => o.trang_thai === 'huy' || maHoanHuy.includes(khach.get(o.customer_id)?.trang_thai_cham_soc)
    const kq = {}
    const lay = (id) => (kq[id] ||= { data: {}, chot: {}, dv: Object.fromEntries(DV.map((d) => [d.key, { khach: new Set(), dt: 0 }])), setChot: new Set() })
    for (const c of customers) {
      if (!trong(ngayCua(c.created_at)) || !c.sale_id) continue
      const k = c.nguon_khach; if (!nguon.some((n) => n.key === k)) continue
      const r = lay(c.sale_id); r.data[k] = (r.data[k] || 0) + 1
    }
    const don = orders.filter((o) => trong(o.ngay_chot) && !hoan(o) && o.sale_id && o.loai_don !== 'tai_ky')
    const donMap = new Map(don.map((o) => [o.id, o]))
    for (const o of don) {
      const k = khach.get(o.customer_id)?.nguon_khach
      const r = lay(o.sale_id)
      if (nguon.some((n) => n.key === k) && !r.setChot.has(o.customer_id + '|' + k)) { r.setChot.add(o.customer_id + '|' + k); r.chot[k] = (r.chot[k] || 0) + 1 }
    }
    for (const it of items) {
      const o = donMap.get(it.order_id); if (!o) continue
      const pl = phanLoai(it.ten_dich_vu, o.loai_don)
      const d = DV.find((x) => x.loai.includes(pl)); if (!d) continue
      const r = lay(o.sale_id)
      r.dv[d.key].khach.add(o.customer_id); r.dv[d.key].dt += giaTruocVat(it.gia)
    }
    for (const r of Object.values(kq)) {
      r.tongData = nguon.reduce((a, n) => a + (r.data[n.key] || 0), 0)
      r.tongChot = nguon.reduce((a, n) => a + (r.chot[n.key] || 0), 0)
      r.hd = DV.reduce((a, d) => a + r.dv[d.key].khach.size, 0)
      r.dt = DV.reduce((a, d) => a + r.dv[d.key].dt, 0)
    }
    return kq
  }
  const thuc = useMemo(() => thucTeThang(thang), [thang, orders, items, customers, maHoanHuy])
  const truoc = useMemo(() => thucTeThang(thangTruoc(thang)), [thang, orders, items, customers, maHoanHuy])
  const trong0 = { data: {}, chot: {}, tongData: 0, tongChot: 0, hd: 0, dt: 0, dv: Object.fromEntries(DV.map((d) => [d.key, { khach: new Set(), dt: 0 }])) }
  const tt = (id) => thuc[id] || trong0

  const dong = profiles.map((p) => {
    const m = tinhMt(mt[p.id], nguon), t = tt(p.id)
    return { id: p.id, ten: p.full_name, m, t }
  })
  const tong = dong.reduce((a, r) => ({
    mData: a.mData + r.m.tongData, tData: a.tData + r.t.tongData, mHd: a.mHd + r.m.tongHd, tHd: a.tHd + r.t.hd,
    mDt: a.mDt + r.m.tongDt, tDt: a.tDt + r.t.dt,
  }), { mData: 0, tData: 0, mHd: 0, tHd: 0, mDt: 0, tDt: 0 })
  const team = mt.team || {}

  function sua(id, fn) {
    setMt((cu) => { const b = JSON.parse(JSON.stringify(cu[id] || {})); fn(b); return { ...cu, [id]: b } })
    setDaSua(true)
  }
  const setNum = (id, duongDan, v) => sua(id, (b) => {
    let o = b; duongDan.slice(0, -1).forEach((k) => { o = o[k] ||= {} })
    o[duongDan[duongDan.length - 1]] = v === '' ? '' : Math.max(0, Number(v))
  })

  // Gợi ý chia mục tiêu team cho từng nhân sự
  function chiaTuTeam() {
    const tD = so(team.tong_data), tDt = so(team.tong_dt)
    if (!tD && !tDt) { setThongBao('Chị nhập mục tiêu team (tổng data hoặc doanh thu) trước nhé.'); return }
    const n = profiles.length || 1
    const dtTruoc = profiles.map((p) => (truoc[p.id]?.dt || 0))
    const sum = dtTruoc.reduce((a, b) => a + b, 0)
    const w = profiles.map((_, i) => (cheDo === 'truoc' && sum > 0 ? dtTruoc[i] / sum : 1 / n))
    const all = Object.values(truoc)
    const tongDataTr = nguon.map((g) => all.reduce((a, r) => a + (r.data[g.key] || 0), 0))
    const tongDataTrAll = tongDataTr.reduce((a, b) => a + b, 0)
    const mix = nguon.map((g, i) => (tongDataTrAll ? tongDataTr[i] / tongDataTrAll : 1 / nguon.length))
    const chotTr = nguon.map((g) => { const d = all.reduce((a, r) => a + (r.data[g.key] || 0), 0); const c = all.reduce((a, r) => a + (r.chot[g.key] || 0), 0); return d ? Math.min(100, Math.round((c / d) * 100)) : 30 })
    const dtDv = DV.map((d) => all.reduce((a, r) => a + r.dv[d.key].dt, 0)); const dtDvAll = dtDv.reduce((a, b) => a + b, 0)
    const mixDv = DV.map((d, i) => (dtDvAll ? dtDv[i] / dtDvAll : [0.5, 0.4, 0.1][i]))
    const giaTr = DV.map((d) => { const dt = all.reduce((a, r) => a + r.dv[d.key].dt, 0); const h = all.reduce((a, r) => a + r.dv[d.key].khach.size, 0); return h ? Math.round(dt / h / 1000) * 1000 : d.gia })
    setMt((cu) => {
      const moi = { ...cu }
      profiles.forEach((p, i) => {
        const f = { data: {}, chot: {}, dv: {} }
        nguon.forEach((g, j) => { f.data[g.key] = Math.round(tD * w[i] * mix[j]); f.chot[g.key] = chotTr[j] })
        DV.forEach((d, j) => { const dt = tDt * w[i] * mixDv[j]; f.dv[d.key] = { gia: giaTr[j], hd: giaTr[j] ? Math.round(dt / giaTr[j]) : 0 } })
        moi[p.id] = f
      })
      return moi
    })
    setDaSua(true)
    setThongBao(`Đã gợi ý chia ${cheDo === 'truoc' ? 'theo tỷ lệ doanh số tháng trước' : 'đều'} cho ${profiles.length} nhân sự. Chị chỉnh lại từng người rồi bấm Lưu.`)
  }

  async function luu() {
    setDangLuu(true)
    const rows = Object.entries(mt).map(([sale_key, du_lieu]) => ({ thang, sale_key, du_lieu, updated_at: new Date().toISOString() }))
    const { error } = await supabase.from('muc_tieu_nhan_su').upsert(rows, { onConflict: 'thang,sale_key' })
    setDangLuu(false)
    if (error) { setThongBao('Lưu chưa được: ' + error.message); return }
    setDaSua(false); setThongBao('Đã lưu mục tiêu tháng ' + thang.split('-').reverse().join('/'))
  }

  const tenThang = thang.split('-').reverse().join('/')
  const tai = (blob, ten) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = ten
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }

  async function xuatExcel() {
    setDangXuat('xlsx')
    try {
      const { default: ExcelJS } = await import('exceljs')
      const wb = new ExcelJS.Workbook()
      const XANH = 'FFC9DAF8', vien = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
      const tien = '#,##0', pc = '0%'
      const to = (c, fill, bold) => { c.border = vien; if (fill) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } }; if (bold) c.font = { bold: true } }
      const dau = (ws, row, nhan) => { nhan.forEach((t, i) => { const c = ws.getCell(row, i + 1); c.value = t; to(c, XANH, true); c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true } }); ws.getRow(row).height = 36 }
      const p100 = (a, b) => (b > 0 ? a / b : '')

      // Sheet 1: tổng hợp theo nhân sự
      const ws = wb.addWorksheet('Tổng hợp')
      ws.columns = [{ width: 26 }, ...Array(11).fill({ width: 15 })]
      ws.mergeCells('A1:L1'); ws.getCell('A1').value = `MỤC TIÊU VÀ THỰC TẾ NHÂN SỰ — THÁNG ${tenThang}`; ws.getCell('A1').font = { bold: true, size: 14 }
      dau(ws, 3, ['Nhân sự', 'Data mục tiêu', 'Data thực tế', '% data', 'HĐ mục tiêu', 'HĐ thực tế', '% HĐ', 'Giá trị TB/HĐ mục tiêu', 'Giá trị TB/HĐ thực tế', 'Doanh thu mục tiêu', 'Doanh thu thực tế', '% hoàn thành'])
      let r = 3
      const ghi = (ten, v, tongDong) => {
        r += 1
        v.forEach((x, i) => { const c = ws.getCell(r, i + 1); c.value = i === 0 ? ten : x; to(c, tongDong ? XANH : null, tongDong); if ([3, 6, 11].includes(i)) c.numFmt = pc; else if (i > 0) c.numFmt = tien; if (i > 0) c.alignment = { horizontal: 'center' } })
      }
      dong.forEach((d) => ghi(d.ten, [0, d.m.tongData, d.t.tongData, p100(d.t.tongData, d.m.tongData), d.m.tongHd, d.t.hd, p100(d.t.hd, d.m.tongHd), Math.round(d.m.giaTb), d.t.hd ? Math.round(d.t.dt / d.t.hd) : 0, d.m.tongDt, d.t.dt, p100(d.t.dt, d.m.tongDt)]))
      ghi('Tổng team', [0, tong.mData, tong.tData, p100(tong.tData, tong.mData), tong.mHd, tong.tHd, p100(tong.tHd, tong.mHd), tong.mHd ? Math.round(tong.mDt / tong.mHd) : 0, tong.tHd ? Math.round(tong.tDt / tong.tHd) : 0, tong.mDt, tong.tDt, p100(tong.tDt, tong.mDt)], true)

      // Sheet 2: chi tiết từng người theo mẫu sheet
      const w2 = wb.addWorksheet('Chi tiết từng người')
      w2.columns = [{ width: 28 }, ...Array(7).fill({ width: 17 })]
      let q = 1
      for (const d of dong) {
        w2.mergeCells(q, 1, q, 8)
        w2.getCell(q, 1).value = `MỤC TIÊU DATA MỚI VÀ DOANH THU MỚI T${tenThang} — ${d.ten}`; w2.getCell(q, 1).font = { bold: true, size: 12 }
        q += 1; dau(w2, q, ['Nguồn data', 'Số data mục tiêu', '% tỷ trọng', 'Tỷ lệ chốt mục tiêu %', 'Số HĐ mục tiêu', 'Data thực tế', 'Job chốt thực tế', 'Tỷ lệ chốt thực tế'])
        for (const g of nguon) {
          q += 1
          const v = [g.ten, d.m.data[g.key], p100(d.m.data[g.key], d.m.tongData), d.m.chot[g.key] / 100, d.m.hdNguon[g.key], d.t.data[g.key] || 0, d.t.chot[g.key] || 0, p100(d.t.chot[g.key] || 0, d.t.data[g.key] || 0)]
          v.forEach((x, i) => { const c = w2.getCell(q, i + 1); c.value = x; to(c); if ([2, 3, 7].includes(i)) c.numFmt = pc; if (i) c.alignment = { horizontal: 'center' } })
        }
        q += 1
        ;[ 'Tổng', d.m.tongData, d.m.tongData ? 1 : '', p100(d.m.tongHdNguon, d.m.tongData), d.m.tongHdNguon, d.t.tongData, d.t.tongChot, p100(d.t.tongChot, d.t.tongData)].forEach((x, i) => { const c = w2.getCell(q, i + 1); c.value = x; to(c, XANH, true); if ([2, 3, 7].includes(i)) c.numFmt = pc; if (i) c.alignment = { horizontal: 'center' } })
        q += 2; dau(w2, q, ['Dịch vụ', 'Số HĐ mục tiêu', 'Giá trị TB/HĐ', 'Doanh thu mục tiêu', 'Số HĐ thực tế', 'Doanh thu thực tế', '% hoàn thành'])
        for (const dv of DV) {
          q += 1
          const a = d.m.dv[dv.key], b = d.t.dv[dv.key]
          ;[dv.ten, a.hd, a.gia, a.dt, b.khach.size, b.dt, p100(b.dt, a.dt)].forEach((x, i) => { const c = w2.getCell(q, i + 1); c.value = x; to(c); if ([2, 3, 5].includes(i)) c.numFmt = tien; if (i === 6) c.numFmt = pc; if (i) c.alignment = { horizontal: i === 2 || i === 3 || i === 5 ? 'right' : 'center' } })
        }
        q += 1
        ;['Tổng', d.m.tongHd, Math.round(d.m.giaTb), d.m.tongDt, d.t.hd, d.t.dt, p100(d.t.dt, d.m.tongDt)].forEach((x, i) => { const c = w2.getCell(q, i + 1); c.value = x; to(c, XANH, true); if ([2, 3, 5].includes(i)) c.numFmt = tien; if (i === 6) c.numFmt = pc; if (i) c.alignment = { horizontal: i === 2 || i === 3 || i === 5 ? 'right' : 'center' } })
        q += 3
      }
      const buf = await wb.xlsx.writeBuffer()
      tai(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `MucTieuNhanSu_${thang}.xlsx`)
    } finally { setDangXuat('') }
  }

  // Bản in dựng bằng style trực tiếp để PDF luôn đủ màu, giống màn hình
  function dungBanIn() {
    const C = { navy: '#0f1f3d', ink: '#475569', mute: '#94a3b8', line: '#e2e8f0', xanh: '#e0f2fe', chu: '#4338ca', coral: '#f0624d', teal: '#14b8a6', vang: '#fbbf24', nhat: '#eef6fd' }
    const card = 'background:#fff;border-radius:16px;padding:20px;box-shadow:0 1px 3px rgba(0,0,0,.08);margin-bottom:16px;'
    const tdS = `border:1px solid ${C.line};padding:9px 10px;font-size:12px;`
    const thS = `border:1px solid ${C.line};padding:10px;font-size:12px;font-weight:700;background:${C.xanh};color:${C.navy};text-align:center;`
    const tot = `background:${C.xanh};font-weight:700;color:${C.chu};`
    const mau = (v) => (v === null ? '#e2e8f0' : v >= 100 ? C.teal : v >= 70 ? C.vang : C.coral)
    const bar = (v) => `<span style="display:inline-block;width:70px;height:8px;border-radius:8px;background:#f1f5f9;vertical-align:middle;position:relative"><span style="position:absolute;left:0;top:0;height:8px;border-radius:8px;width:${Math.round(Math.min(100, v || 0) * 0.7)}px;background:${mau(v)}"></span></span> <b>${hienPt(v)}</b>`
    const c = 'text-align:center;', rr = 'text-align:right;'
    const kpi = (n, m, t, v) => `<div style="flex:1;padding:16px 20px;border-left:1px solid ${C.line}"><div style="font-size:13px;color:${C.ink}">${n}</div><div style="font-size:26px;font-weight:700;margin-top:4px">${t}</div><div style="font-size:11px;color:${C.mute}">thực tế · mục tiêu ${m}</div>${v === undefined ? '' : `<div style="margin-top:8px">${bar(v)}</div>`}</div>`
    const chiTiet = (d) => `
 <div data-blk style="${card}"><div style="font-size:14px;font-weight:700;margin-bottom:10px">Mục tiêu data mới và doanh thu mới — ${d.ten}</div>
  <table style="width:100%;border-collapse:collapse"><thead><tr><th style="${thS}text-align:left">Nguồn data</th><th style="${thS}">Số data mục tiêu</th><th style="${thS}">% tỷ trọng</th><th style="${thS}">Tỷ lệ chốt mục tiêu %</th><th style="${thS}">Số HĐ mục tiêu</th><th style="${thS}">Data thực tế</th><th style="${thS}">Job chốt thực tế</th><th style="${thS}">Tỷ lệ chốt thực tế</th></tr></thead><tbody>
  ${nguon.map((g) => `<tr><td style="${tdS}">${g.ten}</td><td style="${tdS}${c}">${d.m.data[g.key]}</td><td style="${tdS}${c}">${hienPt(pt(d.m.data[g.key], d.m.tongData))}</td><td style="${tdS}${c}">${d.m.chot[g.key]}%</td><td style="${tdS}${c}">${d.m.hdNguon[g.key]}</td><td style="${tdS}${c}">${d.t.data[g.key] || 0}</td><td style="${tdS}${c}">${d.t.chot[g.key] || 0}</td><td style="${tdS}${c}">${hienPt(pt(d.t.chot[g.key] || 0, d.t.data[g.key] || 0))}</td></tr>`).join('')}
  <tr style="${tot}"><td style="${tdS}">Tổng</td><td style="${tdS}${c}">${d.m.tongData}</td><td style="${tdS}${c}">${d.m.tongData ? '100%' : '—'}</td><td style="${tdS}${c}">${hienPt(pt(d.m.tongHdNguon, d.m.tongData))}</td><td style="${tdS}${c}">${d.m.tongHdNguon}</td><td style="${tdS}${c}">${d.t.tongData}</td><td style="${tdS}${c}">${d.t.tongChot}</td><td style="${tdS}${c}">${hienPt(pt(d.t.tongChot, d.t.tongData))}</td></tr></tbody></table>
  <table style="width:100%;border-collapse:collapse;margin-top:14px"><thead><tr><th style="${thS}text-align:left">Dịch vụ</th><th style="${thS}">Số HĐ mục tiêu</th><th style="${thS}">Giá trị TB / HĐ</th><th style="${thS}">Doanh thu mục tiêu</th><th style="${thS}">Số HĐ thực tế</th><th style="${thS}">Doanh thu thực tế</th><th style="${thS}">% hoàn thành</th></tr></thead><tbody>
  ${DV.map((v) => { const a = d.m.dv[v.key], b = d.t.dv[v.key]; return `<tr><td style="${tdS}">${v.ten}</td><td style="${tdS}${c}">${a.hd}</td><td style="${tdS}${rr}">${nghin(a.gia)}</td><td style="${tdS}${rr}">${nghin(a.dt)}</td><td style="${tdS}${c}">${b.khach.size}</td><td style="${tdS}${rr}">${nghin(b.dt)}</td><td style="${tdS}${c}">${hienPt(pt(b.dt, a.dt))}</td></tr>` }).join('')}
  <tr style="${tot}"><td style="${tdS}">Tổng</td><td style="${tdS}${c}">${d.m.tongHd}</td><td style="${tdS}${rr}">${nghin(d.m.giaTb)}</td><td style="${tdS}${rr}">${nghin(d.m.tongDt)}</td><td style="${tdS}${c}">${d.t.hd}</td><td style="${tdS}${rr}">${nghin(d.t.dt)}</td><td style="${tdS}${c}">${hienPt(pt(d.t.dt, d.m.tongDt))}</td></tr></tbody></table></div>`
    const h = `
<div style="width:1100px;padding:24px;background:#f4f6f9;color:${C.navy};font-family:Arial,Helvetica,sans-serif;box-sizing:border-box;">
 <div data-blk style="padding:0 4px 16px"><div style="font-size:22px;font-weight:700">MỤC TIÊU NHÂN SỰ HÀNG THÁNG — THÁNG ${tenThang}</div><div style="font-size:13px;color:${C.ink};margin-top:4px">Mục tiêu data, hợp đồng, doanh thu của từng người so với số thực tế</div></div>
 <div data-blk style="display:flex;${card}padding:0;overflow:hidden">
  ${kpi('Doanh thu (chưa VAT)', nghin(tong.mDt), nghin(tong.tDt), hoanThanh).replace(`border-left:1px solid ${C.line}`, '')}
  ${kpi('Số data', tong.mData, tong.tData, pt(tong.tData, tong.mData))}
  ${kpi('Số hợp đồng', tong.mHd, tong.tHd, pt(tong.tHd, tong.mHd))}
  ${kpi('Giá trị TB / HĐ', nghin(tong.mHd ? tong.mDt / tong.mHd : 0), nghin(tong.tHd ? tong.tDt / tong.tHd : 0))}
 </div>
 <div data-blk style="${card}"><div style="font-size:14px;font-weight:700;margin-bottom:10px">Mục tiêu và thực tế theo nhân sự</div>
  <table style="width:100%;border-collapse:collapse"><thead>
   <tr><th rowspan="2" style="${thS}text-align:left">Nhân sự</th><th colspan="3" style="${thS}">Số data</th><th colspan="3" style="${thS}">Số hợp đồng</th><th colspan="2" style="${thS}">Giá trị TB / HĐ</th><th colspan="3" style="${thS}">Doanh thu (chưa VAT)</th></tr>
   <tr>${['Mục tiêu', 'Thực tế', '%', 'Mục tiêu', 'Thực tế', '%', 'Mục tiêu', 'Thực tế', 'Mục tiêu', 'Thực tế', '% hoàn thành'].map((x) => `<th style="${thS}font-weight:500">${x}</th>`).join('')}</tr></thead><tbody>
  ${dong.map((d) => `<tr><td style="${tdS}font-weight:600">${d.ten}</td><td style="${tdS}${c}">${d.m.tongData}</td><td style="${tdS}${c}">${d.t.tongData}</td><td style="${tdS}${c}">${hienPt(pt(d.t.tongData, d.m.tongData))}</td><td style="${tdS}${c}">${d.m.tongHd}</td><td style="${tdS}${c}">${d.t.hd}</td><td style="${tdS}${c}">${hienPt(pt(d.t.hd, d.m.tongHd))}</td><td style="${tdS}${rr}">${nghin(d.m.giaTb)}</td><td style="${tdS}${rr}">${nghin(d.t.hd ? d.t.dt / d.t.hd : 0)}</td><td style="${tdS}${rr}">${nghin(d.m.tongDt)}</td><td style="${tdS}${rr}">${nghin(d.t.dt)}</td><td style="${tdS}${c}">${bar(pt(d.t.dt, d.m.tongDt))}</td></tr>`).join('')}
  <tr style="${tot}"><td style="${tdS}">Tổng team</td><td style="${tdS}${c}">${tong.mData}</td><td style="${tdS}${c}">${tong.tData}</td><td style="${tdS}${c}">${hienPt(pt(tong.tData, tong.mData))}</td><td style="${tdS}${c}">${tong.mHd}</td><td style="${tdS}${c}">${tong.tHd}</td><td style="${tdS}${c}">${hienPt(pt(tong.tHd, tong.mHd))}</td><td style="${tdS}${rr}">${nghin(tong.mHd ? tong.mDt / tong.mHd : 0)}</td><td style="${tdS}${rr}">${nghin(tong.tHd ? tong.tDt / tong.tHd : 0)}</td><td style="${tdS}${rr}">${nghin(tong.mDt)}</td><td style="${tdS}${rr}">${nghin(tong.tDt)}</td><td style="${tdS}${c}">${hienPt(hoanThanh)}</td></tr></tbody></table></div>
 ${dong.map(chiTiet).join('')}
</div>`
    const host = document.createElement('div')
    host.style.cssText = 'position:fixed;left:-20000px;top:0;'
    host.innerHTML = h
    document.body.appendChild(host)
    return host
  }

  async function xuatPdf() {
    setDangXuat('pdf')
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
      const tongCao = goc.height
      const cat = []
      let bd = 0, dem = 0
      while (bd + cao1Trang < tongCao - 4 && dem++ < 60) {
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
        const pcv = document.createElement('canvas')
        pcv.width = cv.width; pcv.height = h
        const pc2 = pcv.getContext('2d')
        pc2.fillStyle = '#f4f6f9'; pc2.fillRect(0, 0, pcv.width, h)
        pc2.drawImage(cv, 0, y, cv.width, h, 0, 0, cv.width, h)
        if (i > 0) pdf.addPage()
        pdf.setFillColor(244, 246, 249); pdf.rect(0, 0, 210, 297, 'F')
        pdf.addImage(pcv.toDataURL('image/jpeg', 0.95), 'JPEG', leMm, leMm, rongMm, (h * rongMm) / cv.width)
      }
      tai(pdf.output('blob'), `MucTieuNhanSu_${thang}.pdf`)
    } finally {
      if (host) host.remove()
      setDangXuat('')
    }
  }

  const th = 'border border-slate-200 px-3 py-2.5 font-semibold text-center'
  const td = 'border border-slate-200 px-3 py-2 tabular-nums'
  const tgt = 'border border-slate-200 bg-sky-50/60 px-2 py-1.5 text-center'
  const o = (extra = '') => `w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-center text-sm tabular-nums outline-none focus:border-coral-500 ${extra}`
  const nguoiChon = dong.find((r) => r.id === chon)
  const sel = nguoiChon && { f: mt[chon] || {}, m: nguoiChon.m, t: nguoiChon.t, ten: nguoiChon.ten }
  const hoanThanh = pt(tong.tDt, tong.mDt)
  const mauPt = (v) => (v === null ? 'bg-slate-200' : v >= 100 ? 'bg-teal-500' : v >= 70 ? 'bg-amber-400' : 'bg-coral-500')

  return (
    <div className="h-full overflow-y-auto">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-8 py-5">
        <div>
          <h1 className="font-display text-xl font-bold text-navy-900">Mục tiêu nhân sự hàng tháng</h1>
          <p className="text-sm text-ink-600">Mục tiêu data, hợp đồng, doanh thu của từng người so với số thực tế</p>
        </div>
        <div className="flex items-end gap-2">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-navy-900">Tháng</span>
            <input type="month" value={thang} onChange={(e) => e.target.value && setThang(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-coral-500" />
          </label>
          <Button variant="secondary" onClick={xuatExcel} disabled={loading || !!dangXuat}><Download size={16} /> {dangXuat === 'xlsx' ? 'Đang xuất...' : 'Xuất Excel'}</Button>
          <Button variant="secondary" onClick={xuatPdf} disabled={loading || !!dangXuat}><FileDown size={16} /> {dangXuat === 'pdf' ? 'Đang xuất...' : 'Xuất báo cáo (giống màn hình)'}</Button>
          <Button onClick={luu} disabled={!daSua || dangLuu}><Save size={16} /> {dangLuu ? 'Đang lưu...' : 'Lưu mục tiêu'}</Button>
        </div>
      </header>

      <div className="space-y-5 px-8 py-6">
        {thongBao && <p className="rounded-xl bg-sky-50 px-4 py-2.5 text-sm text-navy-900">{thongBao}</p>}

        <div className="grid grid-cols-2 divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-sm sm:grid-cols-4 sm:divide-y-0 sm:divide-x">
          <KpiMt nhan="Doanh thu (chưa VAT)" mt={nghin(tong.mDt)} tt={nghin(tong.tDt)} phan={hoanThanh} mau={mauPt(hoanThanh)} />
          <KpiMt nhan="Số data" mt={tong.mData} tt={tong.tData} phan={pt(tong.tData, tong.mData)} mau={mauPt(pt(tong.tData, tong.mData))} />
          <KpiMt nhan="Số hợp đồng" mt={tong.mHd} tt={tong.tHd} phan={pt(tong.tHd, tong.mHd)} mau={mauPt(pt(tong.tHd, tong.mHd))} />
          <KpiMt nhan="Giá trị TB / HĐ" mt={nghin(tong.mHd ? tong.mDt / tong.mHd : 0)} tt={nghin(tong.tHd ? tong.tDt / tong.tHd : 0)} />
        </div>

        {/* Mục tiêu team và gợi ý chia */}
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-navy-900">Mục tiêu cả team — gợi ý chia cho từng người</h3>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1.5 text-sm"><span className="font-medium text-navy-900">Tổng data cả team</span>
              <input type="number" min="0" className={o('w-40')} value={team.tong_data ?? ''} onChange={(e) => setNum('team', ['tong_data'], e.target.value)} /></label>
            <label className="flex flex-col gap-1.5 text-sm"><span className="font-medium text-navy-900">Doanh thu cả team (chưa VAT)</span>
              <input type="number" min="0" className={o('w-52')} value={team.tong_dt ?? ''} onChange={(e) => setNum('team', ['tong_dt'], e.target.value)} /></label>
            <Select label="Cách chia" value={cheDo} onChange={(e) => setCheDo(e.target.value)} className="w-64">
              <option value="truoc">Theo tỷ lệ doanh số tháng trước</option>
              <option value="deu">Chia đều</option>
            </Select>
            <Button variant="secondary" onClick={chiaTuTeam}><Wand2 size={16} /> Gợi ý chia</Button>
          </div>
          <p className="mt-2 text-xs text-ink-400">
            Tỷ lệ chốt, giá trị TB và cơ cấu nguồn / dịch vụ được lấy theo số thực tế tháng trước. Chị chỉnh tay từng người bên dưới được.
            {team.tong_dt ? ` Đang chia ${nghin(team.tong_dt)} đ — tổng các nhân sự: ${nghin(tong.mDt)} đ.` : ''}
          </p>
        </section>

        {/* Bảng tổng hợp theo nhân sự */}
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-navy-900">Mục tiêu và thực tế theo nhân sự</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] border-collapse text-sm">
              <thead>
                <tr className="bg-sky-100 text-navy-900">
                  <th rowSpan={2} className={`${th} text-left`}>Nhân sự</th>
                  <th colSpan={3} className={th}>Số data</th><th colSpan={3} className={th}>Số hợp đồng</th>
                  <th colSpan={2} className={th}>Giá trị TB / HĐ</th><th colSpan={3} className={th}>Doanh thu (chưa VAT)</th>
                </tr>
                <tr className="bg-sky-100 text-navy-900">
                  {['Mục tiêu', 'Thực tế', '%', 'Mục tiêu', 'Thực tế', '%', 'Mục tiêu', 'Thực tế', 'Mục tiêu', 'Thực tế', '% hoàn thành'].map((x, i) => <th key={i} className={`${th} font-medium`}>{x}</th>)}
                </tr>
              </thead>
              <tbody>
                {dong.map((r) => {
                  const p = pt(r.t.dt, r.m.tongDt)
                  return (
                    <tr key={r.id} onClick={() => setChon(r.id)} className={`cursor-pointer ${chon === r.id ? 'bg-amber-50' : 'hover:bg-slate-50'}`}>
                      <td className={`${td} font-medium text-navy-900`}>{r.ten}</td>
                      <td className={`${td} text-center`}>{r.m.tongData}</td><td className={`${td} text-center`}>{r.t.tongData}</td><td className={`${td} text-center`}>{hienPt(pt(r.t.tongData, r.m.tongData))}</td>
                      <td className={`${td} text-center`}>{r.m.tongHd}</td><td className={`${td} text-center`}>{r.t.hd}</td><td className={`${td} text-center`}>{hienPt(pt(r.t.hd, r.m.tongHd))}</td>
                      <td className={`${td} text-right`}>{nghin(r.m.giaTb)}</td><td className={`${td} text-right`}>{nghin(r.t.hd ? r.t.dt / r.t.hd : 0)}</td>
                      <td className={`${td} text-right`}>{nghin(r.m.tongDt)}</td><td className={`${td} text-right`}>{nghin(r.t.dt)}</td>
                      <td className={`${td} min-w-[130px]`}>
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${mauPt(p)}`} style={{ width: `${Math.min(100, p || 0)}%` }} /></div>
                          <b className="w-11 text-right">{hienPt(p)}</b>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                <tr className="bg-sky-100 font-bold text-indigo-700 [&>td]:py-3">
                  <td className={td}>Tổng team</td>
                  <td className={`${td} text-center`}>{tong.mData}</td><td className={`${td} text-center`}>{tong.tData}</td><td className={`${td} text-center`}>{hienPt(pt(tong.tData, tong.mData))}</td>
                  <td className={`${td} text-center`}>{tong.mHd}</td><td className={`${td} text-center`}>{tong.tHd}</td><td className={`${td} text-center`}>{hienPt(pt(tong.tHd, tong.mHd))}</td>
                  <td className={`${td} text-right`}>{nghin(tong.mHd ? tong.mDt / tong.mHd : 0)}</td><td className={`${td} text-right`}>{nghin(tong.tHd ? tong.tDt / tong.tHd : 0)}</td>
                  <td className={`${td} text-right`}>{nghin(tong.mDt)}</td><td className={`${td} text-right`}>{nghin(tong.tDt)}</td>
                  <td className={`${td} text-center`}>{hienPt(hoanThanh)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-ink-400">Bấm vào một dòng để nhập / sửa mục tiêu của người đó. Thực tế chỉ tính đơn mới đã chốt trong tháng, đã trừ đơn hoàn / huỷ.</p>
        </section>

        {/* Form theo mẫu sheet */}
        {sel && (
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-navy-900">Mục tiêu data mới và doanh thu mới — {sel.ten} · tháng {thang.split('-').reverse().join('/')}</h3>
              <Select value={chon} onChange={(e) => setChon(e.target.value)} className="w-52">
                {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </Select>
            </div>

            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-sky-100 text-navy-900">
                  <th className={`${th} text-left`}>Nguồn data</th><th className={th}>Số data mục tiêu</th><th className={th}>% tỷ trọng</th>
                  <th className={th}>Tỷ lệ chốt mục tiêu %</th><th className={th}>Số HĐ mục tiêu</th>
                  <th className={th}>Data thực tế</th><th className={th}>Job chốt thực tế</th><th className={th}>Tỷ lệ chốt thực tế</th>
                </tr>
              </thead>
              <tbody>
                {nguon.map((g) => (
                  <tr key={g.key}>
                    <td className={td}>{g.ten}</td>
                    <td className={tgt}><input type="number" min="0" className={o()} value={sel.f.data?.[g.key] ?? ''} onChange={(e) => setNum(chon, ['data', g.key], e.target.value)} /></td>
                    <td className={`${td} text-center`}>{hienPt(pt(sel.m.data[g.key], sel.m.tongData))}</td>
                    <td className={tgt}><input type="number" min="0" max="100" className={o()} value={sel.f.chot?.[g.key] ?? ''} onChange={(e) => setNum(chon, ['chot', g.key], e.target.value)} /></td>
                    <td className={`${td} text-center`}>{sel.m.hdNguon[g.key]}</td>
                    <td className={`${td} text-center`}>{sel.t.data[g.key] || 0}</td><td className={`${td} text-center`}>{sel.t.chot[g.key] || 0}</td>
                    <td className={`${td} text-center`}>{hienPt(pt(sel.t.chot[g.key] || 0, sel.t.data[g.key] || 0))}</td>
                  </tr>
                ))}
                <tr className="bg-sky-100 font-bold text-indigo-700">
                  <td className={td}>Tổng</td><td className={`${td} text-center`}>{sel.m.tongData}</td><td className={`${td} text-center`}>{sel.m.tongData ? '100%' : '—'}</td>
                  <td className={`${td} text-center`}>{hienPt(pt(sel.m.tongHdNguon, sel.m.tongData))}</td><td className={`${td} text-center`}>{sel.m.tongHdNguon}</td>
                  <td className={`${td} text-center`}>{sel.t.tongData}</td><td className={`${td} text-center`}>{sel.t.tongChot}</td><td className={`${td} text-center`}>{hienPt(pt(sel.t.tongChot, sel.t.tongData))}</td>
                </tr>
              </tbody>
            </table>

            <table className="mt-5 w-full border-collapse text-sm">
              <thead>
                <tr className="bg-sky-100 text-navy-900">
                  <th className={`${th} text-left`}>Dịch vụ</th><th className={th}>Số HĐ mục tiêu</th><th className={th}>Giá trị TB / HĐ</th><th className={th}>Doanh thu mục tiêu</th>
                  <th className={th}>Số HĐ thực tế</th><th className={th}>Doanh thu thực tế</th><th className={th}>% hoàn thành</th>
                </tr>
              </thead>
              <tbody>
                {DV.map((d) => {
                  const a = sel.m.dv[d.key], b = sel.t.dv[d.key]
                  return (
                    <tr key={d.key}>
                      <td className={td}>{d.ten}</td>
                      <td className={tgt}><input type="number" min="0" className={o()} value={sel.f.dv?.[d.key]?.hd ?? ''} onChange={(e) => setNum(chon, ['dv', d.key, 'hd'], e.target.value)} /></td>
                      <td className={tgt}><input type="number" min="0" className={o('text-right')} value={sel.f.dv?.[d.key]?.gia ?? ''} onChange={(e) => setNum(chon, ['dv', d.key, 'gia'], e.target.value)} /></td>
                      <td className={`${td} text-right`}>{nghin(a.dt)}</td>
                      <td className={`${td} text-center`}>{b.khach.size}</td><td className={`${td} text-right`}>{nghin(b.dt)}</td>
                      <td className={`${td} text-center`}>{hienPt(pt(b.dt, a.dt))}</td>
                    </tr>
                  )
                })}
                <tr className="bg-sky-100 font-bold text-indigo-700">
                  <td className={td}>Tổng</td><td className={`${td} text-center`}>{sel.m.tongHd}</td><td className={`${td} text-right`}>{nghin(sel.m.giaTb)}</td><td className={`${td} text-right`}>{nghin(sel.m.tongDt)}</td>
                  <td className={`${td} text-center`}>{sel.t.hd}</td><td className={`${td} text-right`}>{nghin(sel.t.dt)}</td><td className={`${td} text-center`}>{hienPt(pt(sel.t.dt, sel.m.tongDt))}</td>
                </tr>
              </tbody>
            </table>
            {sel.m.tongHd !== sel.m.tongHdNguon && sel.m.tongHd > 0 && sel.m.tongHdNguon > 0 && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-navy-900">
                Lưu ý: số HĐ tính từ nguồn (data × tỷ lệ chốt) là {sel.m.tongHdNguon}, còn tổng số HĐ theo dịch vụ là {sel.m.tongHd}. Chị xem hai số này có cần khớp nhau không.
              </p>
            )}
            <p className="mt-3 text-xs text-ink-400">Ô nền xanh nhạt là ô chị nhập. Các ô còn lại app tự tính.</p>
          </section>
        )}
      </div>
    </div>
  )
}

function KpiMt({ nhan, mt, tt, phan, mau }) {
  return (
    <div className="px-5 py-4">
      <p className="text-sm text-ink-600">{nhan}</p>
      <p className="mt-1 font-display text-3xl font-bold tabular-nums text-navy-900">{tt}</p>
      <p className="mt-0.5 text-xs text-ink-400">thực tế · mục tiêu {mt}</p>
      {phan !== undefined && (
        <div className="mt-2 flex items-center gap-2">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${mau}`} style={{ width: `${Math.min(100, phan || 0)}%` }} /></div>
          <b className="text-xs text-navy-900">{hienPt(phan)}</b>
        </div>
      )}
    </div>
  )
}
