import { useEffect, useMemo, useState } from 'react'
import { Plus, Search, Pencil, Trash2, AlertTriangle, Tags } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { Button, Input, Select, Badge } from './ui'
import OrderForm from './OrderForm'
import CustomerDetail from './CustomerDetail'
import PackagesModal from './PackagesModal'
import { DICH_VU_OPTIONS, classOf, labelOf, formatVnd, giaTruocVat } from '../lib/constants'
import { useTrangThai } from '../lib/StatusContext'

export default function OrdersPage({ currentProfile, pendingCustomer, onPendingHandled }) {
  const { options: TRANG_THAI, tenTrangThai, classTrangThai, maDaChot, maTaoDon } = useTrangThai()
  const [orders, setOrders] = useState([])
  const [items, setItems] = useState({})
  const [customers, setCustomers] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterTT, setFilterTT] = useState('')
  const [filterSale, setFilterSale] = useState('')
  const [showForm, setShowForm] = useState(!!pendingCustomer)
  const [editing, setEditing] = useState(null)
  const [khachTuChon, setKhachTuChon] = useState(null)
  const [xemKhach, setXemKhach] = useState(null)
  const [xemGoi, setXemGoi] = useState(false)

  useEffect(() => { load() }, [])
  useEffect(() => { if (pendingCustomer) setShowForm(true) }, [pendingCustomer])

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

  const filtered = useMemo(() => orders.filter((o) => {
    if (filterTT && khachCua(o.customer_id)?.trang_thai_cham_soc !== filterTT) return false
    if (filterSale && o.sale_id !== filterSale) return false
    if (search) {
      const tenKhach = nameOf(o.customer_id, customers, 'ten_khach')
      const dv = (items[o.id] || []).map((i) => i.ten_dich_vu).join(' ')
      if (!`${o.ma_don} ${tenKhach} ${dv}`.toLowerCase().includes(search.toLowerCase())) return false
    }
    return true
  }), [orders, items, customers, search, filterTT, filterSale])

  // Khách đã chuyển sang "Chốt hợp đồng" nhưng chưa có đơn dịch vụ nào
  const chuaCoDon = useMemo(() => {
    const coDon = new Set(orders.map((o) => o.customer_id))
    return customers.filter((c) => maTaoDon.includes(c.trang_thai_cham_soc) && !coDon.has(c.id))
  }, [customers, orders, maTaoDon])

  // Doanh số tháng này và so sánh tháng trước (trên toàn bộ đơn, không phụ thuộc bộ lọc)
  const doanhSoThang = useMemo(() => {
    const d = new Date(); d.setDate(1)
    const mocNay = d.toISOString().slice(0, 10)
    const t = new Date(); t.setDate(1); t.setMonth(t.getMonth() - 1)
    const mocTruoc = t.toISOString().slice(0, 10)
    let nay = 0, truoc = 0, soDon = 0
    for (const o of orders) {
      if (o.trang_thai === 'huy' || !o.ngay_chot) continue
      const tien = giaTruocVat(o.gia_tri)
      if (o.ngay_chot >= mocNay) { nay += tien; soDon += 1 }
      else if (o.ngay_chot >= mocTruoc) truoc += tien
    }
    return { nay, truoc, soDon }
  }, [orders])

  const tongDoanhSo = filtered
    .filter((o) => o.trang_thai !== 'huy')
    .reduce((s, o) => s + giaTruocVat(o.gia_tri), 0)

  function closeForm() {
    setShowForm(false)
    setEditing(null)
    setKhachTuChon(null)
    onPendingHandled?.()
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-8 py-5">
        <div>
          <h1 className="font-display text-xl font-bold text-navy-900">Đơn dịch vụ</h1>
          <p className="text-sm text-ink-600">Đơn đã chốt, dịch vụ khách mua và giá trị hợp đồng</p>
        </div>
        <div className="flex gap-2">
          {currentProfile?.role === 'admin' && (
            <Button variant="secondary" onClick={() => setXemGoi(true)}>
              <Tags size={16} /> Bảng giá
            </Button>
          )}
          <Button onClick={() => { setEditing(null); setShowForm(true) }}>
            <Plus size={16} /> Tạo đơn dịch vụ
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-4 gap-4 px-8 pt-6">
        <StatCard
          label={`Doanh số tháng ${new Date().getMonth() + 1} (chưa VAT)`}
          value={formatVnd(doanhSoThang.nay)}
          accent="coral"
          note={doanhSoThang.truoc > 0
            ? `${doanhSoThang.nay >= doanhSoThang.truoc ? '▲' : '▼'} ${Math.abs(Math.round(((doanhSoThang.nay - doanhSoThang.truoc) / doanhSoThang.truoc) * 100))}% so tháng trước`
            : null}
          noteUp={doanhSoThang.nay >= doanhSoThang.truoc}
          phamVi={`${doanhSoThang.soDon} đơn trong tháng`} />
        <StatCard label="Số đơn" value={filtered.length} phamVi="Theo bộ lọc" />
        <StatCard label="Tổng giá trị (trừ đơn huỷ, chưa VAT)" value={formatVnd(tongDoanhSo)} phamVi="Theo bộ lọc" />
        <StatCard label="Đơn đang triển khai"
          value={filtered.filter((o) => khachCua(o.customer_id)?.trang_thai_cham_soc === 'dang_trien_khai').length}
          accent="teal" phamVi="Theo bộ lọc" />
      </div>

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
        <Select value={filterTT} onChange={(e) => setFilterTT(e.target.value)} className="w-44">
          <option value="">Tất cả trạng thái</option>
          {TRANG_THAI.map((o) => <option key={o.ma} value={o.ma}>{o.ten}</option>)}
        </Select>
        <Select value={filterSale} onChange={(e) => setFilterSale(e.target.value)} className="w-44">
          <option value="">Tất cả sale</option>
          {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
        </Select>
      </div>

      <div className="mx-8 my-6 overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-ink-400">
              <th className="px-5 py-3">Mã đơn</th>
              <th className="px-5 py-3">Khách hàng</th>
              <th className="px-5 py-3">Dịch vụ</th>
              <th className="px-5 py-3 text-right">Giá trị</th>
              <th className="px-5 py-3">Ngày chốt</th>
              <th className="px-5 py-3">Sale</th>
              <th className="px-5 py-3">Trạng thái</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {/* Khách đã chốt nhưng chưa lên đơn — nằm ngay đầu danh sách để không bị bỏ sót */}
            {!loading && chuaCoDon.map((c) => (
              <tr key={`cho-${c.id}`}
                onClick={() => setXemKhach(c)}
                className="cursor-pointer border-b border-slate-50 bg-amber-50/60 last:border-0 hover:bg-amber-100/60">
                <td className="px-5 py-3">
                  <span className="text-ink-400">—</span>
                </td>
                <td className="px-5 py-3">
                  <p className="font-medium text-navy-900">{c.ten_khach}</p>
                  <p className="text-xs text-ink-400">{c.ma_khach}</p>
                </td>
                <td className="px-5 py-3">
                  <div className="flex flex-wrap gap-1">
                    {(c.dich_vu || []).map((dv) => (
                      <Badge key={dv} className={classOf(DICH_VU_OPTIONS, dv)}>{labelOf(DICH_VU_OPTIONS, dv)}</Badge>
                    ))}
                  </div>
                </td>
                <td className="px-5 py-3 text-right text-ink-400">—</td>
                <td className="px-5 py-3 text-ink-400">—</td>
                <td className="px-5 py-3 text-ink-600">{nameOf(c.sale_id, profiles, 'full_name')}</td>
                <td className="px-5 py-3">
                  <Badge className="bg-amber-100 text-amber-800">Chưa lên đơn</Badge>
                </td>
                <td className="whitespace-nowrap px-5 py-3 text-right">
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditing(null); setKhachTuChon(c); setShowForm(true) }}
                    className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-amber-600">
                    <Plus size={13} /> Tạo đơn
                  </button>
                </td>
              </tr>
            ))}

            {loading ? (
              <tr><td colSpan={8} className="px-5 py-8 text-center text-ink-400">Đang tải...</td></tr>
            ) : filtered.length === 0 && chuaCoDon.length === 0 ? (
              <tr><td colSpan={8} className="px-5 py-8 text-center text-ink-400">
                {orders.length === 0 ? 'Chưa có đơn dịch vụ nào.' : 'Không tìm thấy đơn phù hợp.'}
              </td></tr>
            ) : filtered.map((o) => (
              <tr key={o.id}
                onClick={() => { const k = khachCua(o.customer_id); if (k) setXemKhach(k) }}
                className="cursor-pointer border-b border-slate-50 last:border-0 hover:bg-slate-50">
                <td className="px-5 py-3 font-medium text-navy-900">{o.ma_don}</td>
                <td className="px-5 py-3">
                  <p className="text-navy-900">{nameOf(o.customer_id, customers, 'ten_khach')}</p>
                  <p className="text-xs text-ink-400">{nameOf(o.customer_id, customers, 'ma_khach')}</p>
                </td>
                <td className="px-5 py-3">
                  <div className="flex flex-wrap gap-1">
                    {(items[o.id] || []).map((i) => (
                      <Badge key={i.id} className="bg-slate-100 text-slate-600">
                        {i.ten_dich_vu}{i.ten_goi ? ` · ${i.ten_goi}` : ''}
                      </Badge>
                    ))}
                  </div>
                </td>
                <td className="px-5 py-3 text-right font-medium text-navy-900">{formatVnd(o.gia_tri)}</td>
                <td className="px-5 py-3 text-ink-600">{o.ngay_chot || '—'}</td>
                <td className="px-5 py-3 text-ink-600">{nameOf(o.sale_id, profiles, 'full_name')}</td>
                <td className="px-5 py-3">
                  {(() => {
                    const tt = khachCua(o.customer_id)?.trang_thai_cham_soc
                    return tt ? (
                      <Badge className={classTrangThai(tt)}>{tenTrangThai(tt)}</Badge>
                    ) : <span className="text-ink-400">—</span>
                  })()}
                </td>
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
          customer={!editing ? (khachTuChon || pendingCustomer) : null}
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

function StatCard({ label, value, accent = 'navy', note, noteUp, phamVi }) {
  const accents = { navy: 'text-navy-900', coral: 'text-coral-500', teal: 'text-teal-500' }
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-400">{label}</p>
      <p className={`mt-1 font-display text-2xl font-bold ${accents[accent]}`}>{value}</p>
      {note && (
        <p className={`mt-0.5 text-[11px] font-medium ${noteUp ? 'text-emerald-600' : 'text-rose-500'}`}>{note}</p>
      )}
      {phamVi && <p className="mt-0.5 text-[11px] text-ink-400">{phamVi}</p>}
    </div>
  )
}
