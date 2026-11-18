import { layHet } from '../lib/layHet'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Select, Input } from './ui'
import { formatVnd, NGUON_KHACH_OPTIONS, labelOf } from '../lib/constants'
import { useTrangThai } from '../lib/StatusContext'
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
  const { maHoanHuy } = useTrangThai()
  const [ttKhach, setTtKhach] = useState({})
  const [tatCaDon, setTatCaDon] = useState([])
  const [items, setItems] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)

  const loai = 'chung'   // chỉ còn báo cáo doanh số chung (mới + tái ký)
  const [ky, setKy] = useState('thang_nay')
  const [tu, setTu] = useState('')
  const [den, setDen] = useState('')
  const [filterSale, setFilterSale] = useState('')
  const [filterNhom, setFilterNhom] = useState('')
  const [filterNguon, setFilterNguon] = useState('')
  const [nguonKhach, setNguonKhach] = useState({})
  const [chiTietGoi, setChiTietGoi] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: ords }, { data: its }, { data: profs }, { data: khs }] = await Promise.all([
      layHet(() => supabase.from('orders').select('*').order('id')),
      layHet(() => supabase.from('order_items').select('*').order('id')),
      supabase.from('profiles').select('id, full_name'),
      layHet(() => supabase.from('customers').select('id, nguon_khach, trang_thai_cham_soc').order('id')),
    ])
    setNguonKhach(Object.fromEntries((khs || []).map((k) => [k.id, k.nguon_khach])))
    setTtKhach(Object.fromEntries((khs || []).map((k) => [k.id, k.trang_thai_cham_soc])))
    setTatCaDon(ords || [])
    setItems(its || [])
    setProfiles(profs || [])
    setLoading(false)
  }

  // Đơn hoàn / huỷ = đơn đã huỷ, hoặc đơn của khách đang ở trạng thái "hoàn / huỷ"
  const laHoanHuy = (o) => o.trang_thai === 'huy' || maHoanHuy.includes(ttKhach[o.customer_id])
  const orders = useMemo(() => tatCaDon.filter((o) => !laHoanHuy(o)), [tatCaDon, ttKhach, maHoanHuy])
  const ordersHuy = useMemo(() => tatCaDon.filter(laHoanHuy), [tatCaDon, ttKhach, maHoanHuy])

  const [tuNgay, denNgay] = useMemo(() => khoangNgay(ky, tu, den), [ky, tu, den])
  const tenSale = (id) => (id === 'chua_gan' ? 'Chưa gán sale' : profiles.find((p) => p.id === id)?.full_name || 'Không rõ')
  const coDonChuaGan = useMemo(() => orders.some((o) => !o.sale_id), [orders])

  // Mọi dòng doanh số (chưa VAT) sau khi lọc kỳ / sale / nhóm dịch vụ
  const ordersLoc = useMemo(
    () => (filterNguon ? orders.filter((o) => nguonKhach[o.customer_id] === filterNguon) : orders),
    [orders, filterNguon, nguonKhach],
  )
  const ordersHuyLoc = useMemo(
    () => (filterNguon ? ordersHuy.filter((o) => nguonKhach[o.customer_id] === filterNguon) : ordersHuy),
    [ordersHuy, filterNguon, nguonKhach],
  )
  // Đơn hoàn / huỷ trong cùng bộ lọc (tính theo ngày chốt của đơn)
  const dongHuy = useMemo(
    () => taoDong({ orders: ordersHuyLoc, items, tuNgay, denNgay, sale: filterSale, nhom: filterNhom }),
    [ordersHuyLoc, items, tuNgay, denNgay, filterSale, filterNhom],
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
  const tongHuy = useMemo(() => cong(gom(dongHuy, () => 'x')), [dongHuy])
  const tongChung = useMemo(() => cong(gom(dong, () => 'x')), [dong])  // tổng mọi dòng đang lọc (mới + tái ký)

  const moTaKy = ky === 'tat_ca' ? 'Tất cả thời gian'
    : `${ngayHienThi(tuNgay) || '...'} → ${ngayHienThi(denNgay) || '...'}`
  const macDinh = loai === 'chung' && ky === 'thang_nay' && !filterSale && !filterNhom && !filterNguon
  const datLai = () => { setKy('thang_nay'); setTu(''); setDen(''); setFilterSale(''); setFilterNhom(''); setFilterNguon('') }
  const thangDangXem = tuNgay ? `${tuNgay.slice(5, 7)}/${tuNgay.slice(0, 4)}` : ''

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="border-b border-slate-200 bg-white px-8 py-5">
        <h1 className="font-display text-xl font-bold text-navy-900">
          {macDinh ? `Tổng kết doanh số tháng ${thangDangXem}` : 'Báo cáo doanh số'}
        </h1>
        <p className="text-sm text-ink-600">
          {macDinh ? 'Tất cả sale · ' : ''}Cần xem kỳ, sale, dịch vụ hoặc nguồn khác thì chọn bộ lọc bên dưới · doanh số thực đã trừ hoàn / huỷ · số liệu chưa gồm VAT
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
        {loai === 'dich_vu' && (
          <label className="flex items-center gap-2 pb-2.5 text-sm text-ink-600">
            <input type="checkbox" checked={chiTietGoi} onChange={(e) => setChiTietGoi(e.target.checked)} />
            Tách theo gói
          </label>
        )}
      </div>
      <p className="mx-8 mt-2 text-xs text-ink-400">Đang xem: Doanh số chung (mới + tái ký) · {moTaKy}{filterNguon ? ` · Nguồn: ${labelOf(NGUON_KHACH_OPTIONS, filterNguon)}` : ''}</p>

      {loading ? (
        <p className="py-16 text-center text-ink-400">Đang tải...</p>
      ) : dong.length === 0 ? (
        <p className="py-16 text-center text-ink-400">Không có đơn nào trong bộ lọc này.</p>
      ) : (
        <div className="space-y-6 px-8 py-6">
          {/* Doanh số thực = doanh số gộp − hoàn / huỷ */}
          <div className="grid grid-cols-1 overflow-hidden rounded-2xl bg-white shadow-sm md:grid-cols-3 md:divide-x md:divide-slate-100">
            <div className="px-6 py-5">
              <p className="text-sm text-ink-600">Doanh số gộp</p>
              <p className="mt-1 font-display text-2xl font-bold text-navy-900">{formatVnd(tongChung.tong + tongHuy.tong)}</p>
              <p className="mt-1 text-sm text-ink-400">{tongChung.soDon + tongHuy.soDon} đơn, trước khi trừ hoàn / huỷ</p>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-ink-600">Hoàn / huỷ</p>
              <p className="mt-1 font-display text-2xl font-bold text-rose-500">
                {tongHuy.tong > 0 ? '− ' : ''}{formatVnd(tongHuy.tong)}
              </p>
              <p className="mt-1 text-sm text-ink-400">
                {tongHuy.soDon} đơn · {phanTram(tongHuy.tong, tongChung.tong + tongHuy.tong)} doanh số gộp
              </p>
            </div>
            <div className="bg-indigo-50/70 px-6 py-5">
              <p className="text-sm font-medium text-indigo-700">Doanh số thực</p>
              <p className="mt-1 font-display text-3xl font-bold text-indigo-700">{formatVnd(tongChung.tong)}</p>
              <p className="mt-1 text-sm text-indigo-700/70">{tongChung.soDon} đơn · gộp − hoàn / huỷ</p>
            </div>
          </div>

          {/* Cơ cấu doanh số thực: mới / tái ký và theo nhóm dịch vụ */}
          <div className="grid gap-4 lg:grid-cols-2">
            <CoCau tieuDe="Đơn mới và tái ký" tong={tongChung.tong} muc={[
              { ten: 'Đơn mới', tien: tongChung.moi, don: tongChung.soDonMoi, hex: '#ff6b45' },
              { ten: 'Tái ký', tien: tongChung.tai_ky, don: tongChung.soDonTaiKy, hex: '#14b8a6' },
            ]} />
            <CoCau tieuDe="Theo nhóm dịch vụ" tong={tongChung.tong} muc={[
              { ten: 'Xây shop + Tối ưu SP', tien: tongChung.Seller, hex: '#f59e0b' },
              { ten: 'Chạy quảng cáo (ADS)', tien: tongChung.ADS, hex: '#8b5cf6' },
              { ten: 'Dịch vụ bổ sung', tien: tongChung['Bổ sung'], hex: '#94a3b8' },
            ]} />
          </div>

          {/* Báo cáo 1-3: theo sale + theo tháng */}
          {loai !== 'dich_vu' && (
            <>
              <Panel title="Xếp hạng sale — doanh số cao đến thấp">
                <div className="overflow-x-auto">
                  <table className="border-collapse w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-ink-600">
                        <th className="w-16 border border-slate-200 px-3 py-2 text-center">Hạng</th>
                        <th className="border border-slate-200 px-3 py-2">Sale</th>
                        <th className="border border-slate-200 px-3 py-2 text-right">Số đơn</th>
                        {loai === 'chung' ? (
                          <>
                            <th className="border border-slate-200 px-3 py-2 text-right">Đơn mới</th>
                            <th className="border border-slate-200 px-3 py-2 text-right">Tái ký</th>
                          </>
                        ) : NHOM.map((n) => <th key={n} className="border border-slate-200 px-3 py-2 text-right">{n}</th>)}
                        <th className="border border-slate-200 px-3 py-2 text-right">Tổng</th>
                        <th className="border border-slate-200 px-3 py-2 text-right">Tỷ trọng</th>
                      </tr>
                    </thead>
                    <tbody>
                      {theoSale.map((s, i) => (
                        <tr key={s.key} className="border-t border-slate-100">
                          <td className="border border-slate-200 px-3 py-2.5 text-center">
                            <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                              i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-slate-400 text-white' : i === 2 ? 'bg-orange-400 text-white' : 'text-ink-600'
                            }`}>{i + 1}</span>
                          </td>
                          <td className="border border-slate-200 px-3 py-2.5 font-medium text-navy-900">{tenSale(s.key)}</td>
                          <td className="border border-slate-200 px-3 py-2.5 text-right text-ink-600">{s.soDon}</td>
                          {loai === 'chung' ? (
                            <>
                              <td className="border border-slate-200 px-3 py-2.5 text-right text-coral-600">{formatVnd(s.moi)}</td>
                              <td className="border border-slate-200 px-3 py-2.5 text-right text-teal-600">{formatVnd(s.tai_ky)}</td>
                            </>
                          ) : NHOM.map((n) => <td key={n} className="border border-slate-200 px-3 py-2.5 text-right text-ink-600">{formatVnd(s[n])}</td>)}
                          <td className="border border-slate-200 px-3 py-2.5 text-right font-semibold text-navy-900">{formatVnd(s.tong)}</td>
                          <td className="border border-slate-200 px-3 py-2.5 text-right text-ink-400">{phanTram(s.tong, tong.tong)}</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-slate-200 bg-indigo-50 font-bold text-indigo-700">
                        <td className="border border-slate-200 px-3 py-2.5"></td>
                        <td className="border border-slate-200 px-3 py-2.5">TỔNG</td>
                        <td className="border border-slate-200 px-3 py-2.5 text-right">{tong.soDon}</td>
                        {loai === 'chung' ? (
                          <>
                            <td className="border border-slate-200 px-3 py-2.5 text-right">{formatVnd(tong.moi)}</td>
                            <td className="border border-slate-200 px-3 py-2.5 text-right">{formatVnd(tong.tai_ky)}</td>
                          </>
                        ) : NHOM.map((n) => <td key={n} className="border border-slate-200 px-3 py-2.5 text-right">{formatVnd(tong[n])}</td>)}
                        <td className="border border-slate-200 px-3 py-2.5 text-right">{formatVnd(tong.tong)}</td>
                        <td className="border border-slate-200 px-3 py-2.5  text-right">100%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Panel>

              {theoThang.length > 1 && <Panel title="Theo tháng">
                <div className="overflow-x-auto">
                  <table className="border-collapse w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-ink-600">
                        <th className="border border-slate-200 px-3 py-2">Tháng</th>
                        <th className="border border-slate-200 px-3 py-2 text-right">Số đơn</th>
                        {loai === 'chung' && (
                          <>
                            <th className="border border-slate-200 px-3 py-2 text-right">Đơn mới</th>
                            <th className="border border-slate-200 px-3 py-2 text-right">Tái ký</th>
                          </>
                        )}
                        <th className="border border-slate-200 px-3 py-2 text-right">Tổng</th>
                      </tr>
                    </thead>
                    <tbody>
                      {theoThang.map((t) => (
                        <tr key={t.key} className="border-t border-slate-100">
                          <td className="border border-slate-200 px-3 py-2.5 font-medium text-navy-900">{thangHienThi(t.key)}</td>
                          <td className="border border-slate-200 px-3 py-2.5 text-right text-ink-600">{t.soDon}</td>
                          {loai === 'chung' && (
                            <>
                              <td className="border border-slate-200 px-3 py-2.5 text-right text-coral-600">{formatVnd(t.moi)}</td>
                              <td className="border border-slate-200 px-3 py-2.5 text-right text-teal-600">{formatVnd(t.tai_ky)}</td>
                            </>
                          )}
                          <td className="border border-slate-200 px-3 py-2.5 text-right font-semibold text-navy-900">{formatVnd(t.tong)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>}
            </>
          )}

          {/* Báo cáo 4: từng dịch vụ, tách rõ mới / tái ký, gom theo nhóm */}
          {loai === 'dich_vu' && (
            <Panel title="Doanh số từng dịch vụ">
              <div className="overflow-x-auto">
                <table className="border-collapse w-full text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-ink-400">
                      <th rowSpan={2} className="border border-slate-200 px-3 py-2 text-left align-bottom">Dịch vụ</th>
                      <th colSpan={2} className="border border-slate-200 px-3 border-l border-slate-100 pb-1 text-center text-coral-600">Đơn mới</th>
                      <th colSpan={2} className="border border-slate-200 px-3 border-l border-slate-100 pb-1 text-center text-teal-600">Tái ký</th>
                      <th colSpan={2} className="border border-slate-200 px-3 border-l border-slate-100 pb-1 text-center text-navy-900">Tổng</th>
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
                          <td className="border border-slate-200 px-3 py-2"><span className={`rounded-full px-2.5 py-1 text-xs ${NHOM_MAU[n]}`}>{NHOM_TEN[n]}</span></td>
                          <Cells mL={c.mL} mT={c.mT} kL={c.kL} kT={c.kT} tong="nhom" />
                        </tr>,
                        ...dsNhom.map((r) => (
                          <tr key={`${n}-${r.ten}`} className="border-t border-slate-100">
                            <td className="border border-slate-200 px-3 py-2.5 pl-6 text-navy-900">{r.ten}</td>
                            <Cells mL={r.moi.luot} mT={r.moi.tien} kL={r.tai_ky.luot} kT={r.tai_ky.tien} />
                          </tr>
                        )),
                      ]
                    })}
                    <tr className="border-t-2 border-slate-200 bg-indigo-50 font-bold text-indigo-700">
                      <td className="border border-slate-200 px-3 py-2.5">TỔNG CỘNG</td>
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
      <th className="border border-slate-200 px-3 border-l border-slate-100 py-2 text-right font-medium">Lượt</th>
      <th className="border border-slate-200 px-3 py-2 text-right font-medium">Doanh số</th>
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
      <td className={`border border-slate-200 border-l border-slate-100 py-2.5 text-right ${cMoiL}`}>{mL || '—'}</td>
      <td className={`border border-slate-200 py-2.5 text-right ${cMoiT}`}>{mT ? formatVnd(mT) : '—'}</td>
      <td className={`border border-slate-200 border-l border-slate-100 py-2.5 text-right ${cKyL}`}>{kL || '—'}</td>
      <td className={`border border-slate-200 py-2.5 text-right ${cKyT}`}>{kT ? formatVnd(kT) : '—'}</td>
      <td className={`border border-slate-200 border-l border-slate-100 py-2.5 text-right ${cTong}`}>{mL + kL}</td>
      <td className={`border border-slate-200 py-2.5 pr-2 text-right ${cTong}`}>{formatVnd(mT + kT)}</td>
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

// Thanh 100% + chú thích có số tiền cho từng phần
function CoCau({ tieuDe, tong, muc }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-navy-900">{tieuDe}</h3>
      <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-slate-100">
        {muc.map((m) => m.tien > 0 && tong > 0 && (
          <div key={m.ten} style={{ width: `${(m.tien / tong) * 100}%`, backgroundColor: m.hex }} title={`${m.ten}: ${formatVnd(m.tien)}`} />
        ))}
      </div>
      <div className="mt-4 grid gap-3" style={{ gridTemplateColumns: `repeat(${muc.length}, minmax(0, 1fr))` }}>
        {muc.map((m) => (
          <div key={m.ten}>
            <p className="flex items-center gap-1.5 text-sm text-ink-600">
              <span className="h-2 w-2 flex-none rounded-full" style={{ backgroundColor: m.hex }} />{m.ten}
            </p>
            <p className="mt-0.5 font-display text-lg font-bold text-navy-900">{formatVnd(m.tien)}</p>
            <p className="text-xs text-ink-400">{phanTram(m.tien, tong)}{m.don !== undefined ? ` · ${m.don} đơn` : ''}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
