import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useTrangThai } from '../lib/StatusContext'
import { NGUON_KHACH_OPTIONS, formatVnd, giaTruocVat } from '../lib/constants'
import { khoangNgay } from '../lib/doanhSo'
import { ngayLocal } from '../lib/danhSachKhach'
import { Select, Input, Badge } from './ui'

const KY = [
  { key: 'thang_nay', label: 'Tháng này' },
  { key: 'thang_truoc', label: 'Tháng trước' },
  { key: 'quy_nay', label: 'Quý này' },
  { key: 'nam_nay', label: 'Năm nay' },
  { key: 'tat_ca', label: 'Tất cả thời gian' },
  { key: 'tuy_chon', label: 'Chọn ngày...' },
]
const ngayHienThi = (s) => (s ? s.split('-').reverse().join('/') : '')
const phanTram = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0)

// Đo hiệu quả từng nguồn data: bao nhiêu % chốt, mỗi data mang về bao nhiêu tiền,
// và trong mỗi nguồn thì từng sale chốt tốt đến đâu (để phân bổ data cho đúng người).
// Doanh số mang về = tổng đơn (chưa VAT, không tính đơn huỷ) của các khách thuộc nhóm đang lọc.
export default function ChuyenDoiNguonPage() {
  const { maDaChot, loaded } = useTrangThai()
  const [customers, setCustomers] = useState([])
  const [orders, setOrders] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [ky, setKy] = useState('thang_nay')
  const [tu, setTu] = useState('')
  const [den, setDen] = useState('')
  const [filterSale, setFilterSale] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data }, { data: ords }, { data: profs }] = await Promise.all([
      supabase.from('customers').select('id, nguon_khach, trang_thai_cham_soc, sale_id, created_at'),
      supabase.from('orders').select('customer_id, gia_tri, trang_thai'),
      supabase.from('profiles').select('id, full_name'),
    ])
    setCustomers(data || [])
    setOrders(ords || [])
    setProfiles(profs || [])
    setLoading(false)
  }

  const [tuNgay, denNgay] = useMemo(() => khoangNgay(ky, tu, den), [ky, tu, den])
  const tenSale = (id) => (id === 'chua_gan' ? 'Chưa gán sale' : profiles.find((p) => p.id === id)?.full_name || 'Không rõ')

  // Doanh số theo từng khách (chưa VAT, trừ đơn huỷ)
  const doanhSoKhach = useMemo(() => {
    const m = {}
    for (const o of orders) {
      if (o.trang_thai === 'huy' || !o.customer_id) continue
      m[o.customer_id] = (m[o.customer_id] || 0) + giaTruocVat(o.gia_tri)
    }
    return m
  }, [orders])

  const customersLoc = useMemo(() => customers.filter((c) => {
    if (filterSale === 'chua_gan' ? c.sale_id : filterSale && c.sale_id !== filterSale) return false
    const ng = ngayLocal(c.created_at)
    if (tuNgay && ng < tuNgay) return false
    if (denNgay && ng > denNgay) return false
    return true
  }), [customers, filterSale, tuNgay, denNgay])

  const moiDong = () => ({ data: 0, chot: 0, tien: 0 })

  const { theoNguon, tong } = useMemo(() => {
    const nguon = {}
    const t = moiDong()
    const nhan = (v) => NGUON_KHACH_OPTIONS.find((o) => o.value === v)?.label
    for (const c of customersLoc) {
      const key = nhan(c.nguon_khach) ? c.nguon_khach : '_khac'
      if (!nguon[key]) nguon[key] = { key, ten: nhan(key) || 'Chưa xác định', ...moiDong(), sale: {} }
      const sid = c.sale_id || 'chua_gan'
      if (!nguon[key].sale[sid]) nguon[key].sale[sid] = moiDong()
      const chot = maDaChot.includes(c.trang_thai_cham_soc) ? 1 : 0
      const tien = doanhSoKhach[c.id] || 0
      for (const x of [nguon[key], nguon[key].sale[sid], t]) { x.data += 1; x.chot += chot; x.tien += tien }
    }
    const ds = Object.values(nguon).map((n) => ({
      ...n,
      sales: Object.entries(n.sale).map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => phanTram(b.chot, b.data) - phanTram(a.chot, a.data) || b.data - a.data),
    })).sort((a, b) => b.data - a.data)
    return { theoNguon: ds, tong: t }
  }, [customersLoc, maDaChot, doanhSoKhach])

  const moTaKy = ky === 'tat_ca' ? 'Tất cả thời gian' : `${ngayHienThi(tuNgay) || '...'} → ${ngayHienThi(denNgay) || '...'}`

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="border-b border-slate-200 bg-white px-8 py-5">
        <h1 className="font-display text-xl font-bold text-navy-900">Chuyển đổi nguồn khách</h1>
        <p className="text-sm text-ink-600">
          Mỗi nguồn data chốt được bao nhiêu %, mỗi data mang về bao nhiêu tiền, và từng sale chốt tốt đến đâu để chia data
        </p>
      </header>

      <div className="mx-8 mt-6 flex flex-wrap items-end gap-3 rounded-2xl bg-white p-4 shadow-sm">
        <Select label="Ngày tạo khách" value={ky} onChange={(e) => setKy(e.target.value)}>
          {KY.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
        </Select>
        {ky === 'tuy_chon' && (
          <>
            <Input label="Từ ngày" type="date" value={tu} onChange={(e) => setTu(e.target.value)} />
            <Input label="Đến ngày" type="date" value={den} onChange={(e) => setDen(e.target.value)} />
          </>
        )}
        <Select label="Sale" value={filterSale} onChange={(e) => setFilterSale(e.target.value)}>
          <option value="">Tất cả sale</option>
          {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          <option value="chua_gan">Chưa gán sale</option>
        </Select>
        {(ky !== 'thang_nay' || filterSale) && (
          <button type="button" onClick={() => { setKy('thang_nay'); setFilterSale('') }}
            className="mb-0.5 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-ink-600 hover:bg-slate-50">
            Về tháng này
          </button>
        )}
      </div>
      <p className="mx-8 mt-2 text-xs text-ink-400">
        Đang xem: {moTaKy} · {filterSale ? tenSale(filterSale) : 'Tất cả sale'} · tính theo ngày tạo khách · doanh số chưa VAT, trừ đơn huỷ
      </p>

      {(loading || !loaded) ? (
        <p className="py-16 text-center text-ink-400">Đang tải...</p>
      ) : (
        <>
          <div className="grid grid-cols-5 gap-4 px-8 pt-6">
            <StatCard label="Tổng data" value={tong.data} />
            <StatCard label="Đã chốt" value={tong.chot} accent="teal" />
            <StatCard label="Tỷ lệ chốt" value={`${phanTram(tong.chot, tong.data)}%`} accent="coral" />
            <StatCard label="Doanh số mang về" value={formatVnd(tong.tien)} accent="indigo" />
            <StatCard label="Giá trị / 1 data" value={formatVnd(tong.data ? tong.tien / tong.data : 0)} accent="indigo" />
          </div>

          {/* Bảng so sánh các nguồn */}
          <div className="mx-8 mt-6 rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="mb-3 font-display font-semibold text-navy-900">So sánh các nguồn</h2>
            {theoNguon.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-400">Chưa có dữ liệu trong bộ lọc này.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-ink-400">
                      <th className="pb-2">Nguồn</th>
                      <th className="pb-2 text-right">Số data</th>
                      <th className="pb-2 text-right">Đã chốt</th>
                      <th className="pb-2 text-right">Tỷ lệ chốt</th>
                      <th className="pb-2 text-right">Doanh số mang về</th>
                      <th className="pb-2 text-right">Giá trị / 1 data</th>
                      <th className="pb-2 text-right">Giá trị / đơn chốt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {theoNguon.map((n) => (
                      <tr key={n.key} className="border-t border-slate-100">
                        <td className="py-2.5 font-medium text-navy-900">{n.ten}</td>
                        <td className="py-2.5 text-right text-ink-600">{n.data}</td>
                        <td className="py-2.5 text-right text-teal-600">{n.chot}</td>
                        <td className="py-2.5 text-right font-semibold text-coral-600">{phanTram(n.chot, n.data)}%</td>
                        <td className="py-2.5 text-right font-semibold text-navy-900">{formatVnd(n.tien)}</td>
                        <td className="py-2.5 text-right text-indigo-700">{formatVnd(n.data ? n.tien / n.data : 0)}</td>
                        <td className="py-2.5 text-right text-ink-600">{n.chot ? formatVnd(n.tien / n.chot) : '—'}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-slate-200 bg-indigo-50 font-bold text-indigo-700">
                      <td className="py-2.5 pl-2">TỔNG</td>
                      <td className="py-2.5 text-right">{tong.data}</td>
                      <td className="py-2.5 text-right">{tong.chot}</td>
                      <td className="py-2.5 text-right">{phanTram(tong.chot, tong.data)}%</td>
                      <td className="py-2.5 text-right">{formatVnd(tong.tien)}</td>
                      <td className="py-2.5 text-right">{formatVnd(tong.data ? tong.tien / tong.data : 0)}</td>
                      <td className="py-2.5 pr-2 text-right">{tong.chot ? formatVnd(tong.tien / tong.chot) : '—'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Mỗi nguồn: từng sale xử lý data nguồn đó thế nào */}
          <div className="mx-8 my-6 space-y-6">
            {theoNguon.map((n) => {
              const cao = n.sales.length > 1 ? n.sales.find((s) => s.data >= 3 && s.chot > 0) : null
              return (
                <div key={n.key} className="rounded-2xl bg-white p-5 shadow-sm">
                  <h2 className="mb-3 font-display font-semibold text-navy-900">
                    Nguồn {n.ten} — từng sale
                    <span className="ml-2 text-sm font-normal text-ink-400">{n.data} data · {phanTram(n.chot, n.data)}% chốt</span>
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs uppercase tracking-wide text-ink-400">
                          <th className="pb-2">Sale</th>
                          <th className="pb-2 text-right">Data nhận</th>
                          <th className="pb-2 text-right">Đã chốt</th>
                          <th className="pb-2 text-right">Tỷ lệ chốt</th>
                          <th className="pb-2 text-right">Doanh số</th>
                          <th className="pb-2 text-right">Giá trị / 1 data</th>
                        </tr>
                      </thead>
                      <tbody>
                        {n.sales.map((s) => (
                          <tr key={s.id} className="border-t border-slate-100">
                            <td className="py-2.5 font-medium text-navy-900">
                              {tenSale(s.id)}
                              {cao && cao.id === s.id && <Badge className="ml-2 bg-emerald-100 text-emerald-700">Chốt tốt nhất</Badge>}
                            </td>
                            <td className="py-2.5 text-right text-ink-600">{s.data}</td>
                            <td className="py-2.5 text-right text-teal-600">{s.chot}</td>
                            <td className="py-2.5 text-right font-semibold text-coral-600">{phanTram(s.chot, s.data)}%</td>
                            <td className="py-2.5 text-right text-navy-900">{formatVnd(s.tien)}</td>
                            <td className="py-2.5 text-right text-indigo-700">{formatVnd(s.data ? s.tien / s.data : 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}
            {theoNguon.length > 0 && (
              <p className="text-xs text-ink-400">
                "Đã chốt" tính theo các trạng thái chăm sóc được đánh dấu là chốt. Doanh số mang về là tổng đơn (mới + tái ký) của các khách thuộc bộ lọc.
                Sale có ít hơn 3 data thì chưa đủ để xếp "Chốt tốt nhất". Sale xếp theo tỷ lệ chốt từ cao xuống thấp.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function StatCard({ label, value, accent = 'navy' }) {
  const accents = { navy: 'text-navy-900', coral: 'text-coral-500', teal: 'text-teal-500', indigo: 'text-indigo-700' }
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-400">{label}</p>
      <p className={`mt-1 font-display text-xl font-bold ${accents[accent]}`}>{value}</p>
    </div>
  )
}
