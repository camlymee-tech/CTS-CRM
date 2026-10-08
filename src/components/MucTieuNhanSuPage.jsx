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

// Cách tính theo file sheet của team:
// Số HĐ = DT ÷ Giá TB; Tỷ lệ chốt BQ = Σ(cơ cấu nguồn × tỷ lệ chốt nguồn); Số data = Số HĐ ÷ Tỷ lệ chốt BQ;
// data từng nguồn = Số data × cơ cấu; HĐ từng nguồn = data nguồn × tỷ lệ chốt nguồn.
function keHoach(t, nguon) {
  const dv = {}
  for (const d of DV) {
    const dt = so(t?.dv?.[d.key]?.dt), gia = so(t?.dv?.[d.key]?.gia)
    const hd = gia > 0 ? dt / gia : 0
    const tongCc = nguon.reduce((a, n) => a + so(t?.cc?.[d.key]?.[n.key]), 0)
    const bq = nguon.reduce((a, n) => a + (so(t?.cc?.[d.key]?.[n.key]) / 100) * (so(t?.chot?.[n.key]) / 100), 0)
    const data = bq > 0 ? hd / bq : 0
    dv[d.key] = { dt, gia, hd, tongCc, bq, data }
  }
  const ng = {}
  for (const n of nguon) {
    const dataDv = Object.fromEntries(DV.map((d) => [d.key, dv[d.key].data * (so(t?.cc?.[d.key]?.[n.key]) / 100)]))
    const data = DV.reduce((a, d) => a + dataDv[d.key], 0)
    const chot = so(t?.chot?.[n.key])
    ng[n.key] = { dataDv, data, chot, hd: (data * chot) / 100 }
  }
  const tongDt = DV.reduce((a, d) => a + dv[d.key].dt, 0)
  const tongHd = DV.reduce((a, d) => a + dv[d.key].hd, 0)
  const tongData = DV.reduce((a, d) => a + dv[d.key].data, 0)
  return { dv, ng, tongDt, tongHd, tongData, giaTb: tongHd ? tongDt / tongHd : 0, bq: tongData ? tongHd / tongData : 0 }
}

export default function MucTieuNhanSuPage({ currentProfile }) {
  const isAdmin = currentProfile?.role === 'admin'
  const { maHoanHuy } = useTrangThai()
  const nguon = NGUON_KHACH_OPTIONS.map((o) => ({ key: o.value, ten: o.label }))
  const [orders, setOrders] = useState([])
  const [items, setItems] = useState([])
  const [customers, setCustomers] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const hn = new Date()
  const [thang, setThang] = useState(`${hn.getFullYear()}-${pad(hn.getMonth() + 1)}`)
  const [team, setTeam] = useState({})
  const [chon, setChon] = useState('')
  const [daSua, setDaSua] = useState(false)
  const [dangLuu, setDangLuu] = useState(false)
  const [thongBao, setThongBao] = useState('')
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
      const { data } = await supabase.from('muc_tieu_nhan_su').select('*').eq('thang', thang).eq('sale_key', 'team')
      const r = (data || []).find((x) => x.sale_key === 'team')
      setTeam(r?.du_lieu || {})
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

  const kh = useMemo(() => keHoach(team, nguon), [team, nguon.length])
  const phanChia = (id) => so(team?.tt?.[id]) / 100
  const tongChia = profiles.reduce((a, p) => a + so(team?.tt?.[p.id]), 0)

  // Mục tiêu của 1 người = mục tiêu team × % chia
  const mucTieu = (id) => {
    const k = phanChia(id)
    return {
      data: kh.tongData * k, hd: kh.tongHd * k, dt: kh.tongDt * k, giaTb: kh.giaTb,
      ng: Object.fromEntries(nguon.map((n) => [n.key, { data: kh.ng[n.key].data * k, hd: kh.ng[n.key].hd * k }])),
      dv: Object.fromEntries(DV.map((d) => [d.key, { hd: kh.dv[d.key].hd * k, dt: kh.dv[d.key].dt * k }])),
    }
  }
  const dong = profiles.map((p) => ({ id: p.id, ten: p.full_name, k: so(team?.tt?.[p.id]), m: mucTieu(p.id), t: tt(p.id) }))
  const thucTeam = dong.reduce((a, r) => ({ data: a.data + r.t.tongData, hd: a.hd + r.t.hd, dt: a.dt + r.t.dt }), { data: 0, hd: 0, dt: 0 })
  const tongNg = (k, f) => dong.reduce((a, r) => a + (r.t[f][k] || 0), 0)
  const tongDvTt = (k, f) => dong.reduce((a, r) => a + (f === 'hd' ? r.t.dv[k].khach.size : r.t.dv[k].dt), 0)

  const sua = (fn) => { setTeam((cu) => { const b = JSON.parse(JSON.stringify(cu || {})); fn(b); return b }); setDaSua(true) }
  const dat = (duongDan, v) => sua((b) => {
    let o = b; duongDan.slice(0, -1).forEach((k) => { o = o[k] ||= {} })
    o[duongDan[duongDan.length - 1]] = v === '' ? '' : Math.max(0, Number(v))
  })

  function chiaTuDong(cach) {
    const n = profiles.length || 1
    const dtTr = profiles.map((p) => truoc[p.id]?.dt || 0)
    const sum = dtTr.reduce((a, b) => a + b, 0)
    const w = profiles.map((_, i) => (cach === 'truoc' && sum > 0 ? dtTr[i] / sum : 1 / n))
    sua((b) => { b.tt = {}; profiles.forEach((p, i) => { b.tt[p.id] = Math.round(w[i] * 1000) / 10 }) })
    setThongBao(cach === 'truoc' && sum > 0 ? 'Đã chia theo tỷ lệ doanh số tháng trước. Chị chỉnh lại từng người nếu cần.' : 'Đã chia đều cho các nhân sự (tháng trước chưa có doanh số để chia theo).')
  }

  async function luu() {
    setDangLuu(true)
    const { error } = await supabase.from('muc_tieu_nhan_su').upsert([{ thang, sale_key: 'team', du_lieu: team, updated_at: new Date().toISOString() }], { onConflict: 'thang,sale_key' })
    setDangLuu(false)
    if (error) { setThongBao('Lưu chưa được: ' + error.message); return }
    setDaSua(false); setThongBao('Đã lưu mục tiêu tháng ' + thang.split('-').reverse().join('/'))
  }

  const tenThang = thang.split('-').reverse().join('/')
  const th = 'border border-slate-200 px-3 py-2.5 font-semibold text-center'
  const td = 'border border-slate-200 px-3 py-2 tabular-nums'
  const vang = 'border border-slate-200 bg-amber-50 px-2 py-1.5 text-center'
  const o = (extra = '') => `w-full rounded-md border border-amber-200 bg-white px-2 py-1 text-center text-sm font-medium tabular-nums text-indigo-700 outline-none focus:border-coral-500 ${extra}`
  const mauPt = (v) => (v === null ? 'bg-slate-200' : v >= 100 ? 'bg-teal-500' : v >= 70 ? 'bg-amber-400' : 'bg-coral-500')
  const so1 = (v) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(v)
  const sel = dong.find((r) => r.id === chon)
  const pHt = pt(thucTeam.dt, kh.tongDt)
  const tienIn = (v) => (v === '' || v === undefined ? '' : v)
  const dongTong = 'bg-sky-100 font-bold text-indigo-700'
  const Bar = ({ v }) => (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${mauPt(v)}`} style={{ width: `${Math.min(100, v || 0)}%` }} /></div>
      <b className="w-11 text-right">{hienPt(v)}</b>
    </div>
  )

  const tai = (blob, ten) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = ten
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }
  const thucNguonTong = (f) => nguon.reduce((a, n) => a + tongNg(n.key, f), 0)

  async function xuatExcel() {
    setDangXuat('xlsx')
    try {
      const { default: ExcelJS } = await import('exceljs')
      const wb = new ExcelJS.Workbook()
      const XANH = 'FFC9DAF8', VANG = 'FFFFF2CC'
      const vien = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
      const tien = '#,##0', pc = '0%', so1f = '#,##0.0'
      const p100 = (a, b) => (b > 0 ? a / b : '')
      const bang = (ws, r0, tieuDe, dongs, fmts, opt = {}) => {
        tieuDe.forEach((t, i) => { const c = ws.getCell(r0, i + 1); c.value = t; c.font = { bold: true }; c.border = vien; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XANH } }; c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true } })
        ws.getRow(r0).height = 36
        dongs.forEach((d, j) => {
          const tong = opt.tong && j === dongs.length - 1
          d.forEach((x, i) => {
            const c = ws.getCell(r0 + 1 + j, i + 1); c.value = x; c.border = vien
            if (fmts[i]) c.numFmt = fmts[i]
            if (i) c.alignment = { horizontal: 'center' }
            if (tong) { c.font = { bold: true }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XANH } } }
            else if (opt.vang && opt.vang(i, j)) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VANG } }
          })
        })
        return r0 + dongs.length + 2
      }
      const ws = wb.addWorksheet('Thông số & kế hoạch')
      ws.columns = [{ width: 32 }, ...Array(10).fill({ width: 17 })]
      ws.mergeCells('A1:K1'); ws.getCell('A1').value = `MỤC TIÊU DATA MỚI VÀ DOANH THU MỚI — THÁNG ${tenThang}`; ws.getCell('A1').font = { bold: true, size: 14 }
      ws.getCell('A2').value = 'Các ô nền vàng là thông số đầu vào, các ô còn lại được tính tự động.'; ws.getCell('A2').font = { italic: true, color: { argb: 'FF555555' } }
      let r = bang(ws, 4, ['THÔNG SỐ ĐẦU VÀO', ...DV.map((d) => d.ten), 'Tổng'], [
        ['DT mục tiêu dịch vụ (chưa VAT)', ...DV.map((d) => kh.dv[d.key].dt), kh.tongDt],
        ['Giá trị TB / HĐ', ...DV.map((d) => kh.dv[d.key].gia), Math.round(kh.giaTb)],
        ['Số HĐ cần đạt', ...DV.map((d) => kh.dv[d.key].hd), kh.tongHd],
      ], [null, tien, tien, tien, tien], { vang: (i, j) => i >= 1 && i <= 3 && j < 2 })
      ws.getCell(r - 2, 2).numFmt = so1f; for (let i = 2; i <= 5; i++) ws.getCell(r - 2, i).numFmt = so1f
      r = bang(ws, r + 1, ['Nguồn data', ...DV.map((d) => `Cơ cấu data ${d.ten}`), 'Tỷ lệ chốt mục tiêu'], [
        ...nguon.map((n) => [n.ten, ...DV.map((d) => so(team?.cc?.[d.key]?.[n.key]) / 100), so(team?.chot?.[n.key]) / 100]),
        ['Kiểm tra tổng cơ cấu', ...DV.map((d) => kh.dv[d.key].tongCc / 100), Math.round(kh.dv.ads.tongCc) === 100 && Math.round(kh.dv.xay_shop.tongCc) === 100 && Math.round(kh.dv.mall.tongCc) === 100 ? 'OK' : 'Cần = 100%'],
        ['Tỷ lệ chốt BQ theo dịch vụ', ...DV.map((d) => kh.dv[d.key].bq), kh.bq],
        ['Số data cần có', ...DV.map((d) => Math.round(kh.dv[d.key].data)), Math.round(kh.tongData)],
      ], [null, pc, pc, pc, pc], { vang: (i, j) => i >= 1 && j < nguon.length })
      const lastR = r - 2
      for (let i = 2; i <= 5; i++) ws.getCell(lastR, i).numFmt = tien
      ws.getCell(lastR - 1, 2).numFmt = '0.0%'; for (let i = 2; i <= 5; i++) ws.getCell(lastR - 1, i).numFmt = '0.0%'
      r = bang(ws, r + 1, ['KẾ HOẠCH — Nguồn data', ...DV.map((d) => `Data ${d.ten}`), 'Tổng data cần có', 'Tỷ lệ chốt mục tiêu', 'Số HĐ cần đạt', 'Data thực tế', 'Job chốt thực tế', 'Tỷ lệ chốt thực tế'], [
        ...nguon.map((n) => [n.ten, ...DV.map((d) => Math.round(kh.ng[n.key].dataDv[d.key])), Math.round(kh.ng[n.key].data), kh.ng[n.key].chot / 100, Math.round(kh.ng[n.key].hd), tongNg(n.key, 'data'), tongNg(n.key, 'chot'), p100(tongNg(n.key, 'chot'), tongNg(n.key, 'data'))]),
        ['Tổng', ...DV.map((d) => Math.round(kh.dv[d.key].data)), Math.round(kh.tongData), kh.bq, Math.round(kh.tongHd), thucTeam.data, thucNguonTong('chot'), p100(thucNguonTong('chot'), thucTeam.data)],
      ], [null, tien, tien, tien, tien, pc, tien, tien, tien, pc], { tong: true })
      r = bang(ws, r + 1, ['Dịch vụ', 'Số HĐ cần đạt', 'Số HĐ thực tế', 'Doanh thu mục tiêu', 'Doanh thu thực tế', '% hoàn thành'], [
        ...DV.map((d) => [d.ten, kh.dv[d.key].hd, tongDvTt(d.key, 'hd'), kh.dv[d.key].dt, tongDvTt(d.key, 'dt'), p100(tongDvTt(d.key, 'dt'), kh.dv[d.key].dt)]),
        ['Tổng', kh.tongHd, thucTeam.hd, kh.tongDt, thucTeam.dt, p100(thucTeam.dt, kh.tongDt)],
      ], [null, so1f, tien, tien, tien, pc], { tong: true })

      const w2 = wb.addWorksheet('Theo nhân sự')
      w2.columns = [{ width: 30 }, ...Array(10).fill({ width: 16 })]
      w2.mergeCells('A1:K1'); w2.getCell('A1').value = `MỤC TIÊU VÀ THỰC TẾ THEO NHÂN SỰ — THÁNG ${tenThang}`; w2.getCell('A1').font = { bold: true, size: 14 }
      let q = bang(w2, 3, ['Nhân sự', '% đảm nhận', 'Data mục tiêu', 'Data thực tế', '% data', 'HĐ mục tiêu', 'HĐ thực tế', '% HĐ', 'Doanh thu mục tiêu', 'Doanh thu thực tế', '% hoàn thành'], [
        ...dong.map((d) => [d.ten, d.k / 100, Math.round(d.m.data), d.t.tongData, p100(d.t.tongData, d.m.data), d.m.hd, d.t.hd, p100(d.t.hd, d.m.hd), d.m.dt, d.t.dt, p100(d.t.dt, d.m.dt)]),
        ['Tổng team', tongChia / 100, Math.round(kh.tongData), thucTeam.data, p100(thucTeam.data, kh.tongData), kh.tongHd, thucTeam.hd, p100(thucTeam.hd, kh.tongHd), kh.tongDt, thucTeam.dt, p100(thucTeam.dt, kh.tongDt)],
      ], [null, '0.0%', tien, tien, pc, so1f, tien, pc, tien, tien, pc], { tong: true, vang: (i, j) => i === 1 })
      for (const d of dong) {
        w2.getCell(q, 1).value = `Chi tiết — ${d.ten}`; w2.getCell(q, 1).font = { bold: true }
        q = bang(w2, q + 1, ['Nguồn data', 'Data mục tiêu', 'Data thực tế', 'HĐ mục tiêu', 'Job chốt thực tế', 'Tỷ lệ chốt mục tiêu', 'Tỷ lệ chốt thực tế'], [
          ...nguon.map((n) => [n.ten, Math.round(d.m.ng[n.key].data), d.t.data[n.key] || 0, d.m.ng[n.key].hd, d.t.chot[n.key] || 0, kh.ng[n.key].chot / 100, p100(d.t.chot[n.key] || 0, d.t.data[n.key] || 0)]),
          ['Tổng', Math.round(d.m.data), d.t.tongData, d.m.hd, d.t.tongChot, kh.bq, p100(d.t.tongChot, d.t.tongData)],
        ], [null, tien, tien, so1f, tien, pc, pc], { tong: true })
        q = bang(w2, q, ['Dịch vụ', 'HĐ mục tiêu', 'HĐ thực tế', 'Doanh thu mục tiêu', 'Doanh thu thực tế', '% hoàn thành'], [
          ...DV.map((v) => [v.ten, d.m.dv[v.key].hd, d.t.dv[v.key].khach.size, d.m.dv[v.key].dt, d.t.dv[v.key].dt, p100(d.t.dv[v.key].dt, d.m.dv[v.key].dt)]),
          ['Tổng', d.m.hd, d.t.hd, d.m.dt, d.t.dt, p100(d.t.dt, d.m.dt)],
        ], [null, so1f, tien, tien, tien, pc], { tong: true })
        q += 1
      }
      const buf = await wb.xlsx.writeBuffer()
      tai(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `MucTieuNhanSu_${thang}.xlsx`)
    } finally { setDangXuat('') }
  }

  // Bản in dựng bằng style trực tiếp để PDF luôn đủ màu, giống màn hình
  function dungBanIn() {
    const C = { navy: '#0f1f3d', ink: '#475569', mute: '#94a3b8', line: '#e2e8f0', xanh: '#e0f2fe', chu: '#4338ca', coral: '#f0624d', teal: '#14b8a6', vang: '#fbbf24', vangNen: '#fffbeb' }
    const card = 'background:#fff;border-radius:16px;padding:20px;box-shadow:0 1px 3px rgba(0,0,0,.08);margin-bottom:16px;'
    const tdS = `border:1px solid ${C.line};padding:9px 10px;font-size:12px;`
    const thS = `border:1px solid ${C.line};padding:10px;font-size:12px;font-weight:700;background:${C.xanh};color:${C.navy};text-align:center;`
    const tot = `background:${C.xanh};font-weight:700;color:${C.chu};`
    const c = 'text-align:center;', rr = 'text-align:right;'
    const mau = (v) => (v === null ? '#e2e8f0' : v >= 100 ? C.teal : v >= 70 ? C.vang : C.coral)
    const bar = (v) => `<span style="display:inline-block;width:70px;height:8px;border-radius:8px;background:#f1f5f9;vertical-align:middle;position:relative"><span style="position:absolute;left:0;top:0;height:8px;border-radius:8px;width:${Math.round(Math.min(100, v || 0) * 0.7)}px;background:${mau(v)}"></span></span> <b>${hienPt(v)}</b>`
    const kpi = (n, m, t, v) => `<div style="flex:1;padding:16px 20px;border-left:1px solid ${C.line}"><div style="font-size:13px;color:${C.ink}">${n}</div><div style="font-size:26px;font-weight:700;margin-top:4px">${t}</div><div style="font-size:11px;color:${C.mute}">thực tế · mục tiêu ${m}</div>${v === undefined ? '' : `<div style="margin-top:8px">${bar(v)}</div>`}</div>`
    const H = (arr, left) => `<tr>${arr.map((x, i) => `<th style="${thS}${i === 0 && left ? 'text-align:left' : ''}">${x}</th>`).join('')}</tr>`
    const R = (arr, st = '', tongDong = false) => `<tr style="${tongDong ? tot : ''}">${arr.map((x, i) => `<td style="${tdS}${i ? (typeof x === 'string' && x.includes('<span') ? c : c) : 'font-weight:600'}${st}">${x}</td>`).join('')}</tr>`
    const money = (arr, idx) => arr.map((x, i) => (idx.includes(i) ? `<span style="display:block;text-align:right">${x}</span>` : x))
    const Bang = (tieuDe, dongs, tongDong, idxTien = []) => `<table style="width:100%;border-collapse:collapse"><thead>${H(tieuDe, true)}</thead><tbody>${dongs.map((d, j) => R(money(d, idxTien), '', tongDong && j === dongs.length - 1)).join('')}</tbody></table>`
    const tieuDe = (i, t) => `<div style="font-size:14px;font-weight:700;margin-bottom:10px"><span style="color:${C.coral}">Bước ${i}.</span> ${t}</div>`
    const o1 = (v) => so1(v)
    const chiTiet = (d) => `<div data-blk style="${card}"><div style="font-size:14px;font-weight:700;margin-bottom:10px">Chi tiết — ${d.ten}</div>
      ${Bang(['Nguồn data', 'Data mục tiêu', 'Data thực tế', 'HĐ mục tiêu', 'Job chốt thực tế', 'Tỷ lệ chốt mục tiêu', 'Tỷ lệ chốt thực tế'],
        [...nguon.map((n) => [n.ten, nghin(d.m.ng[n.key].data), d.t.data[n.key] || 0, o1(d.m.ng[n.key].hd), d.t.chot[n.key] || 0, kh.ng[n.key].chot + '%', hienPt(pt(d.t.chot[n.key] || 0, d.t.data[n.key] || 0))]),
          ['Tổng', nghin(d.m.data), d.t.tongData, o1(d.m.hd), d.t.tongChot, o1(kh.bq * 100) + '%', hienPt(pt(d.t.tongChot, d.t.tongData))]], true)}
      <div style="height:14px"></div>
      ${Bang(['Dịch vụ', 'HĐ mục tiêu', 'HĐ thực tế', 'Doanh thu mục tiêu', 'Doanh thu thực tế', '% hoàn thành'],
        [...DV.map((v) => [v.ten, o1(d.m.dv[v.key].hd), d.t.dv[v.key].khach.size, nghin(d.m.dv[v.key].dt), nghin(d.t.dv[v.key].dt), bar(pt(d.t.dv[v.key].dt, d.m.dv[v.key].dt))]),
          ['Tổng', o1(d.m.hd), d.t.hd, nghin(d.m.dt), nghin(d.t.dt), hienPt(pt(d.t.dt, d.m.dt))]], true, [3, 4])}</div>`
    const vangIn = (v) => `<span style="display:block;background:${C.vangNen};color:${C.chu};font-weight:600;border-radius:4px;padding:2px 0">${v}</span>`
    const h = `
<div style="width:1100px;padding:24px;background:#f4f6f9;color:${C.navy};font-family:Arial,Helvetica,sans-serif;box-sizing:border-box;">
 <div data-blk style="padding:0 4px 16px"><div style="font-size:22px;font-weight:700">MỤC TIÊU DATA MỚI VÀ DOANH THU MỚI — THÁNG ${tenThang}</div><div style="font-size:13px;color:${C.ink};margin-top:4px">Thông số đầu vào → kế hoạch của team → mục tiêu từng nhân sự so với thực tế</div></div>
 <div data-blk style="display:flex;${card}padding:0;overflow:hidden">
  ${kpi('Doanh thu (chưa VAT)', nghin(kh.tongDt), nghin(thucTeam.dt), pHt).replace(`border-left:1px solid ${C.line}`, '')}
  ${kpi('Số data', nghin(kh.tongData), thucTeam.data, pt(thucTeam.data, kh.tongData))}
  ${kpi('Số hợp đồng', so1(kh.tongHd), thucTeam.hd, pt(thucTeam.hd, kh.tongHd))}
  ${kpi('Giá trị TB / HĐ', nghin(kh.giaTb), nghin(thucTeam.hd ? thucTeam.dt / thucTeam.hd : 0))}
 </div>
 <div data-blk style="${card}">${tieuDe(1, 'Thông số đầu vào của team')}
  ${Bang(['', ...DV.map((d) => d.ten), 'Tổng'], [
    ['DT mục tiêu dịch vụ (chưa VAT)', ...DV.map((d) => vangIn(nghin(kh.dv[d.key].dt))), nghin(kh.tongDt)],
    ['Giá trị TB / HĐ', ...DV.map((d) => vangIn(nghin(kh.dv[d.key].gia))), nghin(kh.giaTb)],
    ['Số HĐ cần đạt', ...DV.map((d) => o1(kh.dv[d.key].hd)), o1(kh.tongHd)]], false)}
  <div style="height:14px"></div>
  ${Bang(['Nguồn data', ...DV.map((d) => `Cơ cấu data ${d.ten}`), 'Tỷ lệ chốt mục tiêu'], [
    ...nguon.map((n) => [n.ten, ...DV.map((d) => vangIn(so(team?.cc?.[d.key]?.[n.key]) + '%')), vangIn(so(team?.chot?.[n.key]) + '%')]),
    ['Kiểm tra tổng cơ cấu', ...DV.map((d) => o1(kh.dv[d.key].tongCc) + '%'), Math.round(kh.dv.ads.tongCc) === 100 && Math.round(kh.dv.xay_shop.tongCc) === 100 && Math.round(kh.dv.mall.tongCc) === 100 ? 'OK' : 'Cần = 100%'],
    ['Tỷ lệ chốt BQ theo dịch vụ', ...DV.map((d) => o1(kh.dv[d.key].bq * 100) + '%'), o1(kh.bq * 100) + '%'],
    ['Số data cần có', ...DV.map((d) => nghin(kh.dv[d.key].data)), nghin(kh.tongData)]], false)}</div>
 <div data-blk style="${card}">${tieuDe(2, 'Kế hoạch của team — data và hợp đồng cần có theo từng nguồn')}
  ${Bang(['Nguồn data', ...DV.map((d) => `Data ${d.ten}`), 'Tổng data cần có', 'Tỷ lệ chốt mục tiêu', 'Số HĐ cần đạt', 'Data thực tế', 'Job chốt thực tế', 'Tỷ lệ chốt thực tế'], [
    ...nguon.map((n) => [n.ten, ...DV.map((d) => nghin(kh.ng[n.key].dataDv[d.key])), nghin(kh.ng[n.key].data), kh.ng[n.key].chot + '%', nghin(kh.ng[n.key].hd), tongNg(n.key, 'data'), tongNg(n.key, 'chot'), hienPt(pt(tongNg(n.key, 'chot'), tongNg(n.key, 'data')))]),
    ['Tổng', ...DV.map((d) => nghin(kh.dv[d.key].data)), nghin(kh.tongData), o1(kh.bq * 100) + '%', nghin(kh.tongHd), thucTeam.data, thucNguonTong('chot'), hienPt(pt(thucNguonTong('chot'), thucTeam.data))]], true)}
  <div style="height:14px"></div>
  ${Bang(['Dịch vụ', 'Số HĐ cần đạt', 'Số HĐ thực tế', 'Doanh thu mục tiêu', 'Doanh thu thực tế', '% hoàn thành'], [
    ...DV.map((d) => [d.ten, o1(kh.dv[d.key].hd), tongDvTt(d.key, 'hd'), nghin(kh.dv[d.key].dt), nghin(tongDvTt(d.key, 'dt')), bar(pt(tongDvTt(d.key, 'dt'), kh.dv[d.key].dt))]),
    ['Tổng', o1(kh.tongHd), thucTeam.hd, nghin(kh.tongDt), nghin(thucTeam.dt), hienPt(pHt)]], true, [3, 4])}
  <div style="margin-top:10px;font-size:11px;color:${C.mute}">Số tính chính xác (có số lẻ), hiển thị làm tròn nên cộng tay từng ô có thể lệch ±1 so với dòng Tổng.</div></div>
 <div data-blk style="${card}">${tieuDe(3, 'Mục tiêu và thực tế theo nhân sự')}
  ${Bang(['Nhân sự', '% đảm nhận', 'Data mục tiêu', 'Data thực tế', 'HĐ mục tiêu', 'HĐ thực tế', 'Doanh thu mục tiêu', 'Doanh thu thực tế', '% hoàn thành'], [
    ...dong.map((d) => [d.ten, d.k + '%', nghin(d.m.data), d.t.tongData, o1(d.m.hd), d.t.hd, nghin(d.m.dt), nghin(d.t.dt), bar(pt(d.t.dt, d.m.dt))]),
    ['Tổng team', o1(tongChia) + '%', nghin(kh.tongData), thucTeam.data, o1(kh.tongHd), thucTeam.hd, nghin(kh.tongDt), nghin(thucTeam.dt), hienPt(pHt)]], true, [6, 7])}</div>
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
        const y = moc[i], hh = moc[i + 1] - moc[i]
        if (hh < 3) continue
        const pcv = document.createElement('canvas')
        pcv.width = cv.width; pcv.height = hh
        const pc2 = pcv.getContext('2d')
        pc2.fillStyle = '#f4f6f9'; pc2.fillRect(0, 0, pcv.width, hh)
        pc2.drawImage(cv, 0, y, cv.width, hh, 0, 0, cv.width, hh)
        if (i > 0) pdf.addPage()
        pdf.setFillColor(244, 246, 249); pdf.rect(0, 0, 210, 297, 'F')
        pdf.addImage(pcv.toDataURL('image/jpeg', 0.95), 'JPEG', leMm, leMm, rongMm, (hh * rongMm) / cv.width)
      }
      tai(pdf.output('blob'), `MucTieuNhanSu_${thang}.pdf`)
    } finally {
      if (host) host.remove()
      setDangXuat('')
    }
  }

  // ===== Màn hình của nhân viên: chỉ xem mục tiêu và kết quả của chính mình =====
  if (!isAdmin) {
    const r = dong.find((x) => x.id === currentProfile?.id)
    const [yy, mm] = thang.split('-').map(Number)
    const cuoi = new Date(yy, mm, 0).getDate()
    const homNay = new Date()
    const conLai = homNay.getFullYear() === yy && homNay.getMonth() + 1 === mm ? Math.max(0, cuoi - homNay.getDate() + 1) : 0
    const m = r?.m, t = r?.t
    const thieuDt = m ? Math.max(0, m.dt - t.dt) : 0
    const thieuHd = m ? Math.max(0, Math.ceil(m.hd - t.hd - 1e-9)) : 0
    const thieuData = m ? Math.max(0, Math.ceil(m.data - t.tongData - 1e-9)) : 0
    const pDt = m ? pt(t.dt, m.dt) : null
    return (
      <div className="h-full overflow-y-auto">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-8 py-5">
          <div>
            <h1 className="font-display text-xl font-bold text-navy-900">Mục tiêu của tôi</h1>
            <p className="text-sm text-ink-600">{currentProfile?.full_name || r?.ten} · tháng {tenThang}</p>
          </div>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-navy-900">Tháng</span>
            <input type="month" value={thang} onChange={(e) => e.target.value && setThang(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-coral-500" />
          </label>
        </header>
        <div className="space-y-5 px-8 py-6">
          {!m || !m.dt ? (
            <p className="rounded-2xl bg-white p-6 text-sm text-ink-600 shadow-sm">Trưởng nhóm chưa giao mục tiêu cho bạn trong tháng {tenThang}.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-sm sm:grid-cols-4 sm:divide-y-0 sm:divide-x">
                <KpiMt nhan="Doanh thu (chưa VAT)" mt={nghin(m.dt)} tt={nghin(t.dt)} phan={pDt} mau={mauPt(pDt)} />
                <KpiMt nhan="Số data" mt={nghin(m.data)} tt={t.tongData} phan={pt(t.tongData, m.data)} mau={mauPt(pt(t.tongData, m.data))} />
                <KpiMt nhan="Số hợp đồng" mt={so1(m.hd)} tt={t.hd} phan={pt(t.hd, m.hd)} mau={mauPt(pt(t.hd, m.hd))} />
                <KpiMt nhan="Giá trị TB / HĐ" mt={nghin(m.giaTb)} tt={nghin(t.hd ? t.dt / t.hd : 0)} />
              </div>

              <section className="rounded-2xl bg-white p-5 shadow-sm">
                <h3 className="mb-3 text-sm font-semibold text-navy-900">Còn thiếu bao nhiêu để đạt mục tiêu</h3>
                <table className="w-full border-collapse text-sm">
                  <thead><tr className="bg-sky-100 text-navy-900"><th className={`${th} text-left`}>Chỉ tiêu</th><th className={th}>Mục tiêu</th><th className={th}>Đã đạt</th><th className={th}>Còn thiếu</th>{conLai > 0 && <th className={th}>Cần mỗi ngày ({conLai} ngày còn lại)</th>}</tr></thead>
                  <tbody>
                    <tr><td className={`${td} font-semibold`}>Doanh thu (chưa VAT)</td><td className={`${td} text-right`}>{nghin(m.dt)}</td><td className={`${td} text-right`}>{nghin(t.dt)}</td><td className={`${td} text-right font-semibold text-coral-500`}>{nghin(thieuDt)}</td>{conLai > 0 && <td className={`${td} text-right`}>{nghin(thieuDt / conLai)}</td>}</tr>
                    <tr><td className={`${td} font-semibold`}>Số hợp đồng</td><td className={`${td} text-center`}>{so1(m.hd)}</td><td className={`${td} text-center`}>{t.hd}</td><td className={`${td} text-center font-semibold text-coral-500`}>{thieuHd}</td>{conLai > 0 && <td className={`${td} text-center`}>{so1(thieuHd / conLai)}</td>}</tr>
                    <tr><td className={`${td} font-semibold`}>Số data</td><td className={`${td} text-center`}>{nghin(m.data)}</td><td className={`${td} text-center`}>{t.tongData}</td><td className={`${td} text-center font-semibold text-coral-500`}>{thieuData}</td>{conLai > 0 && <td className={`${td} text-center`}>{so1(thieuData / conLai)}</td>}</tr>
                  </tbody>
                </table>
              </section>

              <section className="rounded-2xl bg-white p-5 shadow-sm">
                <h3 className="mb-3 text-sm font-semibold text-navy-900">Theo nguồn data</h3>
                <table className="w-full border-collapse text-sm">
                  <thead><tr className="bg-sky-100 text-navy-900"><th className={`${th} text-left`}>Nguồn data</th><th className={th}>Data mục tiêu</th><th className={th}>Data thực tế</th><th className={th}>HĐ mục tiêu</th><th className={th}>Job chốt thực tế</th><th className={th}>Tỷ lệ chốt mục tiêu</th><th className={th}>Tỷ lệ chốt thực tế</th></tr></thead>
                  <tbody>
                    {nguon.map((n) => <tr key={n.key}><td className={`${td} font-semibold`}>{n.ten}</td><td className={`${td} text-center`}>{nghin(m.ng[n.key].data)}</td><td className={`${td} text-center`}>{t.data[n.key] || 0}</td><td className={`${td} text-center`}>{so1(m.ng[n.key].hd)}</td><td className={`${td} text-center`}>{t.chot[n.key] || 0}</td><td className={`${td} text-center`}>{kh.ng[n.key].chot}%</td><td className={`${td} text-center`}>{hienPt(pt(t.chot[n.key] || 0, t.data[n.key] || 0))}</td></tr>)}
                    <tr className={dongTong}><td className={td}>Tổng</td><td className={`${td} text-center`}>{nghin(m.data)}</td><td className={`${td} text-center`}>{t.tongData}</td><td className={`${td} text-center`}>{so1(m.hd)}</td><td className={`${td} text-center`}>{t.tongChot}</td><td className={`${td} text-center`}>{so1(kh.bq * 100)}%</td><td className={`${td} text-center`}>{hienPt(pt(t.tongChot, t.tongData))}</td></tr>
                  </tbody>
                </table>
              </section>

              <section className="rounded-2xl bg-white p-5 shadow-sm">
                <h3 className="mb-3 text-sm font-semibold text-navy-900">Theo dịch vụ</h3>
                <table className="w-full border-collapse text-sm">
                  <thead><tr className="bg-sky-100 text-navy-900"><th className={`${th} text-left`}>Dịch vụ</th><th className={th}>HĐ mục tiêu</th><th className={th}>HĐ thực tế</th><th className={th}>Doanh thu mục tiêu</th><th className={th}>Doanh thu thực tế</th><th className={th}>% hoàn thành</th></tr></thead>
                  <tbody>
                    {DV.map((d) => <tr key={d.key}><td className={`${td} font-semibold`}>{d.ten}</td><td className={`${td} text-center`}>{so1(m.dv[d.key].hd)}</td><td className={`${td} text-center`}>{t.dv[d.key].khach.size}</td><td className={`${td} text-right`}>{nghin(m.dv[d.key].dt)}</td><td className={`${td} text-right`}>{nghin(t.dv[d.key].dt)}</td><td className={td}><Bar v={pt(t.dv[d.key].dt, m.dv[d.key].dt)} /></td></tr>)}
                    <tr className={dongTong}><td className={td}>Tổng</td><td className={`${td} text-center`}>{so1(m.hd)}</td><td className={`${td} text-center`}>{t.hd}</td><td className={`${td} text-right`}>{nghin(m.dt)}</td><td className={`${td} text-right`}>{nghin(t.dt)}</td><td className={`${td} text-center`}>{hienPt(pDt)}</td></tr>
                  </tbody>
                </table>
                <p className="mt-3 text-xs text-ink-400">Thực tế chỉ tính đơn mới đã chốt trong tháng, đã trừ đơn hoàn / huỷ.</p>
              </section>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-8 py-5">
        <div>
          <h1 className="font-display text-xl font-bold text-navy-900">Mục tiêu nhân sự hàng tháng</h1>
          <p className="text-sm text-ink-600">Điền thông số đầu vào của team → app tự tính data, hợp đồng cần đạt → chia cho từng người</p>
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
          <KpiMt nhan="Doanh thu (chưa VAT)" mt={nghin(kh.tongDt)} tt={nghin(thucTeam.dt)} phan={pHt} mau={mauPt(pHt)} />
          <KpiMt nhan="Số data" mt={nghin(kh.tongData)} tt={thucTeam.data} phan={pt(thucTeam.data, kh.tongData)} mau={mauPt(pt(thucTeam.data, kh.tongData))} />
          <KpiMt nhan="Số hợp đồng" mt={so1(kh.tongHd)} tt={thucTeam.hd} phan={pt(thucTeam.hd, kh.tongHd)} mau={mauPt(pt(thucTeam.hd, kh.tongHd))} />
          <KpiMt nhan="Giá trị TB / HĐ" mt={nghin(kh.giaTb)} tt={nghin(thucTeam.hd ? thucTeam.dt / thucTeam.hd : 0)} />
        </div>

        {/* BƯỚC 1 */}
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-1 flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-coral-500 text-xs font-bold text-white">1</span>
            <h3 className="text-sm font-semibold text-navy-900">Thông số đầu vào của team — chỉ điền các ô vàng</h3></div>
          <p className="mb-3 text-xs text-ink-400">Chị điền doanh thu cần đạt và giá trị TB mỗi dịch vụ, rồi cơ cấu data theo nguồn và tỷ lệ chốt mục tiêu. Các ô trắng app tự tính.</p>

          <table className="w-full border-collapse text-sm">
            <thead><tr className="bg-sky-100 text-navy-900"><th className={`${th} text-left`}></th>{DV.map((d) => <th key={d.key} className={th}>{d.ten}</th>)}<th className={th}>Tổng</th></tr></thead>
            <tbody>
              <tr><td className={`${td} font-semibold`}>DT mục tiêu dịch vụ (chưa VAT)</td>
                {DV.map((d) => <td key={d.key} className={vang}><input type="text" inputMode="numeric" className={o()} value={team?.dv?.[d.key]?.dt === undefined || team?.dv?.[d.key]?.dt === '' ? '' : nghin(team.dv[d.key].dt)} onChange={(e) => dat(['dv', d.key, 'dt'], e.target.value.replace(/\D/g, ''))} /></td>)}
                <td className={`${td} text-center font-bold`}>{nghin(kh.tongDt)}</td></tr>
              <tr><td className={`${td} font-semibold`}>Giá trị TB / HĐ</td>
                {DV.map((d) => <td key={d.key} className={vang}><input type="text" inputMode="numeric" className={o()} value={team?.dv?.[d.key]?.gia === undefined || team?.dv?.[d.key]?.gia === '' ? '' : nghin(team.dv[d.key].gia)} onChange={(e) => dat(['dv', d.key, 'gia'], e.target.value.replace(/\D/g, ''))} /></td>)}
                <td className={`${td} text-center`}>{nghin(kh.giaTb)}</td></tr>
              <tr><td className={`${td} font-semibold`}>Số HĐ cần đạt</td>
                {DV.map((d) => <td key={d.key} className={`${td} text-center`}>{so1(kh.dv[d.key].hd)}</td>)}
                <td className={`${td} text-center font-bold`}>{so1(kh.tongHd)}</td></tr>
            </tbody>
          </table>

          <table className="mt-5 w-full border-collapse text-sm">
            <thead><tr className="bg-sky-100 text-navy-900"><th className={`${th} text-left`}>Nguồn data</th>
              {DV.map((d) => <th key={d.key} className={th}>Cơ cấu data {d.ten}</th>)}<th className={th}>Tỷ lệ chốt mục tiêu</th></tr></thead>
            <tbody>
              {nguon.map((n) => (
                <tr key={n.key}><td className={`${td} font-semibold`}>{n.ten}</td>
                  {DV.map((d) => <td key={d.key} className={vang}><div className="flex items-center justify-center gap-1"><input type="number" min="0" max="100" className={o('w-20')} value={tienIn(team?.cc?.[d.key]?.[n.key])} onChange={(e) => dat(['cc', d.key, n.key], e.target.value)} />%</div></td>)}
                  <td className={vang}><div className="flex items-center justify-center gap-1"><input type="number" min="0" max="100" className={o('w-20')} value={tienIn(team?.chot?.[n.key])} onChange={(e) => dat(['chot', n.key], e.target.value)} />%</div></td></tr>
              ))}
              <tr><td className={`${td} font-semibold`}>Kiểm tra tổng cơ cấu</td>
                {DV.map((d) => { const ok = Math.round(kh.dv[d.key].tongCc) === 100; return <td key={d.key} className={`${td} text-center font-semibold ${ok ? 'text-teal-600' : 'text-coral-500'}`}>{so1(kh.dv[d.key].tongCc)}% {ok ? '· OK' : '· cần = 100%'}</td> })}
                <td className={td}></td></tr>
              <tr><td className={`${td} font-semibold`}>Tỷ lệ chốt BQ theo dịch vụ</td>
                {DV.map((d) => <td key={d.key} className={`${td} text-center`}>{so1(kh.dv[d.key].bq * 100)}%</td>)}
                <td className={`${td} text-center font-bold`}>{so1(kh.bq * 100)}%</td></tr>
              <tr><td className={`${td} font-semibold`}>Số data cần có</td>
                {DV.map((d) => <td key={d.key} className={`${td} text-center`}>{nghin(kh.dv[d.key].data)}</td>)}
                <td className={`${td} text-center font-bold`}>{nghin(kh.tongData)}</td></tr>
            </tbody>
          </table>
        </section>

        {/* BƯỚC 2 */}
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-coral-500 text-xs font-bold text-white">2</span>
            <h3 className="text-sm font-semibold text-navy-900">Kế hoạch của team — số data và hợp đồng cần có theo từng nguồn</h3></div>
          <table className="w-full border-collapse text-sm">
            <thead><tr className="bg-sky-100 text-navy-900"><th className={`${th} text-left`}>Nguồn data</th>
              {DV.map((d) => <th key={d.key} className={th}>Data {d.ten}</th>)}
              <th className={th}>Tổng data cần có</th><th className={th}>Tỷ lệ chốt mục tiêu</th><th className={th}>Số HĐ cần đạt</th>
              <th className={th}>Data thực tế</th><th className={th}>Job chốt thực tế</th><th className={th}>Tỷ lệ chốt thực tế</th></tr></thead>
            <tbody>
              {nguon.map((n) => (
                <tr key={n.key}><td className={`${td} font-semibold`}>{n.ten}</td>
                  {DV.map((d) => <td key={d.key} className={`${td} text-center`}>{nghin(kh.ng[n.key].dataDv[d.key])}</td>)}
                  <td className={`${td} text-center`}>{nghin(kh.ng[n.key].data)}</td><td className={`${td} text-center`}>{kh.ng[n.key].chot}%</td><td className={`${td} text-center`}>{nghin(kh.ng[n.key].hd)}</td>
                  <td className={`${td} text-center`}>{tongNg(n.key, 'data')}</td><td className={`${td} text-center`}>{tongNg(n.key, 'chot')}</td><td className={`${td} text-center`}>{hienPt(pt(tongNg(n.key, 'chot'), tongNg(n.key, 'data')))}</td></tr>
              ))}
              <tr className={dongTong}><td className={td}>Tổng</td>
                {DV.map((d) => <td key={d.key} className={`${td} text-center`}>{nghin(kh.dv[d.key].data)}</td>)}
                <td className={`${td} text-center`}>{nghin(kh.tongData)}</td><td className={`${td} text-center`}>{so1(kh.bq * 100)}%</td><td className={`${td} text-center`}>{nghin(kh.tongHd)}</td>
                <td className={`${td} text-center`}>{thucTeam.data}</td><td className={`${td} text-center`}>{nguon.reduce((a, n) => a + tongNg(n.key, 'chot'), 0)}</td><td className={`${td} text-center`}>{hienPt(pt(nguon.reduce((a, n) => a + tongNg(n.key, 'chot'), 0), thucTeam.data))}</td></tr>
            </tbody>
          </table>
          <table className="mt-5 w-full border-collapse text-sm">
            <thead><tr className="bg-sky-100 text-navy-900"><th className={`${th} text-left`}>Dịch vụ</th><th className={th}>Số HĐ cần đạt</th><th className={th}>Số HĐ thực tế</th><th className={th}>Doanh thu mục tiêu</th><th className={th}>Doanh thu thực tế</th><th className={th}>% hoàn thành</th></tr></thead>
            <tbody>
              {DV.map((d) => <tr key={d.key}><td className={`${td} font-semibold`}>{d.ten}</td><td className={`${td} text-center`}>{so1(kh.dv[d.key].hd)}</td><td className={`${td} text-center`}>{tongDvTt(d.key, 'hd')}</td><td className={`${td} text-right`}>{nghin(kh.dv[d.key].dt)}</td><td className={`${td} text-right`}>{nghin(tongDvTt(d.key, 'dt'))}</td><td className={td}><Bar v={pt(tongDvTt(d.key, 'dt'), kh.dv[d.key].dt)} /></td></tr>)}
              <tr className={dongTong}><td className={td}>Tổng</td><td className={`${td} text-center`}>{so1(kh.tongHd)}</td><td className={`${td} text-center`}>{thucTeam.hd}</td><td className={`${td} text-right`}>{nghin(kh.tongDt)}</td><td className={`${td} text-right`}>{nghin(thucTeam.dt)}</td><td className={`${td} text-center`}>{hienPt(pHt)}</td></tr>
            </tbody>
          </table>
          <p className="mt-3 text-xs text-ink-400">Số tính chính xác (có số lẻ) nhưng hiển thị làm tròn, nên cộng tay từng ô có thể lệch ±1 so với dòng Tổng. Thực tế chỉ tính đơn mới đã chốt trong tháng, đã trừ đơn hoàn / huỷ.</p>
        </section>

        {/* BƯỚC 3 */}
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-coral-500 text-xs font-bold text-white">3</span>
              <h3 className="text-sm font-semibold text-navy-900">Chia mục tiêu cho từng nhân sự — điền % mỗi người đảm nhận</h3></div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => chiaTuDong('deu')}><Wand2 size={16} /> Chia đều</Button>
              <Button variant="secondary" onClick={() => chiaTuDong('truoc')}><Wand2 size={16} /> Chia theo doanh số tháng trước</Button>
            </div>
          </div>
          <table className="w-full min-w-[1000px] border-collapse text-sm">
            <thead>
              <tr className="bg-sky-100 text-navy-900">
                <th rowSpan={2} className={`${th} text-left`}>Nhân sự</th><th rowSpan={2} className={th}>% đảm nhận</th>
                <th colSpan={3} className={th}>Số data</th><th colSpan={3} className={th}>Số hợp đồng</th><th colSpan={3} className={th}>Doanh thu (chưa VAT)</th>
              </tr>
              <tr className="bg-sky-100 text-navy-900">{['Mục tiêu', 'Thực tế', '%', 'Mục tiêu', 'Thực tế', '%', 'Mục tiêu', 'Thực tế', '% hoàn thành'].map((x, i) => <th key={i} className={`${th} font-medium`}>{x}</th>)}</tr>
            </thead>
            <tbody>
              {dong.map((r) => (
                <tr key={r.id} onClick={() => setChon(r.id)} className={`cursor-pointer ${chon === r.id ? 'bg-amber-50/60' : 'hover:bg-slate-50'}`}>
                  <td className={`${td} font-medium text-navy-900`}>{r.ten}</td>
                  <td className={vang}><div className="flex items-center justify-center gap-1"><input type="number" min="0" max="100" className={o('w-20')} value={tienIn(team?.tt?.[r.id])} onClick={(e) => e.stopPropagation()} onChange={(e) => dat(['tt', r.id], e.target.value)} />%</div></td>
                  <td className={`${td} text-center`}>{nghin(r.m.data)}</td><td className={`${td} text-center`}>{r.t.tongData}</td><td className={`${td} text-center`}>{hienPt(pt(r.t.tongData, r.m.data))}</td>
                  <td className={`${td} text-center`}>{so1(r.m.hd)}</td><td className={`${td} text-center`}>{r.t.hd}</td><td className={`${td} text-center`}>{hienPt(pt(r.t.hd, r.m.hd))}</td>
                  <td className={`${td} text-right`}>{nghin(r.m.dt)}</td><td className={`${td} text-right`}>{nghin(r.t.dt)}</td>
                  <td className={`${td} min-w-[140px]`}><Bar v={pt(r.t.dt, r.m.dt)} /></td>
                </tr>
              ))}
              <tr className={dongTong}>
                <td className={td}>Tổng team</td>
                <td className={`${td} text-center ${Math.round(tongChia) === 100 ? 'text-teal-600' : 'text-coral-500'}`}>{so1(tongChia)}% {Math.round(tongChia) === 100 ? '· OK' : '· cần = 100%'}</td>
                <td className={`${td} text-center`}>{nghin(kh.tongData)}</td><td className={`${td} text-center`}>{thucTeam.data}</td><td className={`${td} text-center`}>{hienPt(pt(thucTeam.data, kh.tongData))}</td>
                <td className={`${td} text-center`}>{so1(kh.tongHd)}</td><td className={`${td} text-center`}>{thucTeam.hd}</td><td className={`${td} text-center`}>{hienPt(pt(thucTeam.hd, kh.tongHd))}</td>
                <td className={`${td} text-right`}>{nghin(kh.tongDt)}</td><td className={`${td} text-right`}>{nghin(thucTeam.dt)}</td><td className={`${td} text-center`}>{hienPt(pHt)}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-3 text-xs text-ink-400">Mục tiêu mỗi người = mục tiêu team × % đảm nhận. Bấm vào một dòng để xem chi tiết theo nguồn và dịch vụ của người đó.</p>
        </section>

        {sel && (
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-navy-900">Chi tiết — {sel.ten} · tháng {tenThang}</h3>
            <table className="w-full border-collapse text-sm">
              <thead><tr className="bg-sky-100 text-navy-900"><th className={`${th} text-left`}>Nguồn data</th><th className={th}>Data mục tiêu</th><th className={th}>Data thực tế</th><th className={th}>HĐ mục tiêu</th><th className={th}>Job chốt thực tế</th><th className={th}>Tỷ lệ chốt mục tiêu</th><th className={th}>Tỷ lệ chốt thực tế</th></tr></thead>
              <tbody>
                {nguon.map((n) => <tr key={n.key}><td className={`${td} font-semibold`}>{n.ten}</td><td className={`${td} text-center`}>{nghin(sel.m.ng[n.key].data)}</td><td className={`${td} text-center`}>{sel.t.data[n.key] || 0}</td><td className={`${td} text-center`}>{so1(sel.m.ng[n.key].hd)}</td><td className={`${td} text-center`}>{sel.t.chot[n.key] || 0}</td><td className={`${td} text-center`}>{kh.ng[n.key].chot}%</td><td className={`${td} text-center`}>{hienPt(pt(sel.t.chot[n.key] || 0, sel.t.data[n.key] || 0))}</td></tr>)}
                <tr className={dongTong}><td className={td}>Tổng</td><td className={`${td} text-center`}>{nghin(sel.m.data)}</td><td className={`${td} text-center`}>{sel.t.tongData}</td><td className={`${td} text-center`}>{so1(sel.m.hd)}</td><td className={`${td} text-center`}>{sel.t.tongChot}</td><td className={`${td} text-center`}>{so1(kh.bq * 100)}%</td><td className={`${td} text-center`}>{hienPt(pt(sel.t.tongChot, sel.t.tongData))}</td></tr>
              </tbody>
            </table>
            <table className="mt-5 w-full border-collapse text-sm">
              <thead><tr className="bg-sky-100 text-navy-900"><th className={`${th} text-left`}>Dịch vụ</th><th className={th}>HĐ mục tiêu</th><th className={th}>HĐ thực tế</th><th className={th}>Doanh thu mục tiêu</th><th className={th}>Doanh thu thực tế</th><th className={th}>% hoàn thành</th></tr></thead>
              <tbody>
                {DV.map((d) => <tr key={d.key}><td className={`${td} font-semibold`}>{d.ten}</td><td className={`${td} text-center`}>{so1(sel.m.dv[d.key].hd)}</td><td className={`${td} text-center`}>{sel.t.dv[d.key].khach.size}</td><td className={`${td} text-right`}>{nghin(sel.m.dv[d.key].dt)}</td><td className={`${td} text-right`}>{nghin(sel.t.dv[d.key].dt)}</td><td className={`${td} text-center`}>{hienPt(pt(sel.t.dv[d.key].dt, sel.m.dv[d.key].dt))}</td></tr>)}
                <tr className={dongTong}><td className={td}>Tổng</td><td className={`${td} text-center`}>{so1(sel.m.hd)}</td><td className={`${td} text-center`}>{sel.t.hd}</td><td className={`${td} text-right`}>{nghin(sel.m.dt)}</td><td className={`${td} text-right`}>{nghin(sel.t.dt)}</td><td className={`${td} text-center`}>{hienPt(pt(sel.t.dt, sel.m.dt))}</td></tr>
              </tbody>
            </table>
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
