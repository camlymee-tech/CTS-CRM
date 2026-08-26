import { useEffect, useMemo, useState } from 'react'
import { Search, Pencil, ExternalLink, FileText, AlertTriangle } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { Button, Input, Select, Badge, Modal, Textarea } from './ui'
import { TRANG_THAI_HD_OPTIONS, classOf, labelOf, formatVnd } from '../lib/constants'

export default function ContractsPage({ currentProfile }) {
  const [contracts, setContracts] = useState([])
  const [customers, setCustomers] = useState([])
  const [orders, setOrders] = useState([])
  const [items, setItems] = useState({})
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterTT, setFilterTT] = useState('')
  const [editing, setEditing] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: ct }, { data: cu }, { data: od }, { data: it }, { data: pf }] = await Promise.all([
      supabase.from('contracts').select('*').order('ngay_ky', { ascending: false }),
      supabase.from('customers').select('id, ten_khach, ma_khach, sdt'),
      supabase.from('orders').select('id, ma_don, sale_id'),
      supabase.from('order_items').select('*'),
      supabase.from('profiles').select('id, full_name'),
    ])
    setContracts(ct || []); setCustomers(cu || []); setOrders(od || []); setProfiles(pf || [])
    const g = {}
    for (const i of it || []) g[i.order_id] = [...(g[i.order_id] || []), i]
    setItems(g)
    setLoading(false)
  }

  const khach = (id) => customers.find((c) => c.id === id)
  const don = (id) => orders.find((o) => o.id === id)
  const tenSale = (id) => profiles.find((p) => p.id === id)?.full_name || '—'

  const homNay = new Date().toISOString().slice(0, 10)

  const filtered = useMemo(() => contracts.filter((c) => {
    if (filterTT && c.trang_thai !== filterTT) return false
    if (search) {
      const k = khach(c.customer_id)
      const d = don(c.order_id)
      const dv = (items[c.order_id] || []).map((i) => i.ten_dich_vu).join(' ')
      if (!`${c.so_hop_dong} ${k?.ten_khach || ''} ${k?.sdt || ''} ${d?.ma_don || ''} ${dv}`
        .toLowerCase().includes(search.toLowerCase())) return false
    }
    return true
  }), [contracts, customers, orders, items, search, filterTT])

  const tongGiaTri = filtered.filter((c) => c.trang_thai !== 'da_huy')
    .reduce((s, c) => s + (Number(c.gia_tri) || 0), 0)
  const sapHetHan = contracts.filter((c) => c.trang_thai === 'hieu_luc' && c.ngay_het_han
    && c.ngay_het_han >= homNay
    && c.ngay_het_han <= new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10))

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="border-b border-slate-200 bg-white px-8 py-5">
        <h1 className="font-display text-xl font-bold text-navy-900">Hợp đồng</h1>
        <p className="text-sm text-ink-600">
          Hợp đồng tự sinh khi tạo đơn dịch vụ. Một khách có thể có nhiều hợp đồng.
        </p>
      </header>

      <div className="grid grid-cols-3 gap-4 px-8 pt-6">
        <StatCard label="Tổng hợp đồng" value={filtered.length} />
        <StatCard label="Tổng giá trị" value={formatVnd(tongGiaTri)} accent="coral" />
        <StatCard label="Sắp hết hạn trong 30 ngày" value={sapHetHan.length}
          accent={sapHetHan.length ? 'amber' : 'teal'} />
      </div>

      {sapHetHan.length > 0 && (
        <div className="mx-8 mt-4 flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle size={16} className="mt-0.5 flex-none" />
          <div>
            <b>{sapHetHan.length} hợp đồng sắp hết hạn</b> — đây là cơ hội tái ký, nên liên hệ khách trước khi hết hạn:{' '}
            {sapHetHan.slice(0, 5).map((c) => khach(c.customer_id)?.ten_khach).filter(Boolean).join(', ')}
            {sapHetHan.length > 5 && `, và ${sapHetHan.length - 5} khách khác`}
          </div>
        </div>
      )}

      <div className="mx-8 mt-6 flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
        <div className="relative min-w-[220px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <Input placeholder="Tìm theo số HĐ, khách hàng, SĐT, mã đơn, dịch vụ..." value={search}
            onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterTT} onChange={(e) => setFilterTT(e.target.value)} className="w-48">
          <option value="">Tất cả trạng thái</option>
          {TRANG_THAI_HD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      </div>

      <div className="mx-8 my-6 overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full min-w-[1000px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-ink-400">
              <th className="px-5 py-3">Số hợp đồng</th>
              <th className="px-5 py-3">Khách hàng</th>
              <th className="px-5 py-3">Dịch vụ</th>
              <th className="px-5 py-3 text-right">Giá trị</th>
              <th className="px-5 py-3">Ngày ký</th>
              <th className="px-5 py-3">Hết hạn</th>
              <th className="px-5 py-3">Sale</th>
              <th className="px-5 py-3">Trạng thái</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="px-5 py-8 text-center text-ink-400">Đang tải...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9} className="px-5 py-8 text-center text-ink-400">
                {contracts.length === 0
                  ? 'Chưa có hợp đồng nào. Hợp đồng sẽ tự tạo khi bạn tạo đơn dịch vụ.'
                  : 'Không tìm thấy hợp đồng phù hợp.'}
              </td></tr>
            ) : filtered.map((c) => {
              const k = khach(c.customer_id)
              const d = don(c.order_id)
              const hetHanSom = c.trang_thai === 'hieu_luc' && c.ngay_het_han && c.ngay_het_han < homNay
              return (
                <tr key={c.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <p className="font-medium text-navy-900">{c.so_hop_dong}</p>
                    {d && <p className="text-xs text-ink-400">Đơn {d.ma_don}</p>}
                  </td>
                  <td className="px-5 py-3">
                    <p className="text-navy-900">{k?.ten_khach || '—'}</p>
                    <p className="text-xs text-ink-400">{k?.ma_khach}</p>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(items[c.order_id] || []).map((i) => (
                        <Badge key={i.id} className="bg-slate-100 text-slate-600">{i.ten_dich_vu}</Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right font-medium text-navy-900">{formatVnd(c.gia_tri)}</td>
                  <td className="px-5 py-3 text-ink-600">{c.ngay_ky || '—'}</td>
                  <td className="px-5 py-3">
                    <span className={hetHanSom ? 'text-rose-500' : 'text-ink-600'}>
                      {c.ngay_het_han || '—'}
                    </span>
                    {c.thoi_han_thang && <p className="text-xs text-ink-400">{c.thoi_han_thang} tháng</p>}
                  </td>
                  <td className="px-5 py-3 text-ink-600">{tenSale(d?.sale_id)}</td>
                  <td className="px-5 py-3">
                    <Badge className={classOf(TRANG_THAI_HD_OPTIONS, c.trang_thai)}>
                      {labelOf(TRANG_THAI_HD_OPTIONS, c.trang_thai)}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-right">
                    {c.file_url && (
                      <a href={c.file_url} target="_blank" rel="noreferrer"
                        className="mr-3 inline-flex text-teal-500 hover:text-teal-600" title="Mở file hợp đồng">
                        <ExternalLink size={14} />
                      </a>
                    )}
                    <button onClick={() => setEditing(c)}
                      className="text-ink-400 hover:text-coral-500" title="Sửa hợp đồng">
                      <Pencil size={14} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {editing && (
        <ContractForm contract={editing} khach={khach(editing.customer_id)}
          onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />
      )}
    </div>
  )
}

function ContractForm({ contract, khach, onClose, onSaved }) {
  const [form, setForm] = useState({
    so_hop_dong: contract.so_hop_dong || '',
    ngay_ky: contract.ngay_ky || '',
    thoi_han_thang: contract.thoi_han_thang || '',
    ngay_het_han: contract.ngay_het_han || '',
    trang_thai: contract.trang_thai || 'hieu_luc',
    file_url: contract.file_url || '',
    ghi_chu: contract.ghi_chu || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setSaving(true); setError('')
    const { error } = await supabase.from('contracts').update({
      so_hop_dong: form.so_hop_dong,
      ngay_ky: form.ngay_ky || null,
      thoi_han_thang: form.thoi_han_thang ? Number(form.thoi_han_thang) : null,
      ngay_het_han: form.ngay_het_han || null,
      trang_thai: form.trang_thai,
      file_url: form.file_url || null,
      ghi_chu: form.ghi_chu || null,
    }).eq('id', contract.id)
    setSaving(false)
    if (error) { setError(error.message); return }
    onSaved()
  }

  return (
    <Modal title={`Hợp đồng ${contract.so_hop_dong}`} onClose={onClose} wide>
      <form onSubmit={submit} className="grid grid-cols-2 gap-4">
        <div className="col-span-2 rounded-xl bg-slate-50 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-ink-400">Khách hàng</p>
          <p className="font-display font-semibold text-navy-900">{khach?.ten_khach || '—'}</p>
          <p className="text-sm text-ink-600">
            Giá trị {formatVnd(contract.gia_tri)} · lấy từ đơn dịch vụ, sửa ở trang Đơn dịch vụ
          </p>
        </div>

        <Input label="Số hợp đồng" value={form.so_hop_dong}
          onChange={(e) => setForm({ ...form, so_hop_dong: e.target.value })} />
        <Select label="Trạng thái" value={form.trang_thai}
          onChange={(e) => setForm({ ...form, trang_thai: e.target.value })}>
          {TRANG_THAI_HD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>

        <Input label="Ngày ký" type="date" value={form.ngay_ky}
          onChange={(e) => setForm({ ...form, ngay_ky: e.target.value })} />
        <Input label="Thời hạn (tháng)" type="number" min="0" value={form.thoi_han_thang}
          onChange={(e) => setForm({ ...form, thoi_han_thang: e.target.value })} />

        <div className="col-span-2">
          <Input label="Ngày hết hạn" type="date" value={form.ngay_het_han}
            onChange={(e) => setForm({ ...form, ngay_het_han: e.target.value })} />
          <p className="mt-1 text-xs text-ink-400">Để trống sẽ tự tính từ ngày ký + thời hạn.</p>
        </div>

        <div className="col-span-2">
          <Input label="Link file hợp đồng" value={form.file_url}
            onChange={(e) => setForm({ ...form, file_url: e.target.value })}
            placeholder="Link Google Drive bản scan hợp đồng đã ký..." />
        </div>

        <div className="col-span-2">
          <Textarea label="Ghi chú" rows={2} value={form.ghi_chu}
            onChange={(e) => setForm({ ...form, ghi_chu: e.target.value })} />
        </div>

        {error && <p className="col-span-2 text-sm text-rose-600">{error}</p>}

        <div className="col-span-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Hủy</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu hợp đồng'}</Button>
        </div>
      </form>
    </Modal>
  )
}

function StatCard({ label, value, accent = 'navy' }) {
  const accents = {
    navy: 'text-navy-900', coral: 'text-coral-500',
    teal: 'text-teal-500', amber: 'text-amber-600',
  }
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-400">{label}</p>
      <p className={`mt-1 font-display text-2xl font-bold ${accents[accent]}`}>{value}</p>
    </div>
  )
}
