import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useTrangThai } from '../lib/StatusContext'
import { NGUON_KHACH_OPTIONS } from '../lib/constants'

// Đo tỷ lệ chuyển đổi: trong số khách đến từ mỗi nguồn, bao nhiêu % đã thực sự
// chốt hợp đồng (tính theo các trạng thái được đánh dấu "la_chot" trong Cấu hình trạng thái).
export default function ChuyenDoiNguonPage() {
  const { maDaChot, loaded } = useTrangThai()
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('customers').select('id, nguon_khach, trang_thai_cham_soc, sale_id')
    setCustomers(data || [])
    setLoading(false)
  }

  const theoNguon = useMemo(() => {
    const m = {}
    for (const o of NGUON_KHACH_OPTIONS) m[o.value] = { nguon: o.value, ten: o.label, tong: 0, daChot: 0 }
    m['_khac'] = { nguon: '_khac', ten: 'Chưa xác định', tong: 0, daChot: 0 }
    for (const c of customers) {
      const key = m[c.nguon_khach] ? c.nguon_khach : '_khac'
      m[key].tong += 1
      if (maDaChot.includes(c.trang_thai_cham_soc)) m[key].daChot += 1
    }
    return Object.values(m)
      .filter((r) => r.tong > 0)
      .map((r) => ({ ...r, tyLe: r.tong ? Math.round((r.daChot / r.tong) * 1000) / 10 : 0 }))
      .sort((a, b) => b.tong - a.tong)
  }, [customers, maDaChot])

  const tongKhach = customers.length
  const tongDaChot = customers.filter((c) => maDaChot.includes(c.trang_thai_cham_soc)).length
  const tyLeChung = tongKhach ? Math.round((tongDaChot / tongKhach) * 1000) / 10 : 0
  const maxTong = Math.max(...theoNguon.map((r) => r.tong), 1)

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="border-b border-slate-200 bg-white px-8 py-5">
        <h1 className="font-display text-xl font-bold text-navy-900">Chuyển đổi nguồn khách</h1>
        <p className="text-sm text-ink-600">
          So sánh tỷ lệ chốt hợp đồng giữa các nguồn khách (data Marketing gửi, tự tìm kiếm, giới thiệu...)
        </p>
      </header>

      {(loading || !loaded) ? (
        <p className="py-16 text-center text-ink-400">Đang tải...</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4 px-8 pt-6">
            <StatCard label="Tổng khách hàng" value={tongKhach} />
            <StatCard label="Đã chốt hợp đồng" value={tongDaChot} accent="teal" />
            <StatCard label="Tỷ lệ chuyển đổi chung" value={`${tyLeChung}%`} accent="coral" />
          </div>

          <div className="mx-8 my-6 rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="mb-4 font-display font-semibold text-navy-900">Theo nguồn khách</h2>
            {theoNguon.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-400">Chưa có dữ liệu.</p>
            ) : (
              <div className="space-y-4">
                {theoNguon.map((r) => (
                  <div key={r.nguon}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium text-navy-900">{r.ten}</span>
                      <span className="text-ink-600">
                        {r.daChot}/{r.tong} khách · <b className="text-navy-900">{r.tyLe}%</b> chuyển đổi
                      </span>
                    </div>
                    <div className="h-6 overflow-hidden rounded-lg bg-slate-100">
                      <div className="flex h-full items-center rounded-lg bg-coral-500 pl-2 text-[11px] font-medium text-white transition-all"
                        style={{ width: `${Math.max((r.tong / maxTong) * 100, 6)}%` }}>
                        {r.tong}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-4 text-xs text-ink-400">
              "Đã chốt hợp đồng" tính theo các trạng thái chăm sóc được đánh dấu là chốt trong phần Cấu hình trạng thái.
            </p>
          </div>
        </>
      )}
    </div>
  )
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
