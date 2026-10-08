import { useEffect, useMemo, useRef, useState } from 'react'
import { FileDown } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { Button, Input, Select } from './ui'
import { NGUON_KHACH_OPTIONS, labelOf, formatVnd, giaTruocVat } from '../lib/constants'
import { khoangNgay } from '../lib/doanhSo'
import { useTrangThai } from '../lib/StatusContext'
import { xuatDashboardXlsx } from '../lib/dashboardXlsx'

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
const phanTram = (a, b) => (b > 0 ? Math.round((a / b) * 10000) / 100 : null)
const hienPhanTram = (v) => (v === null ? '—' : `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(v)}%`)
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

  // Xuất file Excel dạng dashboard (giống màn hình)
  async function xuatDashboard() {
    setDangXuat(true)
    try {
      const f = (a, b) => (b > 0 ? a / b : '')
      const P = '0.00%', T = '#,##0'
      const pc = (v) => ({ v, f: P })
      const MAU = { ads_moi: 'FF8B5CF6', ads_tai_ky: 'FF6366F1', xay_shop: 'FFF0624D', mall: 'FF0EA5E9', follow: 'FF14B8A6', nhan_ban: 'FFFBBF24', khac: 'FF94A3B8' }
      await xuatDashboardXlsx({
        tieuDe: 'BÁO CÁO TỔNG HỢP DOANH SỐ & NGUỒN DATA',
        phuDe: `Kỳ báo cáo: ${tenKy} · ${sale ? 'Sale: ' + (profiles.find((p) => p.id === sale)?.full_name || '') : 'Tất cả sale'}`,
        the: [
          { nhan: 'Doanh số (chưa VAT)', gt: tong1.tien, fmt: T, phu: 'đã trừ hoàn / huỷ', pc: '' },
          { nhan: 'Số shop đã chốt', gt: shopChot, fmt: T, phu: 'shop có đơn trong kỳ', pc: '' },
          { nhan: 'Data nhận', gt: tong2.data, fmt: T, phu: 'khách mới tạo trong kỳ', pc: '' },
          { nhan: 'Tỷ lệ chốt tổng', gt: phanTram(tong2.tong, tong2.data) === null ? '' : phanTram(tong2.tong, tong2.data) / 100, fmt: P, phu: `${tong2.tong} job chốt / ${tong2.data} data`, pc: '' },
        ],
        muc: [
          { loai: 'muc', text: 'Doanh số theo dịch vụ' },
          { loai: 'bang', heads: ['Dịch vụ', 'Số lượng shop', 'Doanh số tổng (chưa tính VAT)', 'Tỷ trọng so với dịch vụ cao nhất'], rows: [
            ...bang1.map((d) => [d.ten, d.soShop, { v: d.tien, f: T }, { v: '', bar: d.tien / maxTien1, mau: MAU[d.key] }]),
            ['Tổng', tong1.soShop, { v: tong1.tien, f: T }, ''],
          ] },
          { loai: 'muc', text: 'Nguồn data: data nhận và job chốt' },
          { loai: 'bang', heads: ['Nguồn data', 'Data', 'Chốt tổng', 'Tỷ lệ chốt tổng', 'Thanh data', 'Thanh chốt tổng'], rows: [
            ...bang2.map((n) => [n.ten, n.data, n.tong, pc(f(n.tong, n.data)), { v: '', bar: n.data / maxData2, mau: 'FF94A3B8' }, { v: '', bar: n.tong / maxData2, mau: 'FFF0624D' }]),
            ['Tổng', tong2.data, tong2.tong, pc(f(tong2.tong, tong2.data)), '', ''],
          ] },
          { loai: 'muc', text: 'Bảng 1 — Doanh số theo dịch vụ' },
          { loai: 'bang', heads: ['Dịch vụ', 'Số lượng shop', 'Doanh số tổng (chưa tính VAT)'], rows: [
            ...bang1.map((d) => [d.ten, d.soShop, { v: d.tien, f: T }]),
            ['Tổng', tong1.soShop, { v: tong1.tien, f: T }],
          ] },
          { loai: 'muc', text: 'Bảng 2 — Hiệu quả theo nguồn data' },
          { loai: 'bang', heads: ['Nguồn data', 'Số lượng data trong tháng', 'Số job chốt trực tiếp trong tháng', 'Tỷ lệ chốt trực tiếp %', 'Số job chốt tổng (bao gồm data tháng cũ)', 'Tỷ lệ chốt tổng %', 'Doanh số từ các nguồn (tính cả VAT)'], rows: [
            ...bang2.map((n) => [n.ten, n.data, n.tt, pc(f(n.tt, n.data)), n.tong, pc(f(n.tong, n.data)), { v: Math.round(n.tien), f: T }]),
            ['Tổng', tong2.data, tong2.tt, pc(f(tong2.tt, tong2.data)), tong2.tong, pc(f(tong2.tong, tong2.data)), { v: Math.round(tong2.tien), f: T }],
          ] },
          { loai: 'ghichu', text: 'Job chốt trực tiếp = data tạo trong kỳ và chốt đơn mới trong kỳ. Job chốt tổng = mọi đơn mới chốt trong kỳ (kể cả data tháng cũ), nên tỷ lệ có thể trên 100%. Đơn tái ký và đơn hoàn / huỷ không tính vào job chốt.' },
        ],
        tenFile: `BaoCaoTongHop_${ngayCua(new Date())}.xlsx`,
      })
    } finally {
      setDangXuat(false)
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
          <Button onClick={xuatDashboard} disabled={loading || dangXuat}>
            <FileDown size={16} /> {dangXuat ? 'Đang xuất...' : 'Xuất báo cáo (giống màn hình)'}
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
