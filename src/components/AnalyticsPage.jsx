import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { Select, Badge } from './ui'
import { NGUON_KHACH_OPTIONS, TRANG_THAI_OPTIONS, labelOf, classOf, formatVnd } from '../lib/constants'

const NGAY_BO_QUEN = 7

export default function AnalyticsPage() {
  const [customers, setCustomers] = useState([])
  const [orders, setOrders] = useState([])
  const [interactions, setInteractions] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [ky, setKy] = useState('30')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: c }, { data: o }, { data: i }, { data: p }] = await Promise.all([
      supabase.from('customers').select('*'),
      supabase.from('orders').select('*').neq('trang_thai', 'huy'),
      supabase.from('customer_interactions').select('*'),
      supabase.from('profiles').select('id, full_name'),
    ])
    setCustomers(c || []); setOrders(o || []); setInteractions(i || []); setProfiles(p || [])
    setLoading(false)
  }

  const moc = useMemo(() => {
    if (ky === 'all') return '0000-00-00'
    const d = new Date()
    d.setDate(d.getDate() - Number(ky))
    return d.toISOString().slice(0, 10)
  }, [ky])

  const tenSale = (id) => profiles.find((p) => p.id === id)?.full_name || 'Chưa gán'

  // ===== Phễu chuyển đổi =====
  const pheu = useMemo(() => {
    const trongKy = customers.filter((c) => (c.created_at || '').slice(0, 10) >= moc)
    const daLienHe = trongKy.filter((c) => c.trang_thai_cham_soc !== 'chua_lien_he')
    const daTuVan = trongKy.filter((c) => ['dang_tu_van', 'da_ky', 'dang_trien_khai'].includes(c.trang_thai_cham_soc))
    const daKy = trongKy.filter((c) => ['da_ky', 'dang_trien_khai'].includes(c.trang_thai_cham_soc))
    return [
      { ten: 'Data vào', so: trongKy.length },
      { ten: 'Đã liên hệ được', so: daLienHe.length },
      { ten: 'Vào tư vấn', so: daTuVan.length },
      { ten: 'Chốt hợp đồng', so: daKy.length },
    ]
  }, [customers, moc])

  // ===== Hiệu suất từng sale =====
  const hieuSuat = useMemo(() => {
    const m = {}
    const them = (id) => { m[id] = m[id] || { dangGiu: 0, chamSoc: 0, chot: 0, doanhSo: 0 } }
    for (const c of customers) {
      if (!c.sale_id) continue
      them(c.sale_id)
      m[c.sale_id].dangGiu += 1
      if (['da_ky', 'dang_trien_khai'].includes(c.trang_thai_cham_soc)) m[c.sale_id].chot += 1
    }
    for (const it of interactions) {
      if (!it.sale_id || (it.ngay_thuc_hien || '').slice(0, 10) < moc) continue
      them(it.sale_id); m[it.sale_id].chamSoc += 1
    }
    for (const o of orders) {
      if (!o.sale_id || (o.ngay_chot || '') < moc) continue
      them(o.sale_id); m[o.sale_id].doanhSo += Number(o.gia_tri) || 0
    }
    return Object.entries(m)
      .map(([id, v]) => ({
        id, ten: tenSale(id), ...v,
        tiLe: v.dangGiu ? Math.round((v.chot / v.dangGiu) * 100) : 0,
      }))
      .sort((a, b) => b.doanhSo - a.doanhSo)
  }, [customers, interactions, orders, profiles, moc])

  // ===== Nguồn khách hiệu quả =====
  const theoNguon = useMemo(() => {
    const m = {}
    for (const c of customers) {
      const k = c.nguon_khach || 'khac'
      m[k] = m[k] || { tong: 0, chot: 0 }
      m[k].tong += 1
      if (['da_ky', 'dang_trien_khai'].includes(c.trang_thai_cham_soc)) m[k].chot += 1
    }
    return Object.entries(m)
      .map(([k, v]) => ({ nguon: labelOf(NGUON_KHACH_OPTIONS, k), ...v, tiLe: v.tong ? Math.round((v.chot / v.tong) * 100) : 0 }))
      .sort((a, b) => b.tiLe - a.tiLe)
  }, [customers])

  // ===== Khách bị bỏ quên =====
  const boQuen = useMemo(() => {
    const gioiHan = new Date()
    gioiHan.setDate(gioiHan.getDate() - NGAY_BO_QUEN)
    const gh = gioiHan.toISOString().slice(0, 10)
    return customers
      .filter((c) => ['khong_nghe_may', 'dang_tu_van'].includes(c.trang_thai_cham_soc))
      .map((c) => {
        const lan = c.ngay_lien_he_gan_nhat || (c.created_at || '').slice(0, 10)
        return { ...c, lan, soNgay: Math.floor((Date.now() - new Date(lan).getTime()) / 86400000) }
      })
      .filter((c) => c.lan <= gh)
      .sort((a, b) => b.soNgay - a.soNgay)
      .slice(0, 12)
  }, [customers])

  // ===== Tốc độ chốt =====
  const tocDoChot = useMemo(() => {
    const ngay = []
    for (const o of orders) {
      const c = customers.find((x) => x.id === o.customer_id)
      if (!c?.created_at || !o.ngay_chot) continue
      const d = Math.floor((new Date(o.ngay_chot) - new Date(c.created_at)) / 86400000)
      if (d >= 0) ngay.push(d)
    }
    if (!ngay.length) return null
    return Math.round(ngay.reduce((a, b) => a + b, 0) / ngay.length)
  }, [orders, customers])

  const maxPheu = pheu[0]?.so || 1

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-8 py-5">
        <div>
          <h1 className="font-display text-xl font-bold text-navy-900">Báo cáo</h1>
          <p className="text-sm text-ink-600">Phễu chuyển đổi, hiệu suất sale và chất lượng nguồn khách</p>
        </div>
        <Select value={ky} onChange={(e) => setKy(e.target.value)} className="w-44">
          <option value="7">7 ngày qua</option>
          <option value="30">30 ngày qua</option>
          <option value="90">90 ngày qua</option>
          <option value="all">Toàn bộ</option>
        </Select>
      </header>

      {loading ? (
        <p className="py-16 text-center text-ink-400">Đang tải...</p>
      ) : (
        <div className="space-y-4 p-8">
          <Panel title="Phễu chuyển đổi">
            <div className="space-y-3">
              {pheu.map((b, i) => {
                const truoc = i > 0 ? pheu[i - 1].so : null
                const tiLe = truoc ? Math.round((b.so / truoc) * 100) : 100
                return (
                  <div key={b.ten}>
                    <div className="mb-1 flex items-baseline justify-between text-sm">
                      <span className="font-medium text-navy-900">{b.ten}</span>
                      <span className="text-ink-600">
                        <b className="text-navy-900">{b.so}</b>
                        {truoc !== null && <span className={tiLe < 40 ? 'ml-2 text-rose-500' : 'ml-2 text-ink-400'}>({tiLe}% bước trước)</span>}
                      </span>
                    </div>
                    <div className="h-7 overflow-hidden rounded-lg bg-slate-100">
                      <div className="h-full rounded-lg bg-coral-500 transition-all"
                        style={{ width: `${Math.max((b.so / maxPheu) * 100, b.so ? 4 : 0)}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="mt-3 text-xs text-ink-400">
              Bước nào tụt mạnh nhất là chỗ team đang tắc. Dưới 40% so với bước trước thì hiện màu đỏ.
            </p>
          </Panel>

          <div className="grid grid-cols-2 gap-4">
            <Panel title="Hiệu suất từng sale">
              {hieuSuat.length === 0 ? <Empty /> : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-ink-400">
                      <th className="pb-2">Sale</th>
                      <th className="pb-2 text-right">Đang giữ</th>
                      <th className="pb-2 text-right">Lượt CS</th>
                      <th className="pb-2 text-right">Tỉ lệ chốt</th>
                      <th className="pb-2 text-right">Doanh số</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hieuSuat.map((s) => (
                      <tr key={s.id} className="border-t border-slate-50">
                        <td className="py-2.5 font-medium text-navy-900">{s.ten}</td>
                        <td className="py-2.5 text-right text-ink-600">{s.dangGiu}</td>
                        <td className="py-2.5 text-right text-ink-600">{s.chamSoc}</td>
                        <td className="py-2.5 text-right">
                          <span className={s.tiLe >= 20 ? 'text-emerald-600' : 'text-ink-600'}>{s.tiLe}%</span>
                        </td>
                        <td className="py-2.5 text-right font-medium text-navy-900">{formatVnd(s.doanhSo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <p className="mt-3 text-xs text-ink-400">Lượt CS = số lần ghi lịch sử chăm sóc trong kỳ.</p>
            </Panel>

            <Panel title="Nguồn khách nào hiệu quả">
              {theoNguon.length === 0 ? <Empty /> : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-ink-400">
                      <th className="pb-2">Nguồn</th>
                      <th className="pb-2 text-right">Số khách</th>
                      <th className="pb-2 text-right">Đã chốt</th>
                      <th className="pb-2 text-right">Tỉ lệ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {theoNguon.map((n) => (
                      <tr key={n.nguon} className="border-t border-slate-50">
                        <td className="py-2.5 font-medium text-navy-900">{n.nguon}</td>
                        <td className="py-2.5 text-right text-ink-600">{n.tong}</td>
                        <td className="py-2.5 text-right text-ink-600">{n.chot}</td>
                        <td className="py-2.5 text-right font-medium text-emerald-600">{n.tiLe}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <p className="mt-3 text-xs text-ink-400">Nguồn có tỉ lệ chốt cao là nơi nên đổ thêm nguồn lực.</p>
            </Panel>
          </div>

          <Panel title={`Khách bị bỏ quên (quá ${NGAY_BO_QUEN} ngày chưa liên hệ lại)`}>
            {boQuen.length === 0 ? (
              <p className="py-6 text-center text-sm text-emerald-600">Không có khách nào bị bỏ quên. Team đang bám sát tốt.</p>
            ) : (
              <>
                <div className="mb-3 flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
                  <AlertTriangle size={16} />
                  {boQuen.length} khách sắp hoặc đã rơi vào nhóm khách chung, sale khác có thể nhận mất.
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-ink-400">
                      <th className="pb-2">Khách hàng</th>
                      <th className="pb-2">Trạng thái</th>
                      <th className="pb-2">Sale</th>
                      <th className="pb-2 text-right">Số ngày im lặng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {boQuen.map((c) => (
                      <tr key={c.id} className="border-t border-slate-50">
                        <td className="py-2.5">
                          <p className="font-medium text-navy-900">{c.ten_khach}</p>
                          <p className="text-xs text-ink-400">{c.ma_khach}</p>
                        </td>
                        <td className="py-2.5">
                          <Badge className={classOf(TRANG_THAI_OPTIONS, c.trang_thai_cham_soc)}>
                            {labelOf(TRANG_THAI_OPTIONS, c.trang_thai_cham_soc)}
                          </Badge>
                        </td>
                        <td className="py-2.5 text-ink-600">{tenSale(c.sale_id)}</td>
                        <td className="py-2.5 text-right font-medium text-rose-500">{c.soNgay} ngày</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </Panel>

          <Panel title="Tốc độ chốt trung bình">
            {tocDoChot === null ? <Empty /> : (
              <div className="flex items-baseline gap-3">
                <span className="font-display text-4xl font-bold text-coral-500">{tocDoChot}</span>
                <span className="text-ink-600">ngày từ lúc khách vào data đến khi chốt đơn</span>
              </div>
            )}
          </Panel>
        </div>
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
