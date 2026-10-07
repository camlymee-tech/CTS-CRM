import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useTrangThai } from '../lib/StatusContext'
import { NGUON_KHACH_OPTIONS, formatVnd, giaTruocVat } from '../lib/constants'
import { khoangNgay } from '../lib/doanhSo'
import { ngayLocal } from '../lib/danhSachKhach'
import { Select, Input } from './ui'

const KY = [
  { key: 'thang_nay', label: 'Tháng này' },
  { key: 'thang_truoc', label: 'Tháng trước' },
  { key: 'quy_nay', label: 'Quý này' },
  { key: 'nam_nay', label: 'Năm nay' },
  { key: 'tat_ca', label: 'Tất cả' },
  { key: 'tuy_chon', label: 'Chọn ngày' },
]

// Mỗi nguồn 1 màu cố định để nhìn là nhận ra
const MAU = [
  { cham: 'bg-coral-500', chu: 'text-coral-500', thanh: 'bg-coral-500', nhat: 'bg-coral-50' },
  { cham: 'bg-teal-500', chu: 'text-teal-500', thanh: 'bg-teal-500', nhat: 'bg-teal-50' },
  { cham: 'bg-indigo-500', chu: 'text-indigo-500', thanh: 'bg-indigo-500', nhat: 'bg-indigo-50' },
  { cham: 'bg-amber-500', chu: 'text-amber-500', thanh: 'bg-amber-500', nhat: 'bg-amber-50' },
  { cham: 'bg-violet-500', chu: 'text-violet-500', thanh: 'bg-violet-500', nhat: 'bg-violet-50' },
  { cham: 'bg-slate-400', chu: 'text-slate-400', thanh: 'bg-slate-400', nhat: 'bg-slate-100' },
]

const ngayHienThi = (s) => (s ? s.split('-').reverse().join('/') : '')
const phanTram = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0)
const so1 = (n) => String(Math.round(n * 10) / 10).replace('.', ',')

// 11.741.000 -> "11.741.000đ"; số lẻ được làm tròn đến hàng nghìn
function rutGon(n) {
  return `${(Math.round((n || 0) / 1000) * 1000).toLocaleString('vi-VN')}đ`
}

const chuCai = (ten) => (ten || '?').trim().split(/\s+/).slice(-2).map((t) => t[0]).join('').toUpperCase()

export default function ChuyenDoiNguonPage() {
  const { maDaChot, maHoanHuy, loaded } = useTrangThai()
  const [customers, setCustomers] = useState([])
  const [orders, setOrders] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [ky, setKy] = useState('thang_nay')
  const [tu, setTu] = useState('')
  const [den, setDen] = useState('')
  const [filterSale, setFilterSale] = useState('')
  const [nguonChon, setNguonChon] = useState('')

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

  const doanhSoKhach = useMemo(() => {
    const m = {}
    const huyKhach = new Set(customers.filter((c) => maHoanHuy.includes(c.trang_thai_cham_soc)).map((c) => c.id))
    for (const o of orders) {
      if (o.trang_thai === 'huy' || !o.customer_id || huyKhach.has(o.customer_id)) continue
      m[o.customer_id] = (m[o.customer_id] || 0) + giaTruocVat(o.gia_tri)
    }
    return m
  }, [orders, customers, maHoanHuy])

  const customersLoc = useMemo(() => customers.filter((c) => {
    if (filterSale === 'chua_gan' ? c.sale_id : filterSale && c.sale_id !== filterSale) return false
    const ng = ngayLocal(c.created_at)
    if (tuNgay && ng < tuNgay) return false
    if (denNgay && ng > denNgay) return false
    return true
  }), [customers, filterSale, tuNgay, denNgay])

  const { theoNguon, tong } = useMemo(() => {
    const moi = () => ({ data: 0, chot: 0, tien: 0 })
    const nguon = {}
    const t = moi()
    const nhan = (v) => NGUON_KHACH_OPTIONS.find((o) => o.value === v)?.label
    for (const c of customersLoc) {
      const key = nhan(c.nguon_khach) ? c.nguon_khach : '_khac'
      if (!nguon[key]) nguon[key] = { key, ten: nhan(key) || 'Chưa xác định', ...moi(), sale: {} }
      const sid = c.sale_id || 'chua_gan'
      if (!nguon[key].sale[sid]) nguon[key].sale[sid] = moi()
      const chot = maDaChot.includes(c.trang_thai_cham_soc) ? 1 : 0
      const tien = doanhSoKhach[c.id] || 0
      for (const x of [nguon[key], nguon[key].sale[sid], t]) { x.data += 1; x.chot += chot; x.tien += tien }
    }
    const ds = Object.values(nguon).map((n, i) => ({
      ...n,
      sales: Object.entries(n.sale).map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => phanTram(b.chot, b.data) - phanTram(a.chot, a.data) || b.data - a.data),
    })).sort((a, b) => b.data - a.data).map((n, i) => ({ ...n, mau: MAU[i % MAU.length] }))
    return { theoNguon: ds, tong: t }
  }, [customersLoc, maDaChot, doanhSoKhach])

  const nguonDangXem = theoNguon.find((n) => n.key === nguonChon) || theoNguon[0]

  // Câu nhận xét ngắn để đọc nhanh
  const nhanXet = useMemo(() => {
    if (theoNguon.length === 0) return ''
    const dongDu = theoNguon.filter((n) => n.data >= 3)
    const tot = [...dongDu].sort((a, b) => phanTram(b.chot, b.data) - phanTram(a.chot, a.data))[0]
    const giau = [...theoNguon].sort((a, b) => (b.data ? b.tien / b.data : 0) - (a.data ? a.tien / a.data : 0))[0]
    const parts = []
    if (tot) parts.push(`${tot.ten} chốt tốt nhất (${phanTram(tot.chot, tot.data)}%)`)
    if (giau && giau.tien > 0) parts.push(`${giau.ten} mang về nhiều nhất trên mỗi data (${rutGon(giau.tien / giau.data)})`)
    return parts.join(' · ')
  }, [theoNguon])

  const moTaKy = ky === 'tat_ca' ? 'Tất cả thời gian' : `${ngayHienThi(tuNgay) || '...'} – ${ngayHienThi(denNgay) || '...'}`

  return (
    <div className="flex-1 overflow-y-auto bg-bg">
      <header className="border-b border-slate-200 bg-white px-4 py-5 sm:px-8">
        <h1 className="font-display text-xl font-bold text-navy-900">Chuyển đổi nguồn khách</h1>
        <p className="mt-0.5 text-sm text-ink-600">Nguồn nào chốt tốt, mỗi data mang về bao nhiêu, và sale nào nên nhận thêm data.</p>
      </header>

      <div className="space-y-5 px-4 py-6 sm:px-8">
        {/* Bộ lọc */}
        <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
          <div>
            <p className="mb-1.5 text-sm font-medium text-navy-900">Ngày tạo khách</p>
            <div className="inline-flex flex-wrap gap-1 rounded-xl bg-slate-200/60 p-1">
              {KY.map((k) => (
                <button key={k.key} type="button" onClick={() => setKy(k.key)}
                  className={`rounded-lg px-3 py-1.5 text-sm transition ${
                    ky === k.key ? 'bg-white font-semibold text-navy-900 shadow-sm' : 'text-ink-600 hover:text-navy-900'}`}>
                  {k.label}
                </button>
              ))}
            </div>
          </div>
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
          <p className="pb-2.5 text-xs text-ink-400">{moTaKy} · doanh số chưa VAT, trừ đơn huỷ</p>
        </div>

        {(loading || !loaded) ? (
          <p className="py-16 text-center text-ink-400">Đang tải...</p>
        ) : theoNguon.length === 0 ? (
          <div className="rounded-2xl bg-white py-16 text-center shadow-sm">
            <p className="font-medium text-navy-900">Chưa có khách nào trong bộ lọc này</p>
            <p className="mt-1 text-sm text-ink-400">Thử chọn khoảng thời gian dài hơn hoặc bỏ lọc sale.</p>
          </div>
        ) : (
          <>
            {/* Chỉ số tổng — một thanh liền, nhìn lướt là hiểu */}
            <div className="grid grid-cols-2 divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-sm sm:grid-cols-3 sm:divide-y-0 lg:grid-cols-5 lg:divide-x">
              <Kpi nhan="Data nhận" giaTri={tong.data} />
              <Kpi nhan="Đã chốt" giaTri={tong.chot} chu="text-teal-500" />
              <Kpi nhan="Tỷ lệ chốt" giaTri={`${so1(phanTram(tong.chot, tong.data))}%`} chu="text-coral-500" lon />
              <Kpi nhan="Doanh số mang về" giaTri={rutGon(tong.tien)} tip={formatVnd(tong.tien)} chu="text-indigo-700" />
              <Kpi nhan="Giá trị mỗi data" giaTri={rutGon(tong.data ? tong.tien / tong.data : 0)}
                tip={formatVnd(Math.round(tong.data ? tong.tien / tong.data : 0))} chu="text-indigo-700" lon />
            </div>
            {nhanXet && <p className="text-sm text-ink-600">{nhanXet}</p>}

            {/* Tỷ trọng: data đến từ đâu so với tiền đến từ đâu */}
            <div className="grid gap-4 lg:grid-cols-2">
              <TyTrong tieuDe="Data đến từ nguồn nào" ds={theoNguon} lay={(n) => n.data} dinhDang={(v) => `${v} data`} />
              <TyTrong tieuDe="Doanh số đến từ nguồn nào" ds={theoNguon} lay={(n) => n.tien} dinhDang={rutGon} />
            </div>

            {/* Mỗi nguồn 1 thẻ */}
            <section>
              <h2 className="mb-3 font-display text-base font-semibold text-navy-900">Các nguồn data</h2>
              <div className="overflow-x-auto pb-1">
              <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${theoNguon.length}, minmax(220px, 1fr))` }}>
                {theoNguon.map((n) => {
                  const tyLe = phanTram(n.chot, n.data)
                  return (
                    <button key={n.key} type="button" onClick={() => setNguonChon(n.key)}
                      className={`rounded-2xl bg-white p-5 text-left shadow-sm outline-none transition hover:shadow-md focus-visible:ring-2 focus-visible:ring-coral-500 ${
                        nguonDangXem?.key === n.key ? 'ring-2 ring-navy-900/80' : 'ring-1 ring-slate-100'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`h-2.5 w-2.5 rounded-full ${n.mau.cham}`} />
                          <span className="font-semibold text-navy-900">{n.ten}</span>
                        </div>
                        <span className="text-xs text-ink-400">{Math.round(phanTram(n.data, tong.data))}% tổng data</span>
                      </div>

                      <div className="mt-4 flex items-center gap-4">
                        <Vong phanTram={tyLe} chu={n.mau.chu} />
                        <div>
                          <p className="font-display text-3xl font-bold leading-none text-navy-900">{so1(tyLe)}%</p>
                          <p className="mt-1.5 text-sm text-ink-600">chốt <b className="text-navy-900">{n.chot}</b> / {n.data} data</p>
                        </div>
                      </div>

                      <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
                        <div title={formatVnd(n.tien)}>
                          <p className="text-xs text-ink-400">Doanh số mang về</p>
                          <p className="mt-0.5 font-semibold text-navy-900">{rutGon(n.tien)}</p>
                        </div>
                        <div title={formatVnd(Math.round(n.data ? n.tien / n.data : 0))}>
                          <p className="text-xs text-ink-400">Giá trị mỗi data</p>
                          <p className="mt-0.5 font-semibold text-indigo-700">{rutGon(n.data ? n.tien / n.data : 0)}</p>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
              </div>
            </section>

            {/* Từng sale trong nguồn đang chọn */}
            {nguonDangXem && (
              <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                  <div>
                    <h2 className="font-display text-base font-semibold text-navy-900">Từng sale với nguồn {nguonDangXem.ten}</h2>
                    <p className="text-xs text-ink-400">Xếp theo tỷ lệ chốt, cao nhất ở trên — dùng để chia thêm data cho người chốt tốt.</p>
                  </div>
                  <div className="inline-flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
                    {theoNguon.map((n) => (
                      <button key={n.key} type="button" onClick={() => setNguonChon(n.key)}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition ${
                          nguonDangXem.key === n.key ? 'bg-white font-semibold text-navy-900 shadow-sm' : 'text-ink-600 hover:text-navy-900'}`}>
                        <span className={`h-2 w-2 rounded-full ${n.mau.cham}`} />{n.ten}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="text-left text-xs text-ink-400">
                        <th className="px-5 py-2.5 font-medium">Sale</th>
                        <th className="px-3 py-2.5 text-right font-medium">Data nhận</th>
                        <th className="px-3 py-2.5 text-right font-medium">Đã chốt</th>
                        <th className="w-56 px-3 py-2.5 font-medium">Tỷ lệ chốt</th>
                        <th className="px-3 py-2.5 text-right font-medium">Doanh số</th>
                        <th className="px-5 py-2.5 text-right font-medium">Giá trị mỗi data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {nguonDangXem.sales.map((s, i) => {
                        const tyLe = phanTram(s.chot, s.data)
                        const tot = nguonDangXem.sales.length > 1 && i === 0 && s.data >= 3 && s.chot > 0
                        return (
                          <tr key={s.id} className="border-t border-slate-100">
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-3">
                                <span className={`flex h-8 w-8 flex-none items-center justify-center rounded-full text-xs font-semibold text-navy-900 ${nguonDangXem.mau.nhat}`}>
                                  {chuCai(tenSale(s.id))}
                                </span>
                                <div>
                                  <p className="font-medium text-navy-900">{tenSale(s.id)}</p>
                                  {tot && <p className="text-xs font-medium text-emerald-600">Chốt tốt nhất</p>}
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-3 text-right text-ink-600">{s.data}</td>
                            <td className="px-3 py-3 text-right text-ink-600">{s.chot}</td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-2">
                                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                                  <div className={`h-full rounded-full ${nguonDangXem.mau.thanh}`} style={{ width: `${Math.max(tyLe, tyLe > 0 ? 3 : 0)}%` }} />
                                </div>
                                <span className="w-12 text-right font-semibold text-navy-900">{so1(tyLe)}%</span>
                              </div>
                            </td>
                            <td className="px-3 py-3 text-right font-medium text-navy-900" title={formatVnd(s.tien)}>{rutGon(s.tien)}</td>
                            <td className="px-5 py-3 text-right text-indigo-700" title={formatVnd(Math.round(s.data ? s.tien / s.data : 0))}>
                              {rutGon(s.data ? s.tien / s.data : 0)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="border-t border-slate-100 px-5 py-3 text-xs text-ink-400">
                  "Đã chốt" tính theo các trạng thái chăm sóc được đánh dấu là chốt. Doanh số mang về gồm đơn mới và tái ký của khách trong bộ lọc.
                  Sale có dưới 3 data thì chưa đủ để xếp "Chốt tốt nhất".
                </p>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Kpi({ nhan, giaTri, tip, chu = 'text-navy-900', lon }) {
  return (
    <div className="px-5 py-4" title={tip}>
      <p className="text-sm text-ink-600">{nhan}</p>
      <p className={`mt-1 font-display font-bold text-2xl ${chu}`}>{giaTri}</p>
    </div>
  )
}

// Vòng tròn thể hiện tỷ lệ chốt
function Vong({ phanTram: pt, chu }) {
  const r = 26
  const c = 2 * Math.PI * r
  return (
    <svg width="68" height="68" viewBox="0 0 68 68" className={`flex-none ${chu}`} role="img" aria-label={`Tỷ lệ chốt ${pt}%`}>
      <circle cx="34" cy="34" r={r} fill="none" strokeWidth="8" className="stroke-slate-100" />
      {pt > 0 && <circle cx="34" cy="34" r={r} fill="none" strokeWidth="8" strokeLinecap="round" stroke="currentColor"
        strokeDasharray={`${(Math.min(pt, 100) / 100) * c} ${c}`} transform="rotate(-90 34 34)" />}
    </svg>
  )
}

// Thanh 100% chia theo nguồn — so data với doanh số để thấy nguồn nào "đáng tiền" hơn phần data nó chiếm
function TyTrong({ tieuDe, ds, lay, dinhDang }) {
  const tong = ds.reduce((a, n) => a + lay(n), 0)
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-navy-900">{tieuDe}</h3>
      {tong > 0 ? (
        <>
          <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-slate-100">
            {ds.map((n) => lay(n) > 0 && (
              <div key={n.key} className={n.mau.thanh} style={{ width: `${(lay(n) / tong) * 100}%` }}
                title={`${n.ten}: ${dinhDang(lay(n))}`} />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
            {ds.map((n) => (
              <span key={n.key} className="inline-flex items-center gap-1.5 text-ink-600">
                <span className={`h-2 w-2 rounded-full ${n.mau.cham}`} />
                {n.ten} <b className="text-navy-900">{so1((lay(n) / tong) * 100)}%</b>
              </span>
            ))}
          </div>
        </>
      ) : <p className="mt-3 text-sm text-ink-400">Chưa có số liệu.</p>}
    </div>
  )
}
