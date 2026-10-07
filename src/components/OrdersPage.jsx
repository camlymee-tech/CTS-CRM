import { useEffect, useMemo, useState } from 'react'
import { Search, Pencil, Trash2, Tags, Columns3 } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { Button, Input, Select, Badge, Phantrang } from './ui'
import OrderForm from './OrderForm'
import CustomerDetail from './CustomerDetail'
import PackagesModal from './PackagesModal'
import { DICH_VU_OPTIONS, NGUON_KHACH_OPTIONS, classOf, labelOf, formatVnd } from '../lib/constants'
import { useTrangThai } from '../lib/StatusContext'
import { khoangNgay } from '../lib/doanhSo'

// Trang báo cáo đơn dịch vụ — tạo đơn mới làm trong panel Khách hàng,
// trang này chỉ để xem, lọc, sửa số liệu và xoá khi cần.
export default function OrdersPage({ currentProfile }) {
  const { tenTrangThai, classTrangThai, maTaoDon } = useTrangThai()
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
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [xemKhach, setXemKhach] = useState(null)
  const [xemGoi, setXemGoi] = useState(false)

  // Cột hiển thị trong bảng (lưu theo máy của từng người)
  const COT = [
    { key: 'ma', label: 'Mã đơn' },
    { key: 'loai', label: 'Loại (Mới / Tái ký)' },
    { key: 'khach', label: 'Khách hàng' },
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
      supabase.from('orders').select('*').order('ngay_chot', { ascending: false }),
      supabase.from('order_items').select('*'),
      supabase.from('customers').select('*').order('ten_khach'),
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
    if (search) {
      const tenKhach = nameOf(o.customer_id, customers, 'ten_khach')
      const dv = (items[o.id] || []).map((i) => i.ten_dich_vu).join(' ')
      if (!`${o.ma_don} ${tenKhach} ${dv}`.toLowerCase().includes(search.toLowerCase())) return false
    }
    return true
  }), [orders, items, customers, search, filterLoai, tuNgay, denNgay, filterSale])

  const [trang, setTrang] = useState(1)
  useEffect(() => { setTrang(1) }, [search, filterLoai, ky, tu, den, filterSale])
  const phanTrang = useMemo(() => filtered.slice((trang - 1) * 20, trang * 20), [filtered, trang])

  // Khách đã chuyển sang "Chốt hợp đồng" nhưng chưa có đơn dịch vụ nào
  const chuaCoDon = useMemo(() => {
    const coDon = new Set(orders.map((o) => o.customer_id))
    return customers.filter((c) => maTaoDon.includes(c.trang_thai_cham_soc) && !coDon.has(c.id))
  }, [customers, orders, maTaoDon])

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

      <div className="mx-8 mt-6 flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
        <div className="relative min-w-[200px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <Input placeholder="Tìm theo mã đơn, khách hàng, dịch vụ..." value={search}
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

      <div className="mx-8 mb-6 mt-2 overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-ink-400">
              {hien('ma') && <th className="px-5 py-3">Mã đơn</th>}
              {hien('loai') && <th className="px-5 py-3">Loại</th>}
              {hien('khach') && <th className="px-5 py-3">Khách hàng</th>}
              {hien('dich_vu') && <th className="px-5 py-3">Dịch vụ</th>}
              {hien('gia_tri') && <th className="px-5 py-3 text-right">Giá trị</th>}
              {hien('ngay_chot') && <th className="px-5 py-3">Ngày chốt</th>}
              {hien('sale') && <th className="px-5 py-3">Sale</th>}
              {hien('trang_thai') && <th className="px-5 py-3">Trạng thái</th>}
              {hien('nguon') && <th className="px-5 py-3">Nguồn khách</th>}
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {/* Khách đã chốt nhưng chưa lên đơn — nằm ngay đầu danh sách để không bị bỏ sót */}
            {!loading && chuaCoDon.map((c) => (
              <tr key={`cho-${c.id}`}
                onClick={() => setXemKhach(c)}
                className="cursor-pointer border-b border-slate-50 bg-amber-50/60 last:border-0 hover:bg-amber-100/60">
                {hien('ma') && <td className="px-5 py-3"><span className="text-ink-400">—</span></td>}
                {hien('loai') && <td className="px-5 py-3"><span className="text-ink-400">—</span></td>}
                {hien('khach') && (
                  <td className="px-5 py-3">
                    <p className="font-medium text-navy-900">{c.ten_khach}</p>
                    <p className="text-xs text-ink-400">{c.ma_khach}</p>
                  </td>
                )}
                {hien('dich_vu') && (
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(c.dich_vu || []).map((dv) => (
                        <Badge key={dv} className={classOf(DICH_VU_OPTIONS, dv)}>{labelOf(DICH_VU_OPTIONS, dv)}</Badge>
                      ))}
                    </div>
                  </td>
                )}
                {hien('gia_tri') && <td className="px-5 py-3 text-right text-ink-400">—</td>}
                {hien('ngay_chot') && <td className="px-5 py-3 text-ink-400">—</td>}
                {hien('sale') && <td className="px-5 py-3 text-ink-600">{nameOf(c.sale_id, profiles, 'full_name')}</td>}
                {hien('trang_thai') && (
                  <td className="px-5 py-3"><Badge className="bg-amber-100 text-amber-800">Chưa lên đơn</Badge></td>
                )}
                {hien('nguon') && <td className="px-5 py-3 text-ink-600">{labelOf(NGUON_KHACH_OPTIONS, c.nguon_khach) || '—'}</td>}
                <td className="whitespace-nowrap px-5 py-3 text-right text-xs text-ink-400">
                  Bấm vào dòng để tạo đơn
                </td>
              </tr>
            ))}

            {loading ? (
              <tr><td colSpan={soCot} className="px-5 py-8 text-center text-ink-400">Đang tải...</td></tr>
            ) : filtered.length === 0 && chuaCoDon.length === 0 ? (
              <tr><td colSpan={soCot} className="px-5 py-8 text-center text-ink-400">
                {orders.length === 0 ? 'Chưa có đơn dịch vụ nào.' : 'Không tìm thấy đơn phù hợp.'}
              </td></tr>
            ) : phanTrang.map((o) => (
              <tr key={o.id}
                onClick={() => { const k = khachCua(o.customer_id); if (k) setXemKhach(k) }}
                className="cursor-pointer border-b border-slate-50 last:border-0 hover:bg-slate-50">
                {hien('ma') && <td className="px-5 py-3 font-medium text-navy-900">{o.ma_don}</td>}
                {hien('loai') && (
                  <td className="px-5 py-3">
                    {o.loai_don === 'tai_ky'
                      ? <Badge className="whitespace-nowrap bg-teal-50 text-teal-600">Tái ký</Badge>
                      : <Badge className="whitespace-nowrap bg-coral-50 text-coral-600">Mới</Badge>}
                  </td>
                )}
                {hien('khach') && (
                  <td className="px-5 py-3">
                    <p className="text-navy-900">{nameOf(o.customer_id, customers, 'ten_khach')}</p>
                    <p className="text-xs text-ink-400">{nameOf(o.customer_id, customers, 'ma_khach')}</p>
                  </td>
                )}
                {hien('dich_vu') && (
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(items[o.id] || []).map((i) => (
                        <Badge key={i.id} className="bg-slate-100 text-slate-600">
                          {i.ten_dich_vu}{i.ten_goi ? ` · ${i.ten_goi}` : ''}
                        </Badge>
                      ))}
                    </div>
                  </td>
                )}
                {hien('gia_tri') && <td className="px-5 py-3 text-right font-medium text-navy-900">{formatVnd(o.gia_tri)}</td>}
                {hien('ngay_chot') && <td className="px-5 py-3 text-ink-600">{o.ngay_chot || '—'}</td>}
                {hien('sale') && <td className="px-5 py-3 text-ink-600">{nameOf(o.sale_id, profiles, 'full_name')}</td>}
                {hien('trang_thai') && (
                  <td className="px-5 py-3">
                    {(() => {
                      const tt = khachCua(o.customer_id)?.trang_thai_cham_soc
                      return tt ? (
                        <Badge className={classTrangThai(tt)}>{tenTrangThai(tt)}</Badge>
                      ) : <span className="text-ink-400">—</span>
                    })()}
                  </td>
                )}
                {hien('nguon') && (
                  <td className="px-5 py-3 text-ink-600">{labelOf(NGUON_KHACH_OPTIONS, khachCua(o.customer_id)?.nguon_khach) || '—'}</td>
                )}
                <td className="whitespace-nowrap px-5 py-3 text-right">
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
