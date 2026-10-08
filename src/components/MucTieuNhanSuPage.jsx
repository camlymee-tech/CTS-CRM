import { Fragment, useEffect, useMemo, useState } from 'react'
import { FileDown, Save, Wand2 } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { Button, Select } from './ui'
import { NGUON_KHACH_OPTIONS, labelOf, formatVnd, giaTruocVat } from '../lib/constants'
import { useTrangThai } from '../lib/StatusContext'
import { phanLoai } from './BaoCaoTongHopPage'
import { xuatDashboardXlsx } from '../lib/dashboardXlsx'

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
const pt = (a, b) => (b > 0 ? Math.round((a / b) * 10000) / 100 : null)
const pt2 = (v) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(v)
const hienPt = (v) => (v === null ? '—' : `${pt2(v)}%`)
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
  const [manHinh, setManHinh] = useState('')
  const [mo, setMo] = useState('')

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
    let t = String(v).replace(',', '.').replace(/[^\d.]/g, '')
    const i = t.indexOf('.'); if (i >= 0) t = t.slice(0, i + 1) + t.slice(i + 1).replace(/\./g, '')
    o[duongDan[duongDan.length - 1]] = t
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

  const thucNguonTong = (f) => nguon.reduce((a, n) => a + tongNg(n.key, f), 0)

  // Xuất file Excel dạng dashboard (giống màn hình)
  async function xuatDashboard() {
    setDangXuat('db')
    try {
      const f = (a, b) => (b > 0 ? a / b : '')
      const P = '0.00%', T = '#,##0', S1 = '#,##0.0'
      const pc = (v) => ({ v, f: P })
      const bar = (v) => ({ v: '', bar: v })
      const muc = []
      muc.push({ loai: 'muc', text: 'Theo nhân sự' })
      muc.push({ loai: 'bang', heads: ['Nhân sự', 'Data mục tiêu', 'Data thực tế', '% data', 'HĐ mục tiêu', 'HĐ thực tế', '% HĐ', 'Doanh thu mục tiêu', 'Doanh thu thực tế', '% hoàn thành', 'Tiến độ doanh thu'], rows: [
        ...dong.map((d) => [d.ten, Math.round(d.m.data), d.t.tongData, pc(f(d.t.tongData, d.m.data)), { v: d.m.hd, f: S1 }, d.t.hd, pc(f(d.t.hd, d.m.hd)), { v: d.m.dt, f: T }, { v: d.t.dt, f: T }, pc(f(d.t.dt, d.m.dt)), bar(f(d.t.dt, d.m.dt))]),
        ['Tổng team', Math.round(kh.tongData), thucTeam.data, pc(f(thucTeam.data, kh.tongData)), { v: kh.tongHd, f: S1 }, thucTeam.hd, pc(f(thucTeam.hd, kh.tongHd)), { v: kh.tongDt, f: T }, { v: thucTeam.dt, f: T }, pc(f(thucTeam.dt, kh.tongDt)), ''],
      ] })
      muc.push({ loai: 'muc', text: 'Theo dịch vụ' })
      muc.push({ loai: 'bang', heads: ['Dịch vụ', 'HĐ cần đạt', 'HĐ thực tế', 'DT mục tiêu', 'DT thực tế', '% hoàn thành', 'Tiến độ'], rows: [
        ...DV.map((d) => [d.ten, { v: kh.dv[d.key].hd, f: S1 }, tongDvTt(d.key, 'hd'), { v: kh.dv[d.key].dt, f: T }, { v: tongDvTt(d.key, 'dt'), f: T }, pc(f(tongDvTt(d.key, 'dt'), kh.dv[d.key].dt)), bar(f(tongDvTt(d.key, 'dt'), kh.dv[d.key].dt))]),
        ['Tổng', { v: kh.tongHd, f: S1 }, thucTeam.hd, { v: kh.tongDt, f: T }, { v: thucTeam.dt, f: T }, pc(f(thucTeam.dt, kh.tongDt)), ''],
      ] })
      muc.push({ loai: 'muc', text: 'Theo nguồn data' })
      muc.push({ loai: 'bang', heads: ['Nguồn data', 'Data cần có', 'Data thực tế', 'HĐ cần đạt', 'Chốt thực tế', 'Tỷ lệ chốt mục tiêu', 'Tỷ lệ chốt thực tế', 'Tiến độ data'], rows: [
        ...nguon.map((n) => [n.ten, Math.round(kh.ng[n.key].data), tongNg(n.key, 'data'), Math.round(kh.ng[n.key].hd), tongNg(n.key, 'chot'), pc(kh.ng[n.key].chot / 100), pc(f(tongNg(n.key, 'chot'), tongNg(n.key, 'data'))), bar(f(tongNg(n.key, 'data'), kh.ng[n.key].data))]),
        ['Tổng', Math.round(kh.tongData), thucTeam.data, Math.round(kh.tongHd), thucNguonTong('chot'), pc(kh.bq), pc(f(thucNguonTong('chot'), thucTeam.data)), ''],
      ] })
      muc.push({ loai: 'muc', text: 'Thiết lập mục tiêu của team' })
      muc.push({ loai: 'bang', heads: ['Dịch vụ', 'DT mục tiêu', 'Giá trị TB / HĐ', 'Số HĐ cần đạt', 'Tỷ lệ chốt BQ', 'Số data cần có'], rows: [
        ...DV.map((d) => [d.ten, { v: kh.dv[d.key].dt, f: T }, { v: kh.dv[d.key].gia, f: T }, { v: kh.dv[d.key].hd, f: S1 }, pc(kh.dv[d.key].bq), Math.round(kh.dv[d.key].data)]),
        ['Tổng', { v: kh.tongDt, f: T }, { v: Math.round(kh.giaTb), f: T }, { v: kh.tongHd, f: S1 }, pc(kh.bq), Math.round(kh.tongData)],
      ] })
      muc.push({ loai: 'bang', heads: ['Nguồn data', ...DV.map((d) => `Data ${d.ten}`), 'Tổng data cần có', 'Tỷ lệ chốt mục tiêu', 'Số HĐ cần đạt'], rows: [
        ...nguon.map((n) => [n.ten, ...DV.map((d) => Math.round(kh.ng[n.key].dataDv[d.key])), Math.round(kh.ng[n.key].data), pc(kh.ng[n.key].chot / 100), Math.round(kh.ng[n.key].hd)]),
        ['Tổng', ...DV.map((d) => Math.round(kh.dv[d.key].data)), Math.round(kh.tongData), pc(kh.bq), Math.round(kh.tongHd)],
      ] })
      muc.push({ loai: 'muc', text: 'Chi tiết từng nhân sự' })
      for (const d of dong) {
        muc.push({ loai: 'dai', text: `${d.ten} — đảm nhận ${pt2(d.k)}% mục tiêu team` })
        muc.push({ loai: 'bang', heads: ['Nguồn data', 'Data mục tiêu', 'Data thực tế', 'HĐ mục tiêu', 'Chốt thực tế', 'Tỷ lệ chốt mục tiêu', 'Tỷ lệ chốt thực tế'], rows: [
          ...nguon.map((n) => [n.ten, Math.round(d.m.ng[n.key].data), d.t.data[n.key] || 0, { v: d.m.ng[n.key].hd, f: S1 }, d.t.chot[n.key] || 0, pc(kh.ng[n.key].chot / 100), pc(f(d.t.chot[n.key] || 0, d.t.data[n.key] || 0))]),
          ['Tổng', Math.round(d.m.data), d.t.tongData, { v: d.m.hd, f: S1 }, d.t.tongChot, pc(kh.bq), pc(f(d.t.tongChot, d.t.tongData))],
        ] })
        muc.push({ loai: 'bang', heads: ['Dịch vụ', 'HĐ mục tiêu', 'HĐ thực tế', 'DT mục tiêu', 'DT thực tế', '% hoàn thành', 'Tiến độ'], rows: [
          ...DV.map((v) => [v.ten, { v: d.m.dv[v.key].hd, f: S1 }, d.t.dv[v.key].khach.size, { v: d.m.dv[v.key].dt, f: T }, { v: d.t.dv[v.key].dt, f: T }, pc(f(d.t.dv[v.key].dt, d.m.dv[v.key].dt)), bar(f(d.t.dv[v.key].dt, d.m.dv[v.key].dt))]),
          ['Tổng', { v: d.m.hd, f: S1 }, d.t.hd, { v: d.m.dt, f: T }, { v: d.t.dt, f: T }, pc(f(d.t.dt, d.m.dt)), ''],
        ] })
      }
      await xuatDashboardXlsx({
        tieuDe: `MỤC TIÊU NHÂN SỰ — THÁNG ${tenThang}`,
        phuDe: 'Mục tiêu và kết quả thực tế của team. Thực tế chỉ tính đơn mới đã chốt trong tháng, đã trừ đơn hoàn / huỷ. Doanh thu chưa VAT.',
        the: [
          { nhan: 'Doanh thu (chưa VAT)', gt: thucTeam.dt, fmt: '#,##0', phu: `mục tiêu ${nghin(kh.tongDt)}`, pc: f(thucTeam.dt, kh.tongDt) },
          { nhan: 'Số data', gt: thucTeam.data, fmt: '#,##0', phu: `mục tiêu ${nghin(kh.tongData)}`, pc: f(thucTeam.data, kh.tongData) },
          { nhan: 'Số hợp đồng', gt: thucTeam.hd, fmt: '#,##0', phu: `mục tiêu ${so1(kh.tongHd)}`, pc: f(thucTeam.hd, kh.tongHd) },
          { nhan: 'Giá trị TB / HĐ', gt: Math.round(thucTeam.hd ? thucTeam.dt / thucTeam.hd : 0), fmt: '#,##0', phu: `mục tiêu ${nghin(kh.giaTb)}`, pc: '' },
        ],
        muc, tenFile: `MucTieuNhanSu_${thang}.xlsx`,
      })
    } finally { setDangXuat('') }
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
                    <tr className={dongTong}><td className={td}>Tổng</td><td className={`${td} text-center`}>{nghin(m.data)}</td><td className={`${td} text-center`}>{t.tongData}</td><td className={`${td} text-center`}>{so1(m.hd)}</td><td className={`${td} text-center`}>{t.tongChot}</td><td className={`${td} text-center`}>{pt2(kh.bq * 100)}%</td><td className={`${td} text-center`}>{hienPt(pt(t.tongChot, t.tongData))}</td></tr>
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

  const mauDv = { ads: 'bg-violet-500', xay_shop: 'bg-coral-500', mall: 'bg-sky-500' }
  const kqNguon = nguon.reduce((a, n) => a + tongNg(n.key, 'chot'), 0)
  const checkCc = DV.every((d) => Math.round(kh.dv[d.key].tongCc) === 100)
  const hienManHinh = manHinh || (kh.tongDt > 0 ? 'theo_doi' : 'thiet_lap')

  return (
    <div className="h-full overflow-y-auto">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-8 py-5">
        <div>
          <h1 className="font-display text-xl font-bold text-navy-900">Mục tiêu nhân sự hàng tháng</h1>
          <p className="text-sm text-ink-600">Thiết lập mục tiêu đầu tháng, theo dõi kết quả trong tháng</p>
        </div>
        <div className="flex items-end gap-2">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-navy-900">Tháng</span>
            <input type="month" value={thang} onChange={(e) => e.target.value && setThang(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-coral-500" />
          </label>
          <Button variant="secondary" onClick={xuatDashboard} disabled={loading || !!dangXuat}><FileDown size={16} /> {dangXuat === 'db' ? 'Đang xuất...' : 'Xuất báo cáo (giống màn hình)'}</Button>
          <Button onClick={luu} disabled={!daSua || dangLuu}><Save size={16} /> {dangLuu ? 'Đang lưu...' : 'Lưu mục tiêu'}</Button>
        </div>
      </header>

      <div className="flex gap-1 border-b border-slate-200 bg-white px-8">
        {[['thiet_lap', '1. Thiết lập mục tiêu'], ['theo_doi', '2. Theo dõi kết quả']].map(([k, t]) => (
          <button key={k} onClick={() => setManHinh(k)}
            className={`-mb-px border-b-2 px-3 py-2.5 text-sm transition ${hienManHinh === k ? 'border-coral-500 font-medium text-navy-900' : 'border-transparent text-ink-600 hover:text-navy-900'}`}>{t}</button>
        ))}
      </div>

      <div className="space-y-5 px-8 py-6">
        {thongBao && <p className="rounded-xl bg-sky-50 px-4 py-2.5 text-sm text-navy-900">{thongBao}</p>}

        {hienManHinh === 'thiet_lap' && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Chip nhan="Doanh thu mục tiêu (chưa VAT)" gt={nghin(kh.tongDt)} mau="text-indigo-700" />
              <Chip nhan="Số HĐ cần đạt" gt={so1(kh.tongHd)} phu={`Giá trị TB ${nghin(kh.giaTb)}`} />
              <Chip nhan="Số data cần có" gt={nghin(kh.tongData)} />
              <Chip nhan="Tỷ lệ chốt bình quân" gt={`${pt2(kh.bq * 100)}%`} mau="text-coral-500" />
            </div>

            <section>
              <h3 className="mb-1 text-sm font-semibold text-navy-900">Bước 1 · Mỗi dịch vụ: doanh thu, giá trị TB và cơ cấu data</h3>
              <p className="mb-3 text-xs text-ink-400">Chỉ điền các ô nền vàng. Số HĐ cần đạt, tỷ lệ chốt BQ và số data cần có app tự tính.</p>
              <div className="grid gap-4 lg:grid-cols-3">
                {DV.map((d) => {
                  const v = kh.dv[d.key]; const ok = Math.round(v.tongCc) === 100
                  return (
                    <div key={d.key} className="rounded-2xl bg-white p-5 shadow-sm">
                      <div className="mb-2 flex items-center gap-2"><i className={`h-3 w-3 rounded-full ${mauDv[d.key]}`} /><b className="text-navy-900">{d.ten}</b></div>
                      <Dong nhan="DT mục tiêu (chưa VAT)"><input type="text" inputMode="numeric" className={o('w-40') + ' bg-amber-50'} value={team?.dv?.[d.key]?.dt === undefined || team?.dv?.[d.key]?.dt === '' ? '' : nghin(team.dv[d.key].dt)} onChange={(e) => dat(['dv', d.key, 'dt'], e.target.value.replace(/\D/g, ''))} /></Dong>
                      <Dong nhan="Giá trị TB / HĐ"><input type="text" inputMode="numeric" className={o('w-40') + ' bg-amber-50'} value={team?.dv?.[d.key]?.gia === undefined || team?.dv?.[d.key]?.gia === '' ? '' : nghin(team.dv[d.key].gia)} onChange={(e) => dat(['dv', d.key, 'gia'], e.target.value.replace(/\D/g, ''))} /></Dong>
                      <div className="my-2 rounded-xl bg-slate-50 px-4 py-2.5 text-center"><p className="text-xs text-ink-600">Số HĐ cần đạt</p><p className="font-display text-2xl font-bold text-navy-900">{so1(v.hd)}</p></div>
                      <p className="mt-3 border-t border-slate-100 pt-3 text-xs font-medium uppercase tracking-wide text-ink-400">Cơ cấu data theo nguồn</p>
                      {nguon.map((n) => (
                        <Dong key={n.key} nhan={n.ten}><span className="flex items-center gap-1"><input type="text" inputMode="decimal" className={o('w-20') + ' bg-amber-50'} value={tienIn(team?.cc?.[d.key]?.[n.key])} onChange={(e) => dat(['cc', d.key, n.key], e.target.value)} />%</span></Dong>
                      ))}
                      <p className={`mt-1 text-right text-xs font-semibold ${ok ? 'text-teal-600' : 'text-coral-500'}`}>Tổng cơ cấu {pt2(v.tongCc)}% {ok ? '· OK' : '· cần = 100%'}</p>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="rounded-xl bg-slate-50 px-3 py-2 text-center"><p className="text-xs text-ink-600">Tỷ lệ chốt BQ</p><p className="font-semibold text-navy-900">{pt2(v.bq * 100)}%</p></div>
                        <div className="rounded-xl bg-slate-50 px-3 py-2 text-center"><p className="text-xs text-ink-600">Số data cần có</p><p className="font-semibold text-navy-900">{nghin(v.data)}</p></div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>

            <section className="rounded-2xl bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-navy-900">Bước 2 · Tỷ lệ chốt mục tiêu của từng nguồn data</h3>
              <div className="grid gap-3 sm:grid-cols-4">
                {nguon.map((n) => (
                  <div key={n.key} className="rounded-xl border border-slate-200 p-3">
                    <p className="text-sm font-medium text-navy-900">{n.ten}</p>
                    <span className="mt-1 flex items-center gap-1"><input type="text" inputMode="decimal" className={o('w-24') + ' bg-amber-50'} value={tienIn(team?.chot?.[n.key])} onChange={(e) => dat(['chot', n.key], e.target.value)} />%</span>
                    <p className="mt-2 text-xs text-ink-400">Cần {nghin(kh.ng[n.key].data)} data → {nghin(kh.ng[n.key].hd)} HĐ</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-navy-900">Bước 3 · Chia mục tiêu cho từng nhân sự</h3>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => chiaTuDong('deu')}><Wand2 size={16} /> Chia đều</Button>
                  <Button variant="secondary" onClick={() => chiaTuDong('truoc')}><Wand2 size={16} /> Chia theo doanh số tháng trước</Button>
                </div>
              </div>
              <table className="w-full border-collapse text-sm">
                <thead><tr className="bg-sky-100 text-navy-900"><th className={`${th} text-left`}>Nhân sự</th><th className={th}>% đảm nhận</th><th className={th}>Data mục tiêu</th><th className={th}>HĐ mục tiêu</th><th className={th}>Doanh thu mục tiêu</th></tr></thead>
                <tbody>
                  {dong.map((r) => (
                    <tr key={r.id}><td className={`${td} font-medium text-navy-900`}>{r.ten}</td>
                      <td className={vang}><span className="flex items-center justify-center gap-1"><input type="text" inputMode="decimal" className={o('w-20')} value={tienIn(team?.tt?.[r.id])} onChange={(e) => dat(['tt', r.id], e.target.value)} />%</span></td>
                      <td className={`${td} text-center`}>{nghin(r.m.data)}</td><td className={`${td} text-center`}>{so1(r.m.hd)}</td><td className={`${td} text-right`}>{nghin(r.m.dt)}</td></tr>
                  ))}
                  <tr className={dongTong}><td className={td}>Tổng team</td>
                    <td className={`${td} text-center ${Math.round(tongChia) === 100 ? 'text-teal-600' : 'text-coral-500'}`}>{pt2(tongChia)}% {Math.round(tongChia) === 100 ? '· OK' : '· cần = 100%'}</td>
                    <td className={`${td} text-center`}>{nghin(kh.tongData)}</td><td className={`${td} text-center`}>{so1(kh.tongHd)}</td><td className={`${td} text-right`}>{nghin(kh.tongDt)}</td></tr>
                </tbody>
              </table>
              <p className="mt-3 text-xs text-ink-400">Điền xong bấm <b>Lưu mục tiêu</b> ở góc trên bên phải, rồi sang tab "Theo dõi kết quả" để xem số thực tế.</p>
            </section>
          </>
        )}

        {hienManHinh === 'theo_doi' && (
          <>
            <div className="grid grid-cols-2 divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-sm sm:grid-cols-4 sm:divide-y-0 sm:divide-x">
              <KpiMt nhan="Doanh thu (chưa VAT)" mt={nghin(kh.tongDt)} tt={nghin(thucTeam.dt)} phan={pHt} mau={mauPt(pHt)} />
              <KpiMt nhan="Số data" mt={nghin(kh.tongData)} tt={thucTeam.data} phan={pt(thucTeam.data, kh.tongData)} mau={mauPt(pt(thucTeam.data, kh.tongData))} />
              <KpiMt nhan="Số hợp đồng" mt={so1(kh.tongHd)} tt={thucTeam.hd} phan={pt(thucTeam.hd, kh.tongHd)} mau={mauPt(pt(thucTeam.hd, kh.tongHd))} />
              <KpiMt nhan="Giá trị TB / HĐ" mt={nghin(kh.giaTb)} tt={nghin(thucTeam.hd ? thucTeam.dt / thucTeam.hd : 0)} />
            </div>

            <section className="rounded-2xl bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-navy-900">Theo nhân sự <span className="font-normal text-ink-400">· bấm vào tên để xem chi tiết</span></h3>
              <table className="w-full min-w-[900px] border-collapse text-sm">
                <thead>
                  <tr className="bg-sky-100 text-navy-900"><th rowSpan={2} className={`${th} text-left`}>Nhân sự</th><th colSpan={3} className={th}>Số data</th><th colSpan={3} className={th}>Số hợp đồng</th><th colSpan={3} className={th}>Doanh thu (chưa VAT)</th></tr>
                  <tr className="bg-sky-100 text-navy-900">{['Mục tiêu', 'Thực tế', '%', 'Mục tiêu', 'Thực tế', '%', 'Mục tiêu', 'Thực tế', '% hoàn thành'].map((x, i) => <th key={i} className={`${th} font-medium`}>{x}</th>)}</tr>
                </thead>
                <tbody>
                  {dong.map((r) => (
                    <Fragment key={r.id}>
                      <tr onClick={() => setMo(mo === r.id ? '' : r.id)} className={`cursor-pointer ${mo === r.id ? 'bg-amber-50/60' : 'hover:bg-slate-50'}`}>
                        <td className={`${td} font-medium text-navy-900`}><span className="mr-1 text-ink-400">{mo === r.id ? '▾' : '▸'}</span>{r.ten}</td>
                        <td className={`${td} text-center`}>{nghin(r.m.data)}</td><td className={`${td} text-center`}>{r.t.tongData}</td><td className={`${td} text-center`}>{hienPt(pt(r.t.tongData, r.m.data))}</td>
                        <td className={`${td} text-center`}>{so1(r.m.hd)}</td><td className={`${td} text-center`}>{r.t.hd}</td><td className={`${td} text-center`}>{hienPt(pt(r.t.hd, r.m.hd))}</td>
                        <td className={`${td} text-right`}>{nghin(r.m.dt)}</td><td className={`${td} text-right`}>{nghin(r.t.dt)}</td><td className={`${td} min-w-[140px]`}><Bar v={pt(r.t.dt, r.m.dt)} /></td>
                      </tr>
                      {mo === r.id && (
                        <tr><td colSpan={10} className="border border-slate-200 bg-slate-50/60 p-4">
                          <div className="grid gap-4 lg:grid-cols-2">
                            <table className="w-full border-collapse bg-white text-sm">
                              <thead><tr className="bg-sky-100 text-navy-900"><th className={`${th} text-left`}>Nguồn data</th><th className={th}>Data MT</th><th className={th}>Data TT</th><th className={th}>HĐ MT</th><th className={th}>Chốt TT</th><th className={th}>Tỷ lệ chốt TT</th></tr></thead>
                              <tbody>
                                {nguon.map((n) => <tr key={n.key}><td className={`${td} font-semibold`}>{n.ten}</td><td className={`${td} text-center`}>{nghin(r.m.ng[n.key].data)}</td><td className={`${td} text-center`}>{r.t.data[n.key] || 0}</td><td className={`${td} text-center`}>{so1(r.m.ng[n.key].hd)}</td><td className={`${td} text-center`}>{r.t.chot[n.key] || 0}</td><td className={`${td} text-center`}>{hienPt(pt(r.t.chot[n.key] || 0, r.t.data[n.key] || 0))}</td></tr>)}
                                <tr className={dongTong}><td className={td}>Tổng</td><td className={`${td} text-center`}>{nghin(r.m.data)}</td><td className={`${td} text-center`}>{r.t.tongData}</td><td className={`${td} text-center`}>{so1(r.m.hd)}</td><td className={`${td} text-center`}>{r.t.tongChot}</td><td className={`${td} text-center`}>{hienPt(pt(r.t.tongChot, r.t.tongData))}</td></tr>
                              </tbody>
                            </table>
                            <table className="w-full border-collapse bg-white text-sm">
                              <thead><tr className="bg-sky-100 text-navy-900"><th className={`${th} text-left`}>Dịch vụ</th><th className={th}>HĐ MT</th><th className={th}>HĐ TT</th><th className={th}>DT mục tiêu</th><th className={th}>DT thực tế</th><th className={th}>%</th></tr></thead>
                              <tbody>
                                {DV.map((d) => <tr key={d.key}><td className={`${td} font-semibold`}>{d.ten}</td><td className={`${td} text-center`}>{so1(r.m.dv[d.key].hd)}</td><td className={`${td} text-center`}>{r.t.dv[d.key].khach.size}</td><td className={`${td} text-right`}>{nghin(r.m.dv[d.key].dt)}</td><td className={`${td} text-right`}>{nghin(r.t.dv[d.key].dt)}</td><td className={`${td} text-center`}>{hienPt(pt(r.t.dv[d.key].dt, r.m.dv[d.key].dt))}</td></tr>)}
                                <tr className={dongTong}><td className={td}>Tổng</td><td className={`${td} text-center`}>{so1(r.m.hd)}</td><td className={`${td} text-center`}>{r.t.hd}</td><td className={`${td} text-right`}>{nghin(r.m.dt)}</td><td className={`${td} text-right`}>{nghin(r.t.dt)}</td><td className={`${td} text-center`}>{hienPt(pt(r.t.dt, r.m.dt))}</td></tr>
                              </tbody>
                            </table>
                          </div>
                        </td></tr>
                      )}
                    </Fragment>
                  ))}
                  <tr className={dongTong}>
                    <td className={td}>Tổng team</td>
                    <td className={`${td} text-center`}>{nghin(kh.tongData)}</td><td className={`${td} text-center`}>{thucTeam.data}</td><td className={`${td} text-center`}>{hienPt(pt(thucTeam.data, kh.tongData))}</td>
                    <td className={`${td} text-center`}>{so1(kh.tongHd)}</td><td className={`${td} text-center`}>{thucTeam.hd}</td><td className={`${td} text-center`}>{hienPt(pt(thucTeam.hd, kh.tongHd))}</td>
                    <td className={`${td} text-right`}>{nghin(kh.tongDt)}</td><td className={`${td} text-right`}>{nghin(thucTeam.dt)}</td><td className={`${td} text-center`}>{hienPt(pHt)}</td>
                  </tr>
                </tbody>
              </table>
            </section>

            <div className="grid gap-5 xl:grid-cols-2">
              <section className="rounded-2xl bg-white p-5 shadow-sm">
                <h3 className="mb-3 text-sm font-semibold text-navy-900">Theo dịch vụ</h3>
                <table className="w-full border-collapse text-sm">
                  <thead><tr className="bg-sky-100 text-navy-900"><th className={`${th} text-left`}>Dịch vụ</th><th className={th}>HĐ cần đạt</th><th className={th}>HĐ thực tế</th><th className={th}>DT mục tiêu</th><th className={th}>DT thực tế</th><th className={th}>% hoàn thành</th></tr></thead>
                  <tbody>
                    {DV.map((d) => <tr key={d.key}><td className={`${td} font-semibold`}><i className={`mr-2 inline-block h-2.5 w-2.5 rounded-full ${mauDv[d.key]}`} />{d.ten}</td><td className={`${td} text-center`}>{so1(kh.dv[d.key].hd)}</td><td className={`${td} text-center`}>{tongDvTt(d.key, 'hd')}</td><td className={`${td} text-right`}>{nghin(kh.dv[d.key].dt)}</td><td className={`${td} text-right`}>{nghin(tongDvTt(d.key, 'dt'))}</td><td className={`${td} min-w-[130px]`}><Bar v={pt(tongDvTt(d.key, 'dt'), kh.dv[d.key].dt)} /></td></tr>)}
                    <tr className={dongTong}><td className={td}>Tổng</td><td className={`${td} text-center`}>{so1(kh.tongHd)}</td><td className={`${td} text-center`}>{thucTeam.hd}</td><td className={`${td} text-right`}>{nghin(kh.tongDt)}</td><td className={`${td} text-right`}>{nghin(thucTeam.dt)}</td><td className={`${td} text-center`}>{hienPt(pHt)}</td></tr>
                  </tbody>
                </table>
              </section>
              <section className="rounded-2xl bg-white p-5 shadow-sm">
                <h3 className="mb-3 text-sm font-semibold text-navy-900">Theo nguồn data</h3>
                <table className="w-full border-collapse text-sm">
                  <thead><tr className="bg-sky-100 text-navy-900"><th className={`${th} text-left`}>Nguồn data</th><th className={th}>Data cần có</th><th className={th}>Data thực tế</th><th className={th}>HĐ cần đạt</th><th className={th}>Chốt thực tế</th><th className={th}>Tỷ lệ chốt MT</th><th className={th}>Tỷ lệ chốt TT</th></tr></thead>
                  <tbody>
                    {nguon.map((n) => <tr key={n.key}><td className={`${td} font-semibold`}>{n.ten}</td><td className={`${td} text-center`}>{nghin(kh.ng[n.key].data)}</td><td className={`${td} text-center`}>{tongNg(n.key, 'data')}</td><td className={`${td} text-center`}>{nghin(kh.ng[n.key].hd)}</td><td className={`${td} text-center`}>{tongNg(n.key, 'chot')}</td><td className={`${td} text-center`}>{kh.ng[n.key].chot}%</td><td className={`${td} text-center`}>{hienPt(pt(tongNg(n.key, 'chot'), tongNg(n.key, 'data')))}</td></tr>)}
                    <tr className={dongTong}><td className={td}>Tổng</td><td className={`${td} text-center`}>{nghin(kh.tongData)}</td><td className={`${td} text-center`}>{thucTeam.data}</td><td className={`${td} text-center`}>{nghin(kh.tongHd)}</td><td className={`${td} text-center`}>{kqNguon}</td><td className={`${td} text-center`}>{pt2(kh.bq * 100)}%</td><td className={`${td} text-center`}>{hienPt(pt(kqNguon, thucTeam.data))}</td></tr>
                  </tbody>
                </table>
                <p className="mt-3 text-xs text-ink-400">Data cần có theo từng dịch vụ (ADS · Xây shop · Mall) xem ở tab "Thiết lập mục tiêu". Thực tế chỉ tính đơn mới đã chốt trong tháng, đã trừ đơn hoàn / huỷ.</p>
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const mauPtM = (v) => (v === null ? 'bg-slate-200' : v >= 100 ? 'bg-teal-500' : v >= 70 ? 'bg-amber-400' : 'bg-coral-500')
const Chip = ({ nhan, gt, phu, mau = 'text-navy-900' }) => (
  <div className="rounded-xl bg-slate-50 px-4 py-3">
    <p className="text-xs text-ink-600">{nhan}</p>
    <p className={`mt-0.5 font-display text-2xl font-bold tabular-nums ${mau}`}>{gt}</p>
    {phu && <p className="text-xs text-ink-400">{phu}</p>}
  </div>
)
const Dong = ({ nhan, children, tinh }) => (
  <div className={`flex items-center justify-between gap-3 py-1.5 ${tinh ? 'text-sm' : ''}`}>
    <span className="whitespace-nowrap text-sm text-ink-600">{nhan}</span>{children}
  </div>
)


const Bar = ({ v }) => (
  <div className="flex items-center gap-2">
    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${mauPtM(v)}`} style={{ width: `${Math.min(100, v || 0)}%` }} /></div>
    <b className="w-11 text-right">{hienPt(v)}</b>
  </div>
)

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
