import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Select, Input } from './ui'
import { formatVnd, NGUON_KHACH_OPTIONS, labelOf } from '../lib/constants'
import { NHOM, khoangNgay, taoDong, gom, cong, gomDichVu } from '../lib/doanhSo'

const KY = [
  { key: 'nam_nay', label: 'Năm nay' },
  { key: 'thang_nay', label: 'Tháng này' },
  { key: 'thang_truoc', label: 'Tháng trước' },
  { key: 'quy_nay', label: 'Quý này' },
  { key: 'tat_ca', label: 'Tất cả thời gian' },
  { key: 'tuy_chon', label: 'Chọn ngày...' },
]

const NHOM_TEN = { Seller: 'Seller (Xây shop + Tối ưu SP)', ADS: 'Chạy quảng cáo (ADS)', 'Bổ sung': 'Dịch vụ bổ sung' }
const NHOM_MAU = { Seller: 'bg-amber-50 text-amber-700', ADS: 'bg-violet-50 text-violet-700', 'Bổ sung': 'bg-slate-100 text-slate-600' }

const phanTram = (x, tong) => (tong > 0 ? `${Math.round((x / tong) * 1000) / 10}%` : '—')
const ngayHienThi = (s) => (s ? s.split('-').reverse().join('/') : '')
const thangHienThi = (s) => s.split('-').reverse().join('/')

export default function ReportsPage() {
  const [orders, setOrders] = useState([])
  const [items, setItems] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)

  const loai = 'chung'
  const [filterNguon, setFilterNguon] = useState('')
  const [nguonKhach, setNguonKhach] = useState({})
  const [ky, setKy] = useState('thang_nay')
  const [tu, setTu] = useState('')
  const [den, setDen] = useState('')
  const [filterSale, setFilterSale] = useState('')
  const [filterNhom, setFilterNhom] = useState('')
  const [chiTietGoi, setChiTietGoi] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: ords }, { data: its }, { data: profs }, { data: khs }] = await Promise.all([
      supabase.from('orders').select('*').neq('trang_thai', 'huy'),
      supabase.from('order_items').select('*'),
      supabase.from('profiles').select('id, full_name'),
      supabase.from('customers').select('id, nguon_khach'),
    ])
    setNguonKhach(Object.fromEntries((khs || []).map((k) => [k.id, k.nguon_khach])))
    setOrders(ords || [])
    setItems(its || [])
    setProfiles(profs || [])
    setLoading(false)
  }

  const [tuNgay, denNgay] = useMemo(() => khoangNgay(ky, tu, den), [ky, tu, den])
  const tenSale = (id) => (id === 'chua_gan' ? 'Chưa gán sale' : profiles.find((p) => p.id === id)?.full_name || 'Không rõ')
  const coDonChuaGan = useMemo(() => orders.some((o) => !o.sale_id), [orders])

  // Mọi dòng doanh số (chưa VAT) sau khi lọc kỳ / sale / nhóm dịch vụ
  const ordersLoc = useMemo(
    () => (filterNguon ? orders.filter((o) => nguonKhach[o.customer_id] === filterNguon) : orders),
    [orders, filterNguon, nguonKhach],
  )
  const dong = useMemo(
    () => taoDong({ orders: ordersLoc, items, tuNgay, denNgay, sale: filterSale, nhom: filterNhom }),
    [ordersLoc, items, tuNgay, denNgay, filterSale, filterNhom],
  )
  // Báo cáo 2, 3 chỉ lấy đơn tái ký / đơn mới
  const dongBaoCao = useMemo(
    () => (loai === 'moi' || loai === 'tai_ky' ? dong.filter((r) => r.loai === loai) : dong),
    [dong, loai],
  )

  const theoSale = useMemo(() => gom(dongBaoCao, (r) => r.sale).sort((a, b) => b.tong - a.tong), [dongBaoCao])
  const theoThang = useMemo(() => gom(dongBaoCao, (r) => r.thang).sort((a, b) => a.key.localeCompare(b.key)), [dongBaoCao])
  const tong = useMemo(() => cong(theoSale), [theoSale])
  const theoDichVu = useMemo(() => gomDichVu(dong, chiTietGoi), [dong, chiTietGoi])
  const tongChung = useMemo(() => cong(gom(dong, () => 'x')), [dong])  // tổng mọi dòng đang lọc (mới + tái ký)

  const moTaKy = ky === 'tat_ca' ? 'Tất cả thời gian'
    : `${ngayHienThi(tuNgay) || '...'} → ${ngayHienThi(denNgay) || '...'}`
  const macDinh = ky === 'thang_nay' && !filterSale && !filterNhom && !filterNguon
  const datLai = () => { setKy('thang_nay'); setTu(''); setDen(''); setFilterSale(''); setFilterNhom(''); setFilterNguon('') }
  const thangDangXem = tuNgay ? `${tuNgay.slice(5, 7)}/${tuNgay.slice(0, 4)}` : ''

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="border-b border-slate-200 bg-white px-8 py-5">
        <h1 className="font-display text-xl font-bold text-navy-900">
          {macDinh ? `Tổng kết doanh số tháng ${thangDangXem}` : 'Báo cáo doanh số'}
        </h1>
        <p className="text-sm text-ink-600">
          {macDinh ? 'Tất cả sale, tất cả nguồn · ' : ''}Cần xem kỳ khác, sale khác hoặc nguồn khác thì chọn bộ lọc bên dưới · không tính đơn huỷ · số liệu chưa gồm VAT
        </p>
      </header>

      {/* Bộ lọc */}
      <div className="mx-8 mt-6 flex flex-wrap items-end gap-3 rounded-2xl bg-white p-4 shadow-sm">
        <Select label="Kỳ" value={ky} onChange={(e) => setKy(e.target.value)}>
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
          {coDonChuaGan && <option value="chua_gan">Chưa gán sale</option>}
        </Select>
        <Select label="Dịch vụ" value={filterNhom} onChange={(e) => setFilterNhom(e.target.value)}>
          <option value="">Tất cả dịch vụ</option>
          {NHOM.map((n) => <option key={n} value={n}>{NHOM_TEN[n]}</option>)}
        </Select>
        <Select label="Nguồn khách" value={filterNguon} onChange={(e) => setFilterNguon(e.target.value)}>
          <option value="">Tất cả nguồn</option>
          {NGUON_KHACH_OPTIONS.map((n) => <option key={n.value} value={n.value}>{n.label}</option>)}
        </Select>
        {!macDinh && (
          <button type="button" onClick={datLai}
            className="mb-0.5 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-ink-600 hover:bg-slate-50">
            Về tổng kết tháng này
          </button>
        )}
        <label className="flex items-center gap-2 pb-2.5 text-sm text-ink-600">
          <input type="checkbox" checked={chiTietGoi} onChange={(e) => setChiTietGoi(e.target.checked)} />
          Tách dịch vụ theo gói
        </label>
      </div>
      <p className="mx-8 mt-2 text-xs text-ink-400">Đang xem: {moTaKy}{filterNguon ? ` · Nguồn: ${labelOf(NGUON_KHACH_OPTIONS, filterNguon)}` : ''}</p>

      {loading ? (
        <p className="py-16 text-center text-ink-400">Đang tải...</p>
      ) : dong.length === 0 ? (
        <p className="py-16 text-center text-ink-400">Không có đơn nào trong bộ lọc này.</p>
      ) : (
        <div className="space-y-6 px-8 py-6">
          {/* Thẻ tổng quan */}
          <div className="grid grid-cols-3 gap-4">
              <Card label="Tổng doanh số" mau="text-indigo-700" value={formatVnd(tongChung.tong)} sub={`${tongChung.soDon} đơn`} />
              <Card label="Đơn mới" mau="text-coral-500" value={formatVnd(tongChung.moi)}
                sub={`${tongChung.soDonMoi} đơn · ${phanTram(tongChung.moi, tongChung.tong)}`} />
              <Card label="Tái ký" mau="text-teal-500" value={formatVnd(tongChung.tai_ky)}
                sub={`${tongChung.soDonTaiKy} đơn · ${phanTram(tongChung.tai_ky, tongChung.tong)}`} />
            </div>

          {/* Báo cáo 1-3: theo sale + theo tháng */}
          {(
            <>
              <Panel title="Theo từng sale">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-ink-400">
                        <th className="pb-2">Sale</th>
                        <th className="pb-2 text-right">Số đơn</th>
                        {loai === 'chung' ? (
                          <>
                            <th className="pb-2 text-right">Đơn mới</th>
                            <th className="pb-2 text-right">Tái ký</th>
                          </>
                        ) : NHOM.map((n) => <th key={n} className="pb-2 text-right">{n}</th>)}
                        <th className="pb-2 text-right">Tổng</th>
                        <th className="pb-2 text-right">Tỷ trọng</th>
                      </tr>
                    </thead>
                    <tbody>
                      {theoSale.map((s) => (
                        <tr key={s.key} className="border-t border-slate-100">
                          <td className="py-2.5 font-medium text-navy-900">{tenSale(s.key)}</td>
                          <td className="py-2.5 text-right text-ink-600">{s.soDon}</td>
                          {loai === 'chung' ? (
                            <>
                              <td className="py-2.5 text-right text-coral-600">{formatVnd(s.moi)}</td>
                              <td className="py-2.5 text-right text-teal-600">{formatVnd(s.tai_ky)}</td>
                            </>
                          ) : NHOM.map((n) => <td key={n} className="py-2.5 text-right text-ink-600">{formatVnd(s[n])}</td>)}
                          <td className="py-2.5 text-right font-semibold text-navy-900">{formatVnd(s.tong)}</td>
                          <td className="py-2.5 text-right text-ink-400">{phanTram(s.tong, tong.tong)}</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-slate-200 bg-indigo-50 font-bold text-indigo-700">
                        <td className="py-2.5 pl-2">TỔNG</td>
                        <td className="py-2.5 text-right">{tong.soDon}</td>
                        {loai === 'chung' ? (
                          <>
                            <td className="py-2.5 text-right">{formatVnd(tong.moi)}</td>
                            <td className="py-2.5 text-right">{formatVnd(tong.tai_ky)}</td>
                          </>
                        ) : NHOM.map((n) => <td key={n} className="py-2.5 text-right">{formatVnd(tong[n])}</td>)}
                        <td className="py-2.5 text-right">{formatVnd(tong.tong)}</td>
                        <td className="py-2.5 pr-2 text-right">100%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Panel>

              {theoThang.length > 1 && <Panel title="Theo tháng">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-ink-400">
                        <th className="pb-2">Tháng</th>
                        <th className="pb-2 text-right">Số đơn</th>
                        {loai === 'chung' && (
                          <>
                            <th className="pb-2 text-right">Đơn mới</th>
                            <th className="pb-2 text-right">Tái ký</th>
                          </>
                        )}
                        <th className="pb-2 text-right">Tổng</th>
                      </tr>
                    </thead>
                    <tbody>
                      {theoThang.map((t) => (
                        <tr key={t.key} className="border-t border-slate-100">
                          <td className="py-2.5 font-medium text-navy-900">{thangHienThi(t.key)}</td>
                          <td className="py-2.5 text-right text-ink-600">{t.soDon}</td>
                          {loai === 'chung' && (
                            <>
                              <td className="py-2.5 text-right text-coral-600">{formatVnd(t.moi)}</td>
                              <td className="py-2.5 text-right text-teal-600">{formatVnd(t.tai_ky)}</td>
                            </>
                          )}
                          <td className="py-2.5 text-right font-semibold text-navy-900">{formatVnd(t.tong)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>}
            </>
          )}

          {/* Báo cáo 4: từng dịch vụ, tách rõ mới / tái ký, gom theo nhóm */}
          {(
            <Panel title="Doanh số từng dịch vụ">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-ink-400">
                      <th rowSpan={2} className="pb-2 text-left align-bottom">Dịch vụ</th>
                      <th colSpan={2} className="border-l border-slate-100 pb-1 text-center text-coral-600">Đơn mới</th>
                      <th colSpan={2} className="border-l border-slate-100 pb-1 text-center text-teal-600">Tái ký</th>
                      <th colSpan={2} className="border-l border-slate-100 pb-1 text-center text-navy-900">Tổng</th>
                    </tr>
                    <tr className="text-xs uppercase tracking-wide text-ink-400">
                      {[0, 1, 2].map((i) => (
                        <FragmentTieuDe key={i} />
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {NHOM.map((n) => {
                      const dsNhom = theoDichVu.filter((r) => r.nhom === n).sort((a, b) => b.tien - a.tien)
                      if (dsNhom.length === 0) return null
                      const c = dsNhom.reduce((s, r) => ({
                        mL: s.mL + r.moi.luot, mT: s.mT + r.moi.tien, kL: s.kL + r.tai_ky.luot, kT: s.kT + r.tai_ky.tien,
                      }), { mL: 0, mT: 0, kL: 0, kT: 0 })
                      return [
                        <tr key={`h-${n}`} className="border-t border-slate-200 bg-slate-50 font-semibold">
                          <td className="py-2 pl-2"><span className={`rounded-full px-2.5 py-1 text-xs ${NHOM_MAU[n]}`}>{NHOM_TEN[n]}</span></td>
                          <Cells mL={c.mL} mT={c.mT} kL={c.kL} kT={c.kT} tong="nhom" />
                        </tr>,
                        ...dsNhom.map((r) => (
                          <tr key={`${n}-${r.ten}`} className="border-t border-slate-100">
                            <td className="py-2.5 pl-6 text-navy-900">{r.ten}</td>
                            <Cells mL={r.moi.luot} mT={r.moi.tien} kL={r.tai_ky.luot} kT={r.tai_ky.tien} />
                          </tr>
                        )),
                      ]
                    })}
                    <tr className="border-t-2 border-slate-200 bg-indigo-50 font-bold text-indigo-700">
                      <td className="py-2.5 pl-2">TỔNG CỘNG</td>
                      <Cells
                        mL={theoDichVu.reduce((s, r) => s + r.moi.luot, 0)} mT={theoDichVu.reduce((s, r) => s + r.moi.tien, 0)}
                        kL={theoDichVu.reduce((s, r) => s + r.tai_ky.luot, 0)} kT={theoDichVu.reduce((s, r) => s + r.tai_ky.tien, 0)}
                        tong="cong" />
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-ink-400">"Lượt" = số lần dịch vụ đó được bán. Một đơn có thể gồm nhiều dịch vụ.</p>
            </Panel>
          )}
        </div>
      )}
    </div>
  )
}

// Hàng tiêu đề phụ "Lượt | Doanh số" cho mỗi nhóm cột
function FragmentTieuDe() {
  return (
    <>
      <th className="border-l border-slate-100 pb-2 text-right font-medium">Lượt</th>
      <th className="pb-2 text-right font-medium">Doanh số</th>
    </>
  )
}

// 3 cặp ô "lượt | doanh số": Đơn mới, Tái ký, Tổng.
// tong = 'nhom' (dòng cộng của nhóm) hoặc 'cong' (tổng cộng) -> dùng màu riêng cho số tổng, không dùng màu cam/xanh của dòng thường
function Cells({ mL, mT, kL, kT, tong }) {
  const mauTong = tong === 'cong' ? 'text-indigo-700 font-bold' : tong === 'nhom' ? 'text-indigo-600 font-semibold' : null
  const cMoiL = mauTong || 'text-ink-600'
  const cMoiT = mauTong || 'text-coral-600'
  const cKyL = mauTong || 'text-ink-600'
  const cKyT = mauTong || 'text-teal-600'
  const cTong = mauTong || 'text-navy-900 font-semibold'
  return (
    <>
      <td className={`border-l border-slate-100 py-2.5 text-right ${cMoiL}`}>{mL || '—'}</td>
      <td className={`py-2.5 text-right ${cMoiT}`}>{mT ? formatVnd(mT) : '—'}</td>
      <td className={`border-l border-slate-100 py-2.5 text-right ${cKyL}`}>{kL || '—'}</td>
      <td className={`py-2.5 text-right ${cKyT}`}>{kT ? formatVnd(kT) : '—'}</td>
      <td className={`border-l border-slate-100 py-2.5 text-right ${cTong}`}>{mL + kL}</td>
      <td className={`py-2.5 pr-2 text-right ${cTong}`}>{formatVnd(mT + kT)}</td>
    </>
  )
}

function Card({ label, value, sub, mau = 'text-navy-900' }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-400">{label}</p>
      <p className={`mt-1 font-display text-2xl font-bold ${mau}`}>{value}</p>
      {sub && <p className="mt-0.5 text-sm text-ink-400">{sub}</p>}
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
