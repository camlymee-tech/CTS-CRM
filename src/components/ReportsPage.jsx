import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Select } from './ui'
import { formatVnd, giaTruocVat } from '../lib/constants'

export default function ReportsPage() {
  const [orders, setOrders] = useState([])
  const [items, setItems] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [nam, setNam] = useState(String(new Date().getFullYear()))
  const [thang, setThang] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: ords }, { data: its }, { data: profs }] = await Promise.all([
      supabase.from('orders').select('*').neq('trang_thai', 'huy'),
      supabase.from('order_items').select('*'),
      supabase.from('profiles').select('id, full_name'),
    ])
    setOrders(ords || [])
    setItems(its || [])
    setProfiles(profs || [])
    setLoading(false)
  }

  const donLoc = useMemo(() => orders.filter((o) => {
    if (!o.ngay_chot) return false
    const [y, m] = o.ngay_chot.split('-')
    if (nam && y !== nam) return false
    if (thang && m !== thang) return false
    return true
  }), [orders, nam, thang])

  const idLoc = useMemo(() => new Set(donLoc.map((o) => o.id)), [donLoc])

  const tongDoanhSo = donLoc.reduce((s, o) => s + giaTruocVat(o.gia_tri), 0)

  const theoSale = useMemo(() => {
    const m = {}
    for (const o of donLoc) {
      const key = o.sale_id || 'chua_gan'
      m[key] = m[key] || { soDon: 0, doanhSo: 0 }
      m[key].soDon += 1
      m[key].doanhSo += giaTruocVat(o.gia_tri)
    }
    return Object.entries(m)
      .map(([id, v]) => ({ id, ten: profiles.find((p) => p.id === id)?.full_name || 'Chưa gán sale', ...v }))
      .sort((a, b) => b.doanhSo - a.doanhSo)
  }, [donLoc, profiles])

  const theoDichVu = useMemo(() => {
    const m = {}
    for (const it of items) {
      if (!idLoc.has(it.order_id)) continue
      m[it.ten_dich_vu] = m[it.ten_dich_vu] || { soLuong: 0, doanhSo: 0 }
      m[it.ten_dich_vu].soLuong += 1
      m[it.ten_dich_vu].doanhSo += giaTruocVat(it.gia)
    }
    return Object.entries(m).map(([ten, v]) => ({ ten, ...v })).sort((a, b) => b.doanhSo - a.doanhSo)
  }, [items, idLoc])

  const theoThang = useMemo(() => {
    const m = {}
    for (const o of orders) {
      if (!o.ngay_chot) continue
      const [y, mm] = o.ngay_chot.split('-')
      if (nam && y !== nam) continue
      m[mm] = (m[mm] || 0) + giaTruocVat(o.gia_tri)
    }
    return Array.from({ length: 12 }, (_, i) => {
      const mm = String(i + 1).padStart(2, '0')
      return { thang: `Tháng ${i + 1}`, doanhSo: m[mm] || 0 }
    })
  }, [orders, nam])

  const maxThang = Math.max(...theoThang.map((t) => t.doanhSo), 1)
  const namCoData = [...new Set(orders.map((o) => o.ngay_chot?.slice(0, 4)).filter(Boolean))].sort().reverse()

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-8 py-5">
        <div>
          <h1 className="font-display text-xl font-bold text-navy-900">Tổng kết doanh số</h1>
          <p className="text-sm text-ink-600">Doanh số theo sale, theo dịch vụ và theo tháng (không tính đơn huỷ, số liệu chưa gồm VAT)</p>
        </div>
        <div className="flex gap-2">
          <Select value={nam} onChange={(e) => setNam(e.target.value)} className="w-28">
            {(namCoData.length ? namCoData : [String(new Date().getFullYear())]).map((y) =>
              <option key={y} value={y}>Năm {y}</option>)}
          </Select>
          <Select value={thang} onChange={(e) => setThang(e.target.value)} className="w-36">
            <option value="">Cả năm</option>
            {Array.from({ length: 12 }, (_, i) => {
              const mm = String(i + 1).padStart(2, '0')
              return <option key={mm} value={mm}>Tháng {i + 1}</option>
            })}
          </Select>
        </div>
      </header>

      {loading ? (
        <p className="py-16 text-center text-ink-400">Đang tải...</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4 px-8 pt-6">
            <StatCard label="Tổng doanh số (chưa VAT)" value={formatVnd(tongDoanhSo)} accent="coral" />
            <StatCard label="Số đơn chốt" value={donLoc.length} />
            <StatCard label="Giá trị trung bình / đơn (chưa VAT)"
              value={formatVnd(donLoc.length ? tongDoanhSo / donLoc.length : 0)} accent="teal" />
          </div>

          <div className="mx-8 mt-6 grid grid-cols-2 gap-4">
            <Panel title="Doanh số theo sale">
              {theoSale.length === 0 ? <Empty /> : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-ink-400">
                      <th className="pb-2">Sale</th>
                      <th className="pb-2 text-right">Số đơn</th>
                      <th className="pb-2 text-right">Doanh số</th>
                    </tr>
                  </thead>
                  <tbody>
                    {theoSale.map((s) => (
                      <tr key={s.id} className="border-t border-slate-50">
                        <td className="py-2.5 font-medium text-navy-900">{s.ten}</td>
                        <td className="py-2.5 text-right text-ink-600">{s.soDon}</td>
                        <td className="py-2.5 text-right font-medium text-navy-900">{formatVnd(s.doanhSo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>

            <Panel title="Doanh số theo dịch vụ">
              {theoDichVu.length === 0 ? <Empty /> : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-ink-400">
                      <th className="pb-2">Dịch vụ</th>
                      <th className="pb-2 text-right">Lượt bán</th>
                      <th className="pb-2 text-right">Doanh số</th>
                    </tr>
                  </thead>
                  <tbody>
                    {theoDichVu.map((d) => (
                      <tr key={d.ten} className="border-t border-slate-50">
                        <td className="py-2.5 font-medium text-navy-900">{d.ten}</td>
                        <td className="py-2.5 text-right text-ink-600">{d.soLuong}</td>
                        <td className="py-2.5 text-right font-medium text-navy-900">{formatVnd(d.doanhSo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>
          </div>

          <div className="mx-8 my-6">
            <Panel title={`Doanh số theo tháng — năm ${nam}`}>
              <div className="space-y-2">
                {theoThang.map((t) => (
                  <div key={t.thang} className="flex items-center gap-3">
                    <span className="w-20 flex-none text-sm text-ink-600">{t.thang}</span>
                    <div className="h-6 flex-1 overflow-hidden rounded-lg bg-slate-100">
                      <div className="h-full rounded-lg bg-coral-500 transition-all"
                        style={{ width: `${(t.doanhSo / maxThang) * 100}%` }} />
                    </div>
                    <span className="w-36 flex-none text-right text-sm font-medium text-navy-900">
                      {t.doanhSo ? formatVnd(t.doanhSo) : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </>
      )}
    </div>
  )
}

function Panel({ title, children }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="mb-3 font-display font-semibold text-navy-900">{title}</h2>
      {children}
    </div>
  )
}

function Empty() {
  return <p className="py-6 text-center text-sm text-ink-400">Chưa có dữ liệu trong kỳ này.</p>
}

function StatCard({ label, value, accent = 'navy' }) {
  const accents = { navy: 'text-navy-900', coral: 'text-coral-500', teal: 'text-teal-500' }
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-400">{label}</p>
      <p className={`mt-1 font-display text-2xl font-bold ${accents[accent]}`}>{value}</p>
    </div>
  )
}
