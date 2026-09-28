import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { Select, Badge, Input } from './ui'
import { NGUON_KHACH_OPTIONS, laDataDuocChia, labelOf, formatVnd, giaTruocVat } from '../lib/constants'
import { useTrangThai } from '../lib/StatusContext'
import { khoangNgay } from '../lib/doanhSo'

const NGAY_BO_QUEN = 7

const pad = (n) => String(n).padStart(2, '0')
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

// Khoảng ngày [từ, đến] theo lựa chọn kỳ ('' = không giới hạn)
function khoangKy(ky, tu, den) {
  const d = new Date()
  if (ky === 'hom_nay') return [ymd(d), ymd(d)]
  if (ky === 'tuan_nay') {
    const thu = (d.getDay() + 6) % 7 // thứ 2 = 0
    d.setDate(d.getDate() - thu)
    return [ymd(d), '']
  }
  if (ky === '30' || ky === '90') { d.setDate(d.getDate() - Number(ky)); return [ymd(d), ''] }
  if (ky === 'all') return ['', '']
  return khoangNgay(ky, tu, den)   // tháng này/trước, quý này, năm nay, chọn ngày
}

export default function AnalyticsPage() {
  const { options: TRANG_THAI, tenTrangThai, classTrangThai, maDaChot } = useTrangThai()
  const [customers, setCustomers] = useState([])
  const [orders, setOrders] = useState([])
  const [interactions, setInteractions] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [ky, setKy] = useState('thang_nay')
  const [tu, setTu] = useState('')
  const [den, setDen] = useState('')
  const [filterSale, setFilterSale] = useState('')

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

  const [tuNgay, denNgay] = useMemo(() => khoangKy(ky, tu, den), [ky, tu, den])
  const tenSale = (id) => profiles.find((p) => p.id === id)?.full_name || 'Chưa gán'
  const trongKy = (d) => {
    const x = (d || '').slice(0, 10)
    return !!x && (!tuNgay || x >= tuNgay) && (!denNgay || x <= denNgay)
  }

  // Áp bộ lọc sale cho toàn bộ báo cáo
  const khachLoc = useMemo(() => customers.filter((c) => !filterSale || c.sale_id === filterSale), [customers, filterSale])
  const donLoc = useMemo(() => orders.filter((o) => !filterSale || o.sale_id === filterSale), [orders, filterSale])

  // Khách phát sinh trong kỳ
  const khachTrongKy = useMemo(
    () => khachLoc.filter((c) => trongKy(c.created_at)),
    [khachLoc, tuNgay, denNgay]
  )

  // ===== Phễu: mỗi khách chỉ nằm ở ĐÚNG MỘT bước theo trạng thái hiện tại =====
  const pheu = useMemo(() => {
    const buoc = TRANG_THAI.map((b) => ({
      value: b.ma, label: b.ten, mau: b.mau,
      so: khachTrongKy.filter((c) => c.trang_thai_cham_soc === b.ma).length,
    }))
    return { buoc, tong: khachTrongKy.length }
  }, [khachTrongKy, TRANG_THAI])

  // ===== Chỉ số theo sale trong kỳ =====
  const theoSale = useMemo(() => {
    const m = {}
    const co = (id) => { if (!m[id]) m[id] = { dataChia: 0, dataTuNhap: 0, tuVan: 0, chot: 0, luotCS: 0, doanhSo: 0, dangGiu: 0 } }

    for (const c of customers) {
      if (!c.sale_id) continue
      co(c.sale_id)
      m[c.sale_id].dangGiu += 1
      if (trongKy(c.created_at)) {
        if (laDataDuocChia(c)) {
          m[c.sale_id].dataChia += 1
          // Chỉ số chuyển đổi chỉ tính trên data được chia, cho khách quan
          if (c.trang_thai_cham_soc === 'dang_tu_van' || maDaChot.includes(c.trang_thai_cham_soc)) {
            m[c.sale_id].tuVan += 1
          }
        } else {
          m[c.sale_id].dataTuNhap += 1
        }
      }
    }
    for (const it of interactions) {
      if (!it.sale_id || !trongKy(it.ngay_thuc_hien)) continue
      co(it.sale_id); m[it.sale_id].luotCS += 1
    }
    for (const o of orders) {
      if (!o.sale_id || !trongKy(o.ngay_chot)) continue
      co(o.sale_id); m[o.sale_id].chot += 1; m[o.sale_id].doanhSo += giaTruocVat(o.gia_tri)
    }

    return Object.entries(m)
      .map(([id, v]) => ({
        id, ten: tenSale(id), ...v,
        tiLe: v.dataChia ? Math.round((v.tuVan / v.dataChia) * 100) : null,
      }))
      .filter((r) => !filterSale || r.id === filterSale)
      .sort((a, b) => b.doanhSo - a.doanhSo || b.chot - a.chot)
  }, [customers, interactions, orders, profiles, tuNgay, denNgay, filterSale, maDaChot])

  // Dòng TỔNG của bảng chỉ số từng sale
  const tongSale = useMemo(() => {
    const t = theoSale.reduce((s, r) => ({
      dataChia: s.dataChia + r.dataChia, dataTuNhap: s.dataTuNhap + r.dataTuNhap, tuVan: s.tuVan + r.tuVan,
      luotCS: s.luotCS + r.luotCS, chot: s.chot + r.chot, doanhSo: s.doanhSo + r.doanhSo,
    }), { dataChia: 0, dataTuNhap: 0, tuVan: 0, luotCS: 0, chot: 0, doanhSo: 0 })
    return { ...t, tiLe: t.dataChia ? Math.round((t.tuVan / t.dataChia) * 100) : null }
  }, [theoSale])

  // ===== Chỉ số theo từng NGUỒN data (Giới thiệu / Tự tìm kiếm / Marketing / Khác) =====
  const theoNguon = useMemo(() => {
    const nguonCua = (c) => (NGUON_KHACH_OPTIONS.some((n) => n.value === c?.nguon_khach) ? c.nguon_khach : 'khac')
    const m = {}
    for (const n of NGUON_KHACH_OPTIONS) m[n.value] = { nguon: n.value, dataVao: 0, tuVan: 0, daChot: 0, donChot: 0, doanhSo: 0 }
    for (const c of khachTrongKy) {
      const r = m[nguonCua(c)]
      r.dataVao += 1
      if (c.trang_thai_cham_soc === 'dang_tu_van' || maDaChot.includes(c.trang_thai_cham_soc)) r.tuVan += 1
      if (maDaChot.includes(c.trang_thai_cham_soc)) r.daChot += 1
    }
    // Đơn chốt / doanh số trong kỳ tính theo nguồn của khách đã mua
    const khachTheoId = new Map(customers.map((c) => [c.id, c]))
    for (const o of donLoc) {
      if (!trongKy(o.ngay_chot)) continue
      const r = m[nguonCua(khachTheoId.get(o.customer_id))]
      r.donChot += 1
      r.doanhSo += giaTruocVat(o.gia_tri)
    }
    const ds = Object.values(m).map((r) => ({
      ...r,
      tiLeTuVan: r.dataVao ? Math.round((r.tuVan / r.dataVao) * 100) : null,
      tiLeChot: r.dataVao ? Math.round((r.daChot / r.dataVao) * 100) : null,
    }))
    const tong = ds.reduce((s, r) => ({
      dataVao: s.dataVao + r.dataVao, tuVan: s.tuVan + r.tuVan, daChot: s.daChot + r.daChot,
      donChot: s.donChot + r.donChot, doanhSo: s.doanhSo + r.doanhSo,
    }), { dataVao: 0, tuVan: 0, daChot: 0, donChot: 0, doanhSo: 0 })
    tong.tiLeTuVan = tong.dataVao ? Math.round((tong.tuVan / tong.dataVao) * 100) : null
    tong.tiLeChot = tong.dataVao ? Math.round((tong.daChot / tong.dataVao) * 100) : null
    return { ds, tong }
  }, [khachTrongKy, customers, donLoc, tuNgay, denNgay, maDaChot])

  // ===== Ma trận nguồn × sale =====
  const maTran = useMemo(() => {
    const khachChia = khachTrongKy.filter(laDataDuocChia)
    const saleIds = [...new Set(khachChia.map((c) => c.sale_id).filter(Boolean))]
    const nguons = NGUON_KHACH_OPTIONS.map((n) => n.value)
    const bang = saleIds.map((sid) => {
      const o = { id: sid, ten: tenSale(sid), cot: {}, tong: 0, tongChot: 0 }
      for (const n of nguons) {
        const ds = khachChia.filter((c) => c.sale_id === sid && (c.nguon_khach || 'khac') === n)
        const chot = ds.filter((c) => maDaChot.includes(c.trang_thai_cham_soc)).length
        o.cot[n] = { tong: ds.length, chot }
        o.tong += ds.length
        o.tongChot += chot
      }
      return o
    }).filter((r) => r.tong > 0).sort((a, b) => b.tong - a.tong)
    return { nguons, bang }
  }, [khachTrongKy, profiles, maDaChot])

  // ===== Khách bị bỏ quên =====
  const boQuen = useMemo(() => {
    const g = new Date(); g.setDate(g.getDate() - NGAY_BO_QUEN)
    const gh = g.toISOString().slice(0, 10)
    return khachLoc
      .filter((c) => ['khong_nghe_may', 'dang_tu_van'].includes(c.trang_thai_cham_soc))
      .map((c) => {
        const lan = c.ngay_lien_he_gan_nhat || (c.created_at || '').slice(0, 10)
        return { ...c, lan, soNgay: Math.floor((Date.now() - new Date(lan).getTime()) / 86400000) }
      })
      .filter((c) => c.lan <= gh)
      .sort((a, b) => b.soNgay - a.soNgay)
      .slice(0, 12)
  }, [khachLoc])

  // ===== Tốc độ chốt =====
  const tocDoChot = useMemo(() => {
    const ds = []
    for (const o of donLoc) {
      const c = customers.find((x) => x.id === o.customer_id)
      if (!c?.created_at || !o.ngay_chot) continue
      const d = Math.floor((new Date(o.ngay_chot) - new Date(c.created_at)) / 86400000)
      if (d >= 0) ds.push(d)
    }
    return ds.length ? Math.round(ds.reduce((a, b) => a + b, 0) / ds.length) : null
  }, [donLoc, customers])

  const maxPheu = Math.max(...pheu.buoc.map((b) => b.so), 1)

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="border-b border-slate-200 bg-white px-8 py-5">
        <h1 className="font-display text-xl font-bold text-navy-900">Hiệu suất Sale</h1>
        <p className="text-sm text-ink-600">Phễu chuyển đổi, chỉ số từng sale và chất lượng từng nguồn data</p>
      </header>

      <div className="mx-8 mt-6 flex flex-wrap items-end gap-3 rounded-2xl bg-white p-4 shadow-sm">
        <Select label="Thời gian" value={ky} onChange={(e) => setKy(e.target.value)} className="w-44">
          <option value="hom_nay">Hôm nay</option>
          <option value="tuan_nay">Tuần này</option>
          <option value="thang_nay">Tháng này</option>
          <option value="thang_truoc">Tháng trước</option>
          <option value="quy_nay">Quý này</option>
          <option value="30">30 ngày qua</option>
          <option value="90">90 ngày qua</option>
          <option value="nam_nay">Năm nay</option>
          <option value="all">Toàn bộ</option>
          <option value="tuy_chon">Chọn ngày...</option>
        </Select>
        {ky === 'tuy_chon' && (
          <>
            <Input label="Từ ngày" type="date" value={tu} onChange={(e) => setTu(e.target.value)} />
            <Input label="Đến ngày" type="date" value={den} onChange={(e) => setDen(e.target.value)} />
          </>
        )}
        <Select label="Sale" value={filterSale} onChange={(e) => setFilterSale(e.target.value)} className="w-52">
          <option value="">Tất cả sale</option>
          {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
        </Select>
      </div>

      {loading ? (
        <p className="py-16 text-center text-ink-400">Đang tải...</p>
      ) : (
        <div className="space-y-4 p-8">
          <Panel title="Phễu chuyển đổi">
            <div className="mb-3 flex items-baseline gap-2">
              <span className="font-display text-2xl font-bold text-navy-900">{pheu.tong}</span>
              <span className="text-sm text-ink-600">khách vào data trong kỳ</span>
            </div>
            <div className="space-y-3">
              {pheu.buoc.map((b) => {
                const pct = pheu.tong ? Math.round((b.so / pheu.tong) * 100) : 0
                return (
                  <div key={b.value}>
                    <div className="mb-1 flex items-baseline justify-between text-sm">
                      <span className="font-medium text-navy-900">{b.label}</span>
                      <span className="text-ink-600">
                        <b className="text-navy-900">{b.so}</b>
                        <span className="ml-2 text-ink-400">({pct}%)</span>
                      </span>
                    </div>
                    <div className="h-7 overflow-hidden rounded-lg bg-slate-100">
                      <div className="h-full rounded-lg bg-coral-500 transition-all"
                        style={{ width: `${b.so ? Math.max((b.so / maxPheu) * 100, 4) : 0}%` }} />
                    </div>
                  </div>
                )
              })}

            </div>
            <p className="mt-3 text-xs text-ink-400">
              Mỗi khách chỉ nằm ở đúng một bước theo trạng thái hiện tại, không cộng dồn — tổng các bước bằng số data vào.
              Khách ùn ở bước nào thì đó là chỗ team đang tắc.
            </p>
          </Panel>

          <Panel title="Chỉ số từng sale trong kỳ">
            {theoSale.length === 0 ? <Empty /> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-ink-400">
                      <th className="pb-2">Sale</th>
                      <th className="pb-2 text-right">Data được chia</th>
                      <th className="pb-2 text-right font-normal normal-case text-ink-400">Tự nhập</th>
                      <th className="pb-2 text-right">Vào tư vấn</th>
                      <th className="pb-2 text-right">Lượt CS</th>
                      <th className="pb-2 text-right">Đơn chốt</th>
                      <th className="pb-2 text-right">Tỉ lệ tư vấn</th>
                      <th className="pb-2 text-right">Doanh số (chưa VAT)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {theoSale.map((s) => (
                      <tr key={s.id} className="border-t border-slate-50">
                        <td className="py-2.5 font-medium text-navy-900">{s.ten}</td>
                        <td className="py-2.5 text-right font-medium text-navy-900">{s.dataChia}</td>
                        <td className="py-2.5 text-right text-ink-400">{s.dataTuNhap || '—'}</td>
                        <td className="py-2.5 text-right text-ink-600">{s.tuVan}</td>
                        <td className="py-2.5 text-right text-ink-600">{s.luotCS}</td>
                        <td className="py-2.5 text-right font-medium text-navy-900">{s.chot}</td>
                        <td className="py-2.5 text-right">
                          {s.tiLe === null
                            ? <span className="text-ink-400">—</span>
                            : <span className={s.tiLe >= 30 ? 'text-emerald-600' : 'text-ink-600'}>{s.tiLe}%</span>}
                        </td>
                        <td className="py-2.5 text-right font-medium text-navy-900">{formatVnd(s.doanhSo)}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-slate-200 bg-indigo-50 font-bold text-indigo-700">
                      <td className="py-2.5 pl-2">TỔNG</td>
                      <td className="py-2.5 text-right">{tongSale.dataChia}</td>
                      <td className="py-2.5 text-right">{tongSale.dataTuNhap || '—'}</td>
                      <td className="py-2.5 text-right">{tongSale.tuVan}</td>
                      <td className="py-2.5 text-right">{tongSale.luotCS}</td>
                      <td className="py-2.5 text-right">{tongSale.chot}</td>
                      <td className="py-2.5 text-right">{tongSale.tiLe === null ? '—' : `${tongSale.tiLe}%`}</td>
                      <td className="py-2.5 pr-2 text-right">{formatVnd(tongSale.doanhSo)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-3 text-xs text-ink-400">
              <b>Data được chia</b> chỉ tính khách do người khác giao cho sale — khách sale tự nhập hoặc tự nhận từ data chung
              không được tính, để so sánh giữa các sale cho công bằng. Tỉ lệ tư vấn cũng tính trên riêng phần data được chia.
              Lượt CS = số lần ghi lịch sử chăm sóc. Đơn chốt và doanh số lấy theo ngày chốt đơn.
            </p>
          </Panel>

          <Panel title="Chỉ số theo từng nguồn data">
            {theoNguon.tong.dataVao === 0 && theoNguon.tong.donChot === 0 ? <Empty /> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-ink-400">
                      <th className="pb-2">Nguồn data</th>
                      <th className="pb-2 text-right">Data vào</th>
                      <th className="pb-2 text-right">Vào tư vấn</th>
                      <th className="pb-2 text-right">Đã chốt HĐ</th>
                      <th className="pb-2 text-right">Tỉ lệ tư vấn</th>
                      <th className="pb-2 text-right">Tỉ lệ chốt</th>
                      <th className="pb-2 text-right">Đơn chốt</th>
                      <th className="pb-2 text-right">Doanh số (chưa VAT)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {theoNguon.ds.map((r) => (
                      <tr key={r.nguon} className="border-t border-slate-50">
                        <td className="py-2.5 font-medium text-navy-900">{labelOf(NGUON_KHACH_OPTIONS, r.nguon)}</td>
                        <td className="py-2.5 text-right text-ink-600">{r.dataVao}</td>
                        <td className="py-2.5 text-right text-ink-600">{r.tuVan}</td>
                        <td className="py-2.5 text-right text-ink-600">{r.daChot}</td>
                        <td className="py-2.5 text-right text-ink-600">{r.tiLeTuVan === null ? '—' : `${r.tiLeTuVan}%`}</td>
                        <td className="py-2.5 text-right">
                          {r.tiLeChot === null ? <span className="text-ink-400">—</span>
                            : <span className={r.tiLeChot >= 20 ? 'text-emerald-600' : 'text-ink-600'}>{r.tiLeChot}%</span>}
                        </td>
                        <td className="py-2.5 text-right text-ink-600">{r.donChot}</td>
                        <td className="py-2.5 text-right font-medium text-navy-900">{formatVnd(r.doanhSo)}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-slate-200 bg-indigo-50 font-bold text-indigo-700">
                      <td className="py-2.5 pl-2">TỔNG</td>
                      <td className="py-2.5 text-right">{theoNguon.tong.dataVao}</td>
                      <td className="py-2.5 text-right">{theoNguon.tong.tuVan}</td>
                      <td className="py-2.5 text-right">{theoNguon.tong.daChot}</td>
                      <td className="py-2.5 text-right">{theoNguon.tong.tiLeTuVan === null ? '—' : `${theoNguon.tong.tiLeTuVan}%`}</td>
                      <td className="py-2.5 text-right">{theoNguon.tong.tiLeChot === null ? '—' : `${theoNguon.tong.tiLeChot}%`}</td>
                      <td className="py-2.5 text-right">{theoNguon.tong.donChot}</td>
                      <td className="py-2.5 pr-2 text-right">{formatVnd(theoNguon.tong.doanhSo)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-3 text-xs text-ink-400">
              <b>Data vào</b> = khách được tạo trong kỳ, tính cả data được chia và data sale tự nhập. <b>Vào tư vấn</b> = đang tư vấn hoặc đã chốt.
              <b> Tỉ lệ tư vấn / chốt</b> tính trên data vào. <b>Đơn chốt và doanh số</b> lấy theo ngày chốt đơn, tính theo nguồn của khách đã mua.
            </p>
          </Panel>

          <Panel title="Nguồn khách theo từng sale">
            {maTran.bang.length === 0 ? <Empty /> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-ink-400">
                      <th className="pb-2">Sale</th>
                      {maTran.nguons.map((n) => (
                        <th key={n} className="pb-2 text-right">{labelOf(NGUON_KHACH_OPTIONS, n)}</th>
                      ))}
                      <th className="pb-2 text-right">Tổng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {maTran.bang.map((r) => (
                      <tr key={r.id} className="border-t border-slate-50">
                        <td className="py-2.5 font-medium text-navy-900">{r.ten}</td>
                        {maTran.nguons.map((n) => (
                          <td key={n} className="py-2.5 text-right">
                            {r.cot[n].tong === 0 ? <span className="text-ink-400">—</span> : (
                              <span className="text-ink-600">
                                {r.cot[n].tong}
                                {r.cot[n].chot > 0 && <b className="ml-1 text-emerald-600">({r.cot[n].chot} chốt)</b>}
                              </span>
                            )}
                          </td>
                        ))}
                        <td className="py-2.5 text-right font-medium text-navy-900">
                          {r.tong}
                          {r.tongChot > 0 && <b className="ml-1 text-emerald-600">({r.tongChot})</b>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-3 text-xs text-ink-400">
              Chỉ tính data được chia. Số đầu là lượng khách nhận từ nguồn đó, số trong ngoặc màu xanh là số đã ký hợp đồng.
              Giúp biết mỗi sale mạnh ở nguồn nào để chia data cho đúng người.
            </p>
          </Panel>

          <Panel title={`Khách bị bỏ quên (quá ${NGAY_BO_QUEN} ngày chưa liên hệ lại)`}>
            {boQuen.length === 0 ? (
              <p className="py-6 text-center text-sm text-emerald-600">Không có khách nào bị bỏ quên. Team đang bám sát tốt.</p>
            ) : (
              <>
                <div className="mb-3 flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
                  <AlertTriangle size={16} />
                  {boQuen.length} khách sắp hoặc đã rơi vào nhóm data chung, sale khác có thể nhận mất.
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
                          <Badge className={classTrangThai(c.trang_thai_cham_soc)}>
                            {tenTrangThai(c.trang_thai_cham_soc)}
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
