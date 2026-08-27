import { useEffect, useMemo, useState } from 'react'
import { Plus, Search, Phone, Link2, Store, Users2, Trash2 } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { Button, Input, Select, Badge } from './ui'
import CustomerForm from './CustomerForm'
import CustomerDetail from './CustomerDetail'
import {
  NEN_TANG_OPTIONS,
  DICH_VU_OPTIONS,
  LOAI_KHACH_OPTIONS,
  NGUON_KHACH_OPTIONS,
  TRANG_THAI_OPTIONS,
  TT_DA_KY,
  classOf,
  labelOf,
} from '../lib/constants'

// Khách "chung" — cả team đều xem được (khớp với hàm la_khach_chung trong database)
function laKhachChung(c) {
  const moc = c.ngay_lien_he_gan_nhat || (c.created_at || '').slice(0, 10)
  const soNgay = moc ? Math.floor((Date.now() - new Date(moc).getTime()) / 86400000) : 999
  switch (c.trang_thai_cham_soc) {
    case 'hoan_thanh': return true            // hoàn thành dịch vụ -> mở cho cả team
    case 'khong_nghe_may': return soNgay >= 5
    case 'dang_tu_van': return soNgay >= 30
    case 'tu_choi': return soNgay >= 15
    default: return false                     // chưa liên hệ, chốt HĐ, đang triển khai -> riêng
  }
}

const chiSo = (s) => (s || '').replace(/\D/g, '')

function gonTien(n) {
  const v = Number(n) || 0
  if (v >= 1_000_000_000) return (v / 1_000_000_000).toFixed(1).replace('.', ',') + ' tỷ'
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace('.', ',') + ' tr'
  if (v >= 1_000) return Math.round(v / 1_000) + 'k'
  return String(v)
}

export default function CustomerList({ currentProfile, onChotDon }) {
  const [customers, setCustomers] = useState([])
  const [phoneHits, setPhoneHits] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterLoai, setFilterLoai] = useState('')
  const [filterTrangThai, setFilterTrangThai] = useState('')
  const [filterSale, setFilterSale] = useState('')
  const [filterDichVu, setFilterDichVu] = useState('')
  const [filterNguon, setFilterNguon] = useState('')
  const [quickFilter, setQuickFilter] = useState('')
  const [tuNgay, setTuNgay] = useState('')
  const [denNgay, setDenNgay] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [viewingCustomer, setViewingCustomer] = useState(null)

  const [doanhSoThang, setDoanhSoThang] = useState(null)
  const [doanhSoTruoc, setDoanhSoTruoc] = useState(0)
  const [khachChotThang, setKhachChotThang] = useState(new Set())

  useEffect(() => {
    loadProfiles()
    loadCustomers()
    loadDoanhSo()
  }, [])

  async function xoaKhach(c) {
    if (!window.confirm(`Xoá khách "${c.ten_khach}"?\n\nToàn bộ lịch sử chăm sóc, vấn đề và nhật ký của khách này cũng bị xoá. Không khôi phục được.`)) return
    const { error } = await supabase.from('customers').delete().eq('id', c.id)
    if (error) {
      alert(error.message.includes('đơn dịch vụ')
        ? `Không thể xoá "${c.ten_khach}".\n\nKhách này đã có đơn dịch vụ / hợp đồng nên dữ liệu phải được giữ lại. Nếu khách dừng hợp tác, hãy đổi trạng thái sang "Từ chối / Ngừng" thay vì xoá.`
        : 'Không xoá được: ' + error.message)
      return
    }
    loadCustomers()
  }

  async function loadDoanhSo() {
    const nay = new Date(); nay.setDate(1)
    const mocNay = nay.toISOString().slice(0, 10)
    const truoc = new Date(); truoc.setDate(1); truoc.setMonth(truoc.getMonth() - 1)
    const mocTruoc = truoc.toISOString().slice(0, 10)

    const { data } = await supabase.from('orders')
      .select('gia_tri, ngay_chot, customer_id').neq('trang_thai', 'huy').gte('ngay_chot', mocTruoc)

    let a = 0, b = 0
    const ids = new Set()
    for (const o of data || []) {
      const tien = Number(o.gia_tri) || 0
      if (o.ngay_chot >= mocNay) { a += tien; if (o.customer_id) ids.add(o.customer_id) }
      else b += tien
    }
    setDoanhSoThang(a)
    setDoanhSoTruoc(b)
    setKhachChotThang(ids)
  }

  // Gõ đủ số điện thoại -> tra cứu được cả khách của sale khác
  useEffect(() => {
    const so = chiSo(search)
    if (so.length < 8) { setPhoneHits([]); return }
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc('tim_khach_theo_sdt', { p_sdt: search })
      setPhoneHits(data || [])
    }, 400)
    return () => clearTimeout(t)
  }, [search])

  async function loadProfiles() {
    const { data } = await supabase.from('profiles').select('*').order('full_name')
    setProfiles(data || [])
  }

  async function loadCustomers() {
    setLoading(true)
    const { data } = await supabase.from('customers').select('*').order('created_at', { ascending: false })
    setCustomers(data || [])
    setLoading(false)
  }

  const isAdmin = currentProfile?.role === 'admin'

  // Sale xem số của mình, admin xem số toàn team
  const phamVi = useMemo(
    () => (isAdmin ? customers : customers.filter((c) => c.sale_id === currentProfile?.id)),
    [customers, isAdmin, currentProfile?.id]
  )

  const homNay = new Date().toISOString().slice(0, 10)
  const dauThang = homNay.slice(0, 8) + '01'

  // Gộp kết quả tra cứu SĐT vào danh sách, không trùng lặp
  const nguon = useMemo(() => {
    const map = new Map(customers.map((c) => [c.id, c]))
    for (const c of phoneHits) if (!map.has(c.id)) map.set(c.id, { ...c, _tuTraCuu: true })
    return [...map.values()]
  }, [customers, phoneHits])

  const filtered = useMemo(() => {
    return nguon.filter((c) => {
      if (search && !`${c.ten_khach} ${c.ma_khach} ${c.sdt || ''} ${c.nganh_hang || ''}`.toLowerCase().includes(search.toLowerCase())) {
        if (!c._tuTraCuu) return false
      }
      if (quickFilter) {
        if (!isAdmin && c.sale_id !== currentProfile?.id) return false
        if (quickFilter === 'can_cham_soc' && !(c.ngay_cham_soc_tiep_theo && c.ngay_cham_soc_tiep_theo <= homNay
          && !TT_DA_KY.includes(c.trang_thai_cham_soc))) return false
        if (quickFilter === 'chua_lien_he' && c.trang_thai_cham_soc !== 'chua_lien_he') return false
        if (quickFilter === 'dang_tu_van' && c.trang_thai_cham_soc !== 'dang_tu_van') return false
        if (quickFilter === 'chot_thang_nay' && !khachChotThang.has(c.id)) return false
      }
      if (filterLoai && c.loai_khach !== filterLoai) return false
      if (filterTrangThai && c.trang_thai_cham_soc !== filterTrangThai) return false
      if (filterSale && c.sale_id !== filterSale) return false
      if (filterDichVu && !(c.dich_vu || []).includes(filterDichVu)) return false
      if (filterNguon && c.nguon_khach !== filterNguon) return false
      if (tuNgay && (!c.ngay_lien_he_gan_nhat || c.ngay_lien_he_gan_nhat < tuNgay)) return false
      if (denNgay && (!c.ngay_lien_he_gan_nhat || c.ngay_lien_he_gan_nhat > denNgay)) return false
      return true
    })
  }, [nguon, search, filterLoai, filterTrangThai, filterSale, filterDichVu, filterNguon, tuNgay, denNgay, quickFilter, khachChotThang, isAdmin, currentProfile?.id, homNay, dauThang])

  const stats = useMemo(() => ({
    canChamSoc: phamVi.filter((c) => c.ngay_cham_soc_tiep_theo && c.ngay_cham_soc_tiep_theo <= homNay
      && !TT_DA_KY.includes(c.trang_thai_cham_soc)).length,
    chuaLienHe: phamVi.filter((c) => c.trang_thai_cham_soc === 'chua_lien_he').length,
    dangTuVan: phamVi.filter((c) => c.trang_thai_cham_soc === 'dang_tu_van').length,
    chotThangNay: phamVi.filter((c) => khachChotThang.has(c.id)).length,
  }), [phamVi, homNay, dauThang, khachChotThang])

  const profileName = (id) => profiles.find((p) => p.id === id)?.full_name || 'Chưa gán'

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-8 py-5">
        <div>
          <h1 className="font-display text-xl font-bold text-navy-900">Khách hàng</h1>
          <p className="text-sm text-ink-600">Quản lý & phân loại toàn bộ khách hàng của team sale</p>
        </div>
        <Button onClick={() => { setEditingCustomer(null); setShowForm(true) }}>
          <Plus size={16} /> Thêm khách hàng
        </Button>
      </header>

      <div className="grid grid-cols-5 gap-4 px-8 pt-6">
        <StatCard label="Cần chăm sóc hôm nay" value={stats.canChamSoc} accent="coral"
          active={quickFilter === 'can_cham_soc'}
          onClick={() => setQuickFilter(quickFilter === 'can_cham_soc' ? '' : 'can_cham_soc')} />
        <StatCard label="Chưa liên hệ" value={stats.chuaLienHe}
          active={quickFilter === 'chua_lien_he'}
          onClick={() => setQuickFilter(quickFilter === 'chua_lien_he' ? '' : 'chua_lien_he')} />
        <StatCard label="Đang tư vấn" value={stats.dangTuVan} accent="teal"
          active={quickFilter === 'dang_tu_van'}
          onClick={() => setQuickFilter(quickFilter === 'dang_tu_van' ? '' : 'dang_tu_van')} />
        <StatCard label="Chốt tháng này" value={stats.chotThangNay} accent="emerald"
          active={quickFilter === 'chot_thang_nay'}
          onClick={() => setQuickFilter(quickFilter === 'chot_thang_nay' ? '' : 'chot_thang_nay')} />
        <StatCard label={`Doanh số tháng ${new Date().getMonth() + 1}`}
          value={doanhSoThang === null ? '...' : gonTien(doanhSoThang)} accent="coral"
          note={doanhSoTruoc > 0 && doanhSoThang !== null
            ? `${doanhSoThang >= doanhSoTruoc ? '▲' : '▼'} ${Math.abs(Math.round(((doanhSoThang - doanhSoTruoc) / doanhSoTruoc) * 100))}% so tháng trước`
            : null}
          noteUp={doanhSoThang >= doanhSoTruoc} />
      </div>
      <p className="px-8 pt-2 text-xs text-ink-400">
        {isAdmin ? 'Số liệu toàn team · bấm vào thẻ để lọc danh sách' : 'Số liệu khách của bạn · bấm vào thẻ để lọc danh sách'}
      </p>

      <div className="mx-8 mt-6 space-y-3 rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <Input placeholder="Tìm theo tên, mã KH, SĐT, ngành hàng..." value={search}
              onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterLoai} onChange={(e) => setFilterLoai(e.target.value)} className="w-40">
            <option value="">Tất cả loại khách</option>
            {LOAI_KHACH_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
          <Select value={filterTrangThai} onChange={(e) => setFilterTrangThai(e.target.value)} className="w-48">
            <option value="">Tất cả trạng thái</option>
            {TRANG_THAI_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={filterDichVu} onChange={(e) => setFilterDichVu(e.target.value)} className="w-48">
            <option value="">Tất cả dịch vụ</option>
            {DICH_VU_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
          <Select value={filterNguon} onChange={(e) => setFilterNguon(e.target.value)} className="w-44">
            <option value="">Tất cả nguồn</option>
            {NGUON_KHACH_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
          <Select value={filterSale} onChange={(e) => setFilterSale(e.target.value)} className="w-44">
            <option value="">Tất cả sale</option>
            {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </Select>
          <div className="flex items-center gap-2 text-sm text-ink-600">
            <span className="whitespace-nowrap">Liên hệ từ</span>
            <Input type="date" value={tuNgay} onChange={(e) => setTuNgay(e.target.value)} className="w-40" />
            <span>đến</span>
            <Input type="date" value={denNgay} onChange={(e) => setDenNgay(e.target.value)} className="w-40" />
          </div>
          {(search || filterLoai || filterTrangThai || filterSale || filterDichVu || filterNguon || tuNgay || denNgay || quickFilter) && (
            <button
              onClick={() => { setSearch(''); setFilterLoai(''); setFilterTrangThai(''); setFilterSale(''); setFilterDichVu(''); setFilterNguon(''); setTuNgay(''); setDenNgay(''); setQuickFilter('') }}
              className="text-sm text-ink-600 hover:text-coral-500">
              Xoá bộ lọc
            </button>
          )}
        </div>
      </div>

      <div className="mx-8 my-6 overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full min-w-[1100px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-ink-400">
              <th className="px-4 py-3 w-12">STT</th>
              <th className="px-4 py-3">Khách hàng</th>
              <th className="px-4 py-3">Số điện thoại</th>
              <th className="px-4 py-3">Nền tảng</th>
              <th className="px-4 py-3">Dịch vụ</th>
              <th className="px-4 py-3">Nguồn</th>
              <th className="px-4 py-3">Loại</th>
              <th className="px-4 py-3">Trạng thái</th>
              <th className="px-4 py-3">Sale phụ trách</th>
              <th className="px-4 py-3">Liên hệ gần nhất</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={11} className="px-5 py-8 text-center text-ink-400">Đang tải...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={11} className="px-5 py-8 text-center text-ink-400">Chưa có khách hàng nào phù hợp.</td></tr>
            ) : filtered.map((c, idx) => {
              const chung = laKhachChung(c)
              const cuaMinh = c.sale_id === currentProfile?.id
              return (
                <tr key={c.id}
                  className="cursor-pointer border-b border-slate-50 last:border-0 hover:bg-slate-50"
                  onClick={() => setViewingCustomer(c)}>
                  <td className="px-4 py-3 text-ink-400">{idx + 1}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-navy-900">{c.ten_khach}</p>
                      {chung && !cuaMinh && (
                        <span title="Khách chung — cả team đều xem được">
                          <Users2 size={13} className="text-amber-500" />
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-ink-400">
                      <span>{c.ma_khach}</span>
                      {c.link_fb && (
                        <a href={c.link_fb} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-0.5 text-teal-500 hover:underline">
                          <Link2 size={10} /> FB
                        </a>
                      )}
                      {c.link_shop && (
                        <a href={c.link_shop} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-0.5 text-teal-500 hover:underline">
                          <Store size={10} /> Shop
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-ink-600">{c.sdt || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(c.nen_tang || []).map((nt) => (
                        <Badge key={nt} className={classOf(NEN_TANG_OPTIONS, nt)}>{labelOf(NEN_TANG_OPTIONS, nt)}</Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(c.dich_vu || []).map((dv) => (
                        <Badge key={dv} className={classOf(DICH_VU_OPTIONS, dv)}>{labelOf(DICH_VU_OPTIONS, dv)}</Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-ink-600">{labelOf(NGUON_KHACH_OPTIONS, c.nguon_khach) || '—'}</td>
                  <td className="px-4 py-3">
                    <Badge className={c.loai_khach === 'moi' ? 'bg-coral-50 text-coral-600' : 'bg-slate-100 text-slate-600'}>
                      {labelOf(LOAI_KHACH_OPTIONS, c.loai_khach)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={classOf(TRANG_THAI_OPTIONS, c.trang_thai_cham_soc)}>
                      {labelOf(TRANG_THAI_OPTIONS, c.trang_thai_cham_soc)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-ink-600">{profileName(c.sale_id)}</td>
                  <td className="px-4 py-3 text-ink-600">{c.ngay_lien_he_gan_nhat || '—'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <a href={c.sdt ? `tel:${c.sdt}` : undefined} onClick={(e) => e.stopPropagation()}
                      className={`mr-3 inline-flex items-center gap-1 text-xs ${c.sdt ? 'text-teal-500 hover:underline' : 'text-ink-400'}`}>
                      <Phone size={13} /> Gọi
                    </a>
                    {(isAdmin || cuaMinh) && (
                      <button onClick={(e) => { e.stopPropagation(); xoaKhach(c) }}
                        className="text-ink-400 hover:text-rose-500" title="Xoá khách hàng">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {showForm && (
        <CustomerForm
          customer={editingCustomer}
          profiles={profiles}
          currentProfile={currentProfile}
          onClose={() => setShowForm(false)}
          onSaved={(khachVuaChot) => {
            setShowForm(false)
            loadCustomers()
            if (khachVuaChot) onChotDon?.(khachVuaChot)
          }}
        />
      )}

      {viewingCustomer && (
        <CustomerDetail
          customer={viewingCustomer}
          currentProfile={currentProfile}
          onClose={() => setViewingCustomer(null)}
          onChanged={loadCustomers}
          onEdit={(c) => { setViewingCustomer(null); setEditingCustomer(c); setShowForm(true) }}
          onChotDon={(khach) => { setViewingCustomer(null); onChotDon?.(khach) }}
        />
      )}
    </div>
  )
}

function StatCard({ label, value, accent = 'navy', active = false, onClick, note, noteUp }) {
  const accents = {
    navy: 'text-navy-900',
    coral: 'text-coral-500',
    teal: 'text-teal-500',
    emerald: 'text-emerald-600',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl p-4 text-left shadow-sm transition ${
        active ? 'bg-navy-900 ring-2 ring-coral-500' : 'bg-white hover:shadow-md'
      }`}
    >
      <p className={`text-xs font-medium uppercase tracking-wide ${active ? 'text-white/60' : 'text-ink-400'}`}>{label}</p>
      <p className={`mt-1 font-display text-2xl font-bold ${active ? 'text-white' : accents[accent]}`}>{value}</p>
      {note && (
        <p className={`mt-0.5 text-[11px] font-medium ${noteUp ? 'text-emerald-600' : 'text-rose-500'}`}>{note}</p>
      )}
    </button>
  )
}
