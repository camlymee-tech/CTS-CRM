import { useEffect, useMemo, useState } from 'react'
import { Plus, Search, Phone } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { Button, Input, Select, Badge } from './ui'
import CustomerForm from './CustomerForm'
import CustomerDetail from './CustomerDetail'
import {
  NEN_TANG_OPTIONS,
  LOAI_KHACH_OPTIONS,
  TRANG_THAI_OPTIONS,
  classOf,
  labelOf,
} from '../lib/constants'

export default function CustomerList({ currentProfile }) {
  const [customers, setCustomers] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterLoai, setFilterLoai] = useState('')
  const [filterTrangThai, setFilterTrangThai] = useState('')
  const [filterSale, setFilterSale] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [viewingCustomer, setViewingCustomer] = useState(null)

  useEffect(() => {
    loadProfiles()
    loadCustomers()
  }, [])

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

  const filtered = useMemo(() => {
    return customers.filter((c) => {
      if (search && !`${c.ten_khach} ${c.ten_shop} ${c.ma_khach} ${c.sdt}`.toLowerCase().includes(search.toLowerCase())) return false
      if (filterLoai && c.loai_khach !== filterLoai) return false
      if (filterTrangThai && c.trang_thai_cham_soc !== filterTrangThai) return false
      if (filterSale && c.sale_id !== filterSale) return false
      return true
    })
  }, [customers, search, filterLoai, filterTrangThai, filterSale])

  const stats = useMemo(() => {
    const total = customers.length
    const moi = customers.filter((c) => c.loai_khach === 'moi').length
    const cu = customers.filter((c) => c.loai_khach === 'cu').length
    const daKy = customers.filter((c) => c.trang_thai_cham_soc === 'da_ky' || c.trang_thai_cham_soc === 'dang_trien_khai').length
    return { total, moi, cu, daKy }
  }, [customers])

  function profileName(id) {
    return profiles.find((p) => p.id === id)?.full_name || '—'
  }

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

      <div className="grid grid-cols-4 gap-4 px-8 pt-6">
        <StatCard label="Tổng khách hàng" value={stats.total} />
        <StatCard label="Khách mới" value={stats.moi} accent="coral" />
        <StatCard label="Khách cũ" value={stats.cu} accent="teal" />
        <StatCard label="Đã ký / đang triển khai" value={stats.daKy} accent="emerald" />
      </div>

      <div className="mx-8 mt-6 flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <Input
            placeholder="Tìm theo tên, shop, mã KH, SĐT..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterLoai} onChange={(e) => setFilterLoai(e.target.value)} className="w-40">
          <option value="">Tất cả loại khách</option>
          {LOAI_KHACH_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
        <Select value={filterTrangThai} onChange={(e) => setFilterTrangThai(e.target.value)} className="w-48">
          <option value="">Tất cả trạng thái</option>
          {TRANG_THAI_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
        <Select value={filterSale} onChange={(e) => setFilterSale(e.target.value)} className="w-44">
          <option value="">Tất cả sale</option>
          {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
        </Select>
      </div>

      <div className="mx-8 my-6 overflow-hidden rounded-2xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-ink-400">
              <th className="px-5 py-3">Khách hàng</th>
              <th className="px-5 py-3">Nền tảng</th>
              <th className="px-5 py-3">Loại khách</th>
              <th className="px-5 py-3">Trạng thái</th>
              <th className="px-5 py-3">Sale phụ trách</th>
              <th className="px-5 py-3">Liên hệ gần nhất</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-5 py-8 text-center text-ink-400">Đang tải...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-5 py-8 text-center text-ink-400">Chưa có khách hàng nào phù hợp.</td></tr>
            ) : (
              filtered.map((c) => (
                <tr
                  key={c.id}
                  className="cursor-pointer border-b border-slate-50 last:border-0 hover:bg-slate-50"
                  onClick={() => setViewingCustomer(c)}
                >
                  <td className="px-5 py-3">
                    <p className="font-medium text-navy-900">{c.ten_khach}</p>
                    <p className="text-xs text-ink-400">{c.ma_khach} {c.ten_shop && `· ${c.ten_shop}`}</p>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-1">
                      {(c.nen_tang || []).map((nt) => (
                        <Badge key={nt} className={classOf(NEN_TANG_OPTIONS, nt)}>{labelOf(NEN_TANG_OPTIONS, nt)}</Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <Badge className={c.loai_khach === 'moi' ? 'bg-coral-50 text-coral-600' : 'bg-slate-100 text-slate-600'}>
                      {labelOf(LOAI_KHACH_OPTIONS, c.loai_khach)}
                    </Badge>
                  </td>
                  <td className="px-5 py-3">
                    <Badge className={classOf(TRANG_THAI_OPTIONS, c.trang_thai_cham_soc)}>
                      {labelOf(TRANG_THAI_OPTIONS, c.trang_thai_cham_soc)}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 text-ink-600">{profileName(c.sale_id)}</td>
                  <td className="px-5 py-3 text-ink-600">{c.ngay_lien_he_gan_nhat || '—'}</td>
                  <td className="px-5 py-3 text-right">
                    <a
                      href={c.sdt ? `tel:${c.sdt}` : undefined}
                      onClick={(e) => e.stopPropagation()}
                      className={`inline-flex items-center gap-1 text-xs ${c.sdt ? 'text-teal-500 hover:underline' : 'text-ink-400'}`}
                    >
                      <Phone size={13} /> Gọi
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <CustomerForm
          customer={editingCustomer}
          profiles={profiles}
          currentProfile={currentProfile}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); loadCustomers() }}
        />
      )}

      {viewingCustomer && (
        <CustomerDetail
          customer={viewingCustomer}
          currentProfile={currentProfile}
          onClose={() => setViewingCustomer(null)}
          onChanged={loadCustomers}
          onEdit={(c) => { setViewingCustomer(null); setEditingCustomer(c); setShowForm(true) }}
        />
      )}
    </div>
  )
}

function StatCard({ label, value, accent = 'navy' }) {
  const accents = {
    navy: 'text-navy-900',
    coral: 'text-coral-500',
    teal: 'text-teal-500',
    emerald: 'text-emerald-600',
  }
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-400">{label}</p>
      <p className={`mt-1 font-display text-2xl font-bold ${accents[accent]}`}>{value}</p>
    </div>
  )
}
