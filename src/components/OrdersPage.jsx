import { layHet } from '../lib/layHet'
import { useEffect, useMemo, useState } from 'react'
import { Search, Pencil, Trash2, Tags, Columns3, Download, X } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { Button, Input, Select, Badge, Phantrang } from './ui'
import OrderForm from './OrderForm'
import CustomerDetail from './CustomerDetail'
import PackagesModal from './PackagesModal'
import { DICH_VU_OPTIONS, NGUON_KHACH_OPTIONS, classOf, labelOf, formatVnd, giaTruocVat } from '../lib/constants'
import { useTrangThai } from '../lib/StatusContext'
import { khoangNgay } from '../lib/doanhSo'

// Trang báo cáo đơn dịch vụ — tạo đơn mới làm trong panel Khách hàng,
// trang này chỉ để xem, lọc, sửa số liệu và xoá khi cần.
export default function OrdersPage({ currentProfile }) {
  const { options: TRANG_THAI, tenTrangThai, classTrangThai, maTaoDon, maHoanHuy } = useTrangThai()
  const [orders, setOrders] = useState([])
  const [items, setItems] = useState({})
  const [customers, setCustomers] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterLoai, setFilterLoai] = useState('')   // '' | 'moi' | 'tai_ky'
  const [ky, setKy] = useState('tat_ca')
  const [tu, setTu] = useState('')
  const [den, setDen] = useState('')
  const [filterSale, setFilterSale] = useState('')
  const [filterTrangThai, setFilterTrangThai] = useState('')
  // Chỉ lấy các trạng thái từ "Chốt hợp đồng" trở đi (khách đã có đơn)
  const trangThaiTuChot = useMemo(() => {
    const moc = TRANG_THAI.filter((o) => o.la_chot).map((o) => o.thu_tu)
    if (moc.length === 0) return TRANG_THAI
    const tu = Math.min(...moc)
    return TRANG_THAI.filter((o) => o.thu_tu >= tu)
  }, [TRANG_THAI])
  const [filterNguon, setFilterNguon] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [xemKhach, setXemKhach] = useState(null)
  const [xemGoi, setXemGoi] = useState(false)

  // Cột hiển thị trong bảng (lưu theo máy của từng người)
  const COT = [
    { key: 'ma', label: 'Mã đơn' },
    { key: 'loai', label: 'Loại (Mới / Tái ký)' },
    { key: 'khach', label: 'Khách hàng' },
    { key: 'sdt', label: 'Số điện thoại' },
    { key: 'dich_vu', label: 'Dịch vụ' },
    { key: 'gia_tri', label: 'Giá trị' },
    { key: 'ngay_chot', label: 'Ngày chốt' },
    { key: 'sale', label: 'Sale' },
    { key: 'trang_thai', label: 'Trạng thái' },
    { key: 'nguon', label: 'Nguồn khách', macDinh: false },
  ]
  const KHOA_COT = 'tuki_cot_don_hang'
  const [cotHien, setCotHien] = useState(() => {
    try {
      const luu = JSON.parse(localStorage.getItem(KHOA_COT) || 'null')
      if (luu) return luu
    } catch { /* bo qua */ }
    return Object.fromEntries(COT.map((c) => [c.key, c.macDinh !== false]))
  })
  const [moChonCot, setMoChonCot] = useState(false)
  const hien = (k) => cotHien[k] !== false && (cotHien[k] !== undefined || COT.find((c) => c.key === k)?.macDinh !== false)
  const toggleCot = (k) => {
    const moi = { ...cotHien, [k]: !hien(k) }
    setCotHien(moi)
    try { localStorage.setItem(KHOA_COT, JSON.stringify(moi)) } catch { /* bo qua */ }
  }
  const soCot = COT.filter((c) => hien(c.key)).length + 1   // + cột thao tác

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: ords }, { data: its }, { data: custs }, { data: profs }] = await Promise.all([
      layHet(() => supabase.from('orders').select('*').order('ngay_chot', { ascending: false }).order('id')),
      layHet(() => supabase.from('order_items').select('*').order('id')),
      layHet(() => supabase.from('customers').select('*').order('ten_khach').order('id')),
      supabase.from('profiles').select('id, full_name').order('full_name'),
    ])
    setOrders(ords || [])
    const grouped = {}
    for (const it of its || []) {
      grouped[it.order_id] = [...(grouped[it.order_id] || []), it]
    }
    setItems(grouped)
    setCustomers(custs || [])
    setProfiles(profs || [])
    setLoading(false)
  }

  async function remove(o) {
    if (!window.confirm(`Xoá đơn ${o.ma_don}? Thao tác này không hoàn tác được, hợp đồng gắn với đơn (nếu có) cũng sẽ bị xoá theo.`)) return
    const { error } = await supabase.from('orders').delete().eq('id', o.id)
    if (error) { window.alert('Không xoá được: ' + error.message); return }
    load()
  }

  const nameOf = (id, list, key) => list.find((x) => x.id === id)?.[key] || '—'
  const khachCua = (id) => customers.find((c) => c.id === id)

  const [tuNgay, denNgay] = useMemo(() => khoangNgay(ky, tu, den), [ky, tu, den])

  const filtered = useMemo(() => orders.filter((o) => {
    const loaiDon = o.loai_don === 'tai_ky' ? 'tai_ky' : 'moi'
    if (filterLoai && loaiDon !== filterLoai) return false
    if (tuNgay && (!o.ngay_chot || o.ngay_chot < tuNgay)) return false
    if (denNgay && (!o.ngay_chot || o.ngay_chot > denNgay)) return false
    if (filterSale && o.sale_id !== filterSale) return false
    const kh = customers.find((c) => c.id === o.customer_id)
    if (filterTrangThai && kh?.trang_thai_cham_soc !== filterTrangThai) return false
    if (filterNguon && kh?.nguon_khach !== filterNguon) return false
    if (search) {
      const dv = (items[o.id] || []).map((i) => i.ten_dich_vu).join(' ')
      if (!`${o.ma_don} ${kh?.ten_khach || ''} ${kh?.sdt || ''} ${dv}`.toLowerCase().includes(search.toLowerCase())) return false
    }
    return true
  }), [orders, items, customers, search, filterLoai, tuNgay, denNgay, filterSale, filterTrangThai, filterNguon])

  const [trang, setTrang] = useState(1)
  useEffect(() => { setTrang(1) }, [search, filterLoai, ky, tu, den, filterSale, filterTrangThai, filterNguon])
  const phanTrang = useMemo(() => filtered.slice((trang - 1) * 20, trang * 20), [filtered, trang])

  // Khách đã chuyển sang "Chốt hợp đồng" nhưng chưa có đơn dịch vụ nào
  const chuaCoDon = useMemo(() => {
    const coDon = new Set(orders.map((o) => o.customer_id))
    return customers.filter((c) => maTaoDon.includes(c.trang_thai_cham_soc) && !coDon.has(c.id))
  }, [customers, orders, maTaoDon])

  // ---- Số liệu tổng (theo bộ lọc) — doanh số tính chưa VAT ----
  const laHoanHuy = (o) => o.trang_thai === 'huy' || maHoanHuy.includes(khachCua(o.customer_id)?.trang_thai_cham_soc)
  const tienChuaVat = (o) => {
    const ds = items[o.id]
    return ds && ds.length ? ds.reduce((a, i) => a + giaTruocVat(i.gia), 0) : giaTruocVat(o.gia_tri)
  }
  const tong = useMemo(() => {
    const t = { soDon: filtered.length, moi: 0, soMoi: 0, taiKy: 0, soTaiKy: 0, huy: 0, soHuy: 0 }
    for (const o of filtered) {
      const tien = tienChuaVat(o)
      if (laHoanHuy(o)) { t.huy += tien; t.soHuy += 1; continue }
      if (o.loai_don === 'tai_ky') { t.taiKy += tien; t.soTaiKy += 1 } else { t.moi += tien; t.soMoi += 1 }
    }
    t.thuc = t.moi + t.taiKy
    return t
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, items, customers, maHoanHuy])

  const dangLoc = !!(search || filterLoai || filterSale || filterTrangThai || filterNguon || ky !== 'tat_ca')
  function xoaLoc() {
    setSearch(''); setFilterLoai(''); setFilterSale(''); setFilterTrangThai(''); setFilterNguon(''); setKy('tat_ca'); setTu(''); setDen('')
  }

  // Xuất Excel: toàn bộ đơn đang lọc (không chỉ trang đang xem)
  async function xuatExcel() {
    const XLSX = await import('xlsx')
    const rows = filtered.map((o, i) => {
      const k = khachCua(o.customer_id)
      return {
        '#': i + 1,
        'Mã đơn': o.ma_don,
        'Loại': o.loai_don === 'tai_ky' ? 'Tái ký' : 'Mới',
        'Mã KH': k?.ma_khach || '',
        'Khách hàng': k?.ten_khach || '',
        'Số điện thoại': k?.sdt || '',
        'Dịch vụ': (items[o.id] || []).map((x) => `${x.ten_dich_vu}${x.ten_goi ? ' · ' + x.ten_goi : ''}`).join('; '),
        'Giá trị (chưa VAT)': tienChuaVat(o),
        'Ngày chốt': o.ngay_chot || '',
        'Sale': nameOf(o.sale_id, profiles, 'full_name'),
        'Trạng thái KH': k?.trang_thai_cham_soc ? tenTrangThai(k.trang_thai_cham_soc) : '',
        'Hoàn/huỷ': laHoanHuy(o) ? 'Có' : '',
        'Nguồn khách': labelOf(NGUON_KHACH_OPTIONS, k?.nguon_khach) || '',
      }
    })
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Don dich vu')
    const d = new Date(); const p = (n) => String(n).padStart(2, '0')
    XLSX.writeFile(wb, `DonDichVu_${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.xlsx`)
  }

  function closeForm() {
    setShowForm(false)
    setEditing(null)
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-8 py-5">
        <div>
          <h1 className="font-display text-xl font-bold text-navy-900">Đơn dịch vụ</h1>
          <p className="text-sm text-ink-600">
            Báo cáo đơn đã chốt — bấm vào 1 khách để tạo đơn mới hoặc tái ký
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={xuatExcel} disabled={filtered.length === 0}>
            <Download size={16} /> Xuất Excel
          </Button>
          {currentProfile?.role === 'admin' && (
            <Button variant="secondary" onClick={() => setXemGoi(true)}>
              <Tags size={16} /> Bảng giá
            </Button>
          )}
        </div>
      </header>

      {chuaCoDon.length > 0 && (
        <p className="px-8 pt-3 text-sm text-amber-700">
          {chuaCoDon.length} khách đã chốt hợp đồng nhưng chưa lên đơn — nằm ở đầu danh sách bên dưới.
          Doanh số chỉ được tính khi đơn đã được tạo.
        </p>
      )}

      {/* Tổng tiền theo bộ lọc */}
      <div className="mx-8 mt-6 grid grid-cols-2 divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-sm sm:grid-cols-3 sm:divide-y-0 lg:grid-cols-5 lg:divide-x">
        <Kpi nhan="Số đơn" giaTri={tong.soDon} phu={dangLoc ? 'theo bộ lọc' : 'tất cả'} />
        <Kpi nhan="Doanh số thực (chưa VAT)" giaTri={formatVnd(tong.thuc)} chu="text-indigo-700" phu="đã trừ hoàn/huỷ" />
        <Kpi nhan="Đơn mới" giaTri={formatVnd(tong.moi)} chu="text-coral-500" phu={`${tong.soMoi} đơn`} />
        <Kpi nhan="Tái ký" giaTri={formatVnd(tong.taiKy)} chu="text-teal-500" phu={`${tong.soTaiKy} đơn`} />
        <Kpi nhan="Hoàn / huỷ" giaTri={formatVnd(tong.huy)} chu="text-rose-500" phu={`${tong.soHuy} đơn`} />
      </div>

      <div className="mx-8 mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
        <div className="relative min-w-[200px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <Input placeholder="Tìm theo mã đơn, khách hàng, SĐT, dịch vụ..." value={search}
            onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterLoai} onChange={(e) => setFilterLoai(e.target.value)} className="w-40">
          <option value="">Tất cả phân loại</option>
          <option value="moi">Đơn mới</option>
          <option value="tai_ky">Tái ký</option>
        </Select>
        <Select value={ky} onChange={(e) => setKy(e.target.value)} className="w-40">
          <option value="tat_ca">Tất cả thời gian</option>
          <option value="thang_nay">Tháng này</option>
          <option value="thang_truoc">Tháng trước</option>
          <option value="quy_nay">Quý này</option>
          <option value="nam_nay">Năm nay</option>
          <option value="tuy_chon">Chọn ngày...</option>
        </Select>
        {ky === 'tuy_chon' && (
          <>
            <Input type="date" value={tu} onChange={(e) => setTu(e.target.value)} className="w-40" title="Từ ngày chốt" />
            <span className="text-ink-400">→</span>
            <Input type="date" value={den} onChange={(e) => setDen(e.target.value)} className="w-40" title="Đến ngày chốt" />
          </>
        )}
        <Select value={filterSale} onChange={(e) => setFilterSale(e.target.value)} className="w-44">
          <option value="">Tất cả sale</option>
          {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
        </Select>
        <Select value={filterTrangThai} onChange={(e) => setFilterTrangThai(e.target.value)} className="w-44">
          <option value="">Tất cả trạng thái</option>
          {trangThaiTuChot.map((o) => <option key={o.ma} value={o.ma}>{o.ten}</option>)}
        </Select>
        <Select value={filterNguon} onChange={(e) => setFilterNguon(e.target.value)} className="w-40">
          <option value="">Tất cả nguồn</option>
          {NGUON_KHACH_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
        {dangLoc && (
          <button onClick={xoaLoc} className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-sm text-ink-600 hover:text-coral-500">
            <X size={14} /> Xoá lọc
          </button>
        )}
      </div>

      <div className="mx-8 mt-4 flex items-center justify-between">
        <p className="text-xs text-ink-400">{filtered.length} đơn theo bộ lọc</p>
        <div className="relative">
          <button onClick={() => setMoChonCot((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-ink-600 hover:border-coral-500 hover:text-coral-500">
            <Columns3 size={15} /> Cột hiển thị
          </button>
          {moChonCot && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMoChonCot(false)} />
              <div className="absolute right-0 z-20 mt-1 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                <p className="px-2 py-1 text-xs text-ink-400">Chọn cột muốn hiển thị</p>
                {COT.map((c) => (
                  <label key={c.key} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                    <input type="checkbox" checked={hien(c.key)} onChange={() => toggleCot(c.key)}
                      className="h-4 w-4 rounded border-slate-300" />
                    <span className="text-navy-900">{c.label}</span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mx-8 mb-6 mt-2 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-ink-600">
              {hien('ma') && <th className="border border-slate-200 px-4 py-3">Mã đơn</th>}
              {hien('loai') && <th className="border border-slate-200 px-4 py-3">Loại</th>}
              {hien('khach') && <th className="border border-slate-200 px-4 py-3">Khách hàng</th>}
              {hien('sdt') && <th className="border border-slate-200 px-4 py-3">SĐT</th>}
              {hien('dich_vu') && <th className="border border-slate-200 px-4 py-3">Dịch vụ</th>}
              {hien('gia_tri') && <th className="border border-slate-200 px-4 py-3 text-right">Giá trị (chưa VAT)</th>}
              {hien('ngay_chot') && <th className="border border-slate-200 px-4 py-3">Ngày chốt</th>}
              {hien('sale') && <th className="border border-slate-200 px-4 py-3">Sale</th>}
              {hien('trang_thai') && <th className="border border-slate-200 px-4 py-3">Trạng thái</th>}
              {hien('nguon') && <th className="border border-slate-200 px-4 py-3">Nguồn khách</th>}
              <th className="border border-slate-200 px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {/* Khách đã chốt nhưng chưa lên đơn — nằm ngay đầu danh sách để không bị bỏ sót */}
            {!loading && chuaCoDon.map((c) => (
              <tr key={`cho-${c.id}`}
                onClick={() => setXemKhach(c)}
                className="cursor-pointer border-b border-slate-50 bg-amber-50/60 last:border-0 hover:bg-amber-100/60">
                {hien('ma') && <td className="border border-slate-200 px-4 py-3"><span className="text-ink-400">—</span></td>}
                {hien('loai') && <td className="border border-slate-200 px-4 py-3"><span className="text-ink-400">—</span></td>}
                {hien('khach') && (
                  <td className="border border-slate-200 px-4 py-3">
                    <p className="font-medium text-navy-900">{c.ten_khach}</p>
                    <p className="text-xs text-ink-400">{c.ma_khach}</p>
                  </td>
                )}
                {hien('sdt') && <td className="whitespace-nowrap border border-slate-200 px-4 py-3 text-ink-600">{c.sdt || '—'}</td>}
                {hien('dich_vu') && (
                  <td className="border border-slate-200 px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(c.dich_vu || []).map((dv) => (
                        <Badge key={dv} className={classOf(DICH_VU_OPTIONS, dv)}>{labelOf(DICH_VU_OPTIONS, dv)}</Badge>
                      ))}
                    </div>
                  </td>
                )}
                {hien('gia_tri') && <td className="border border-slate-200 px-4 py-3 text-right text-ink-400">—</td>}
                {hien('ngay_chot') && <td className="border border-slate-200 px-4 py-3 text-ink-400">—</td>}
                {hien('sale') && <td className="border border-slate-200 px-4 py-3 text-ink-600">{nameOf(c.sale_id, profiles, 'full_name')}</td>}
                {hien('trang_thai') && (
                  <td className="border border-slate-200 px-4 py-3"><Badge className="bg-amber-100 text-amber-800">Chưa lên đơn</Badge></td>
                )}
                {hien('nguon') && <td className="border border-slate-200 px-4 py-3 text-ink-600">{labelOf(NGUON_KHACH_OPTIONS, c.nguon_khach) || '—'}</td>}
                <td className="whitespace-nowrap border border-slate-200 px-4 py-3 text-right text-xs text-ink-400">
                  Bấm vào dòng để tạo đơn
                </td>
              </tr>
            ))}

            {loading ? (
              <tr><td colSpan={soCot} className="border border-slate-200 px-5 py-8 text-center text-ink-400">Đang tải...</td></tr>
            ) : filtered.length === 0 && chuaCoDon.length === 0 ? (
              <tr><td colSpan={soCot} className="border border-slate-200 px-5 py-8 text-center text-ink-400">
                {orders.length === 0 ? 'Chưa có đơn dịch vụ nào.' : 'Không tìm thấy đơn phù hợp.'}
              </td></tr>
            ) : phanTrang.map((o) => (
              <tr key={o.id}
                onClick={() => { const k = khachCua(o.customer_id); if (k) setXemKhach(k) }}
                className={`cursor-pointer border-b border-slate-50 last:border-0 hover:bg-slate-50 ${laHoanHuy(o) ? 'opacity-60' : ''}`}>
                {hien('ma') && <td className="whitespace-nowrap border border-slate-200 px-4 py-3 font-medium text-navy-900">{o.ma_don}</td>}
                {hien('loai') && (
                  <td className="border border-slate-200 px-4 py-3">
                    {o.loai_don === 'tai_ky'
                      ? <Badge className="whitespace-nowrap bg-teal-50 text-teal-600">Tái ký</Badge>
                      : <Badge className="whitespace-nowrap bg-coral-50 text-coral-600">Mới</Badge>}
                  </td>
                )}
                {hien('khach') && (
                  <td className="border border-slate-200 px-4 py-3">
                    <p className="text-navy-900">{nameOf(o.customer_id, customers, 'ten_khach')}</p>
                    <p className="text-xs text-ink-400">{nameOf(o.customer_id, customers, 'ma_khach')}</p>
                  </td>
                )}
                {hien('sdt') && <td className="whitespace-nowrap border border-slate-200 px-4 py-3 text-ink-600">{khachCua(o.customer_id)?.sdt || '—'}</td>}
                {hien('dich_vu') && (
                  <td className="border border-slate-200 px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(items[o.id] || []).map((i) => (
                        <Badge key={i.id} className="bg-slate-100 text-slate-600">
                          {i.ten_dich_vu}{i.ten_goi ? ` · ${i.ten_goi}` : ''}
                        </Badge>
                      ))}
                    </div>
                  </td>
                )}
                {hien('gia_tri') && <td className="whitespace-nowrap border border-slate-200 px-4 py-3 text-right font-medium text-navy-900">{formatVnd(tienChuaVat(o))}</td>}
                {hien('ngay_chot') && <td className="whitespace-nowrap border border-slate-200 px-4 py-3 text-ink-600">{o.ngay_chot ? o.ngay_chot.split('-').reverse().join('/') : '—'}</td>}
                {hien('sale') && <td className="border border-slate-200 px-4 py-3 text-ink-600">{nameOf(o.sale_id, profiles, 'full_name')}</td>}
                {hien('trang_thai') && (
                  <td className="border border-slate-200 px-4 py-3">
                    {(() => {
                      const tt = khachCua(o.customer_id)?.trang_thai_cham_soc
                      return tt ? (
                        <Badge className={classTrangThai(tt)}>{tenTrangThai(tt)}</Badge>
                      ) : <span className="text-ink-400">—</span>
                    })()}
                  </td>
                )}
                {hien('nguon') && (
                  <td className="border border-slate-200 px-4 py-3 text-ink-600">{labelOf(NGUON_KHACH_OPTIONS, khachCua(o.customer_id)?.nguon_khach) || '—'}</td>
                )}
                <td className="whitespace-nowrap border border-slate-200 px-4 py-3 text-right">
                  <button onClick={(e) => { e.stopPropagation(); setEditing(o); setShowForm(true) }}
                    className="mr-3 text-ink-400 hover:text-coral-500" title="Sửa đơn"><Pencil size={14} /></button>
                  <button onClick={(e) => { e.stopPropagation(); remove(o) }}
                    className="text-ink-400 hover:text-rose-500" title="Xoá đơn"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Phantrang trang={trang} setTrang={setTrang} tong={filtered.length} />

      {xemGoi && <PackagesModal onClose={() => setXemGoi(false)} />}

      {xemKhach && (
        <CustomerDetail
          customer={xemKhach}
          currentProfile={currentProfile}
          onClose={() => setXemKhach(null)}
          onChanged={load}
        />
      )}

      {showForm && (
        <OrderForm
          order={editing}
          customer={null}
          customers={customers}
          profiles={profiles}
          currentProfile={currentProfile}
          onClose={closeForm}
          onSaved={() => { closeForm(); load() }}
        />
      )}
    </div>
  )
}

function Kpi({ nhan, giaTri, phu, chu = 'text-navy-900' }) {
  return (
    <div className="px-5 py-4">
      <p className="text-sm text-ink-600">{nhan}</p>
      <p className={`mt-1 font-display text-2xl font-bold ${chu}`}>{giaTri}</p>
      {phu && <p className="mt-0.5 text-xs text-ink-400">{phu}</p>}
    </div>
  )
}
