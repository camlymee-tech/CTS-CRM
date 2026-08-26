import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { Modal, Input, Select, Textarea, Button } from './ui'
import { TRANG_THAI_DON_OPTIONS, formatVnd } from '../lib/constants'

export default function OrderForm({ order, customer, customers = [], profiles = [], currentProfile, onClose, onSaved }) {
  const isEdit = !!order
  const [services, setServices] = useState([])
  const [form, setForm] = useState({
    customer_id: order?.customer_id || customer?.id || '',
    sale_id: order?.sale_id || customer?.sale_id || currentProfile?.id || '',
    ngay_chot: order?.ngay_chot || new Date().toISOString().slice(0, 10),
    so_thang: order?.so_thang || '',
    trang_thai: order?.trang_thai || 'moi',
    ghi_chu: order?.ghi_chu || '',
  })
  const [items, setItems] = useState([{ service_id: '', ten_dich_vu: '', gia: '' }])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('services').select('*').eq('active', true).order('ten_dich_vu')
      .then(({ data }) => setServices(data || []))
    if (isEdit) {
      supabase.from('order_items').select('*').eq('order_id', order.id)
        .then(({ data }) => {
          if (data?.length) setItems(data.map((i) => ({ service_id: i.service_id || '', ten_dich_vu: i.ten_dich_vu, gia: i.gia })))
        })
    }
  }, [])

  function setItem(idx, patch) {
    setItems((old) => old.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  }

  function pickService(idx, serviceId) {
    const sv = services.find((s) => s.id === serviceId)
    setItem(idx, { service_id: serviceId, ten_dich_vu: sv?.ten_dich_vu || '' })
  }

  const tongTien = items.reduce((s, it) => s + (Number(it.gia) || 0), 0)

  async function handleSubmit(e) {
    e.preventDefault()
    const hopLe = items.filter((it) => it.ten_dich_vu)
    if (hopLe.length === 0) { setError('Chọn ít nhất một dịch vụ khách mua'); return }

    setSaving(true)
    setError('')
    const payload = {
      customer_id: form.customer_id || null,
      sale_id: form.sale_id || null,
      ngay_chot: form.ngay_chot || null,
      so_thang: form.so_thang ? Number(form.so_thang) : null,
      trang_thai: form.trang_thai,
      ghi_chu: form.ghi_chu || null,
      gia_tri: tongTien,
    }

    let orderId = order?.id
    if (isEdit) {
      const { error } = await supabase.from('orders').update(payload).eq('id', order.id)
      if (error) { setSaving(false); setError(error.message); return }
      await supabase.from('order_items').delete().eq('order_id', order.id)
    } else {
      const { data, error } = await supabase.from('orders').insert(payload).select().single()
      if (error) { setSaving(false); setError(error.message); return }
      orderId = data.id
    }

    const { error: itemErr } = await supabase.from('order_items').insert(
      hopLe.map((it) => ({
        order_id: orderId,
        service_id: it.service_id || null,
        ten_dich_vu: it.ten_dich_vu,
        gia: Number(it.gia) || 0,
      }))
    )
    setSaving(false)
    if (itemErr) { setError(itemErr.message); return }
    onSaved()
  }

  const tenKhach = customer?.ten_khach || customers.find((c) => c.id === form.customer_id)?.ten_khach

  return (
    <Modal title={isEdit ? `Sửa đơn ${order.ma_don || ''}` : 'Tạo đơn dịch vụ'} onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
        {customer ? (
          <div className="col-span-2 rounded-xl bg-emerald-50 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-emerald-700">Khách hàng</p>
            <p className="font-display font-semibold text-navy-900">{customer.ten_khach}</p>
            {customer.ten_shop && <p className="text-sm text-ink-600">{customer.ten_shop}</p>}
          </div>
        ) : (
          <div className="col-span-2">
            <Select label="Khách hàng *" required value={form.customer_id}
              onChange={(e) => setForm({ ...form, customer_id: e.target.value })}>
              <option value="">-- Chọn khách hàng --</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.ten_khach}{c.ten_shop ? ` — ${c.ten_shop}` : ''}</option>
              ))}
            </Select>
          </div>
        )}

        <div className="col-span-2">
          <p className="mb-2 text-sm font-medium text-navy-900">Dịch vụ khách mua *</p>
          <div className="space-y-2">
            {items.map((it, idx) => (
              <div key={idx} className="flex gap-2">
                <select
                  value={it.service_id}
                  onChange={(e) => pickService(idx, e.target.value)}
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-coral-500"
                >
                  <option value="">-- Chọn dịch vụ --</option>
                  {services.map((s) => <option key={s.id} value={s.id}>{s.ten_dich_vu}</option>)}
                </select>
                <input
                  type="number" min="0" step="1000" placeholder="Giá trị (đ)"
                  value={it.gia}
                  onChange={(e) => setItem(idx, { gia: e.target.value })}
                  className="w-44 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-coral-500"
                />
                {items.length > 1 && (
                  <button type="button" onClick={() => setItems(items.filter((_, i) => i !== idx))}
                    className="rounded-lg px-2 text-ink-400 hover:text-rose-500">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setItems([...items, { service_id: '', ten_dich_vu: '', gia: '' }])}
            className="mt-2 inline-flex items-center gap-1 text-sm text-ink-600 hover:text-coral-500">
            <Plus size={14} /> Thêm dịch vụ
          </button>

          <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
            <span className="text-sm font-medium text-navy-900">Tổng giá trị đơn</span>
            <span className="font-display text-lg font-bold text-coral-500">{formatVnd(tongTien)}</span>
          </div>
        </div>

        <Input label="Ngày chốt đơn" type="date" value={form.ngay_chot || ''}
          onChange={(e) => setForm({ ...form, ngay_chot: e.target.value })} />
        <Input label="Thời hạn (tháng)" type="number" min="0" value={form.so_thang}
          onChange={(e) => setForm({ ...form, so_thang: e.target.value })} placeholder="VD: 3" />

        <Select label="Trạng thái đơn" value={form.trang_thai}
          onChange={(e) => setForm({ ...form, trang_thai: e.target.value })}>
          {TRANG_THAI_DON_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
        <Select label="Sale phụ trách" value={form.sale_id}
          onChange={(e) => setForm({ ...form, sale_id: e.target.value })}>
          <option value="">-- Chưa gán --</option>
          {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
        </Select>

        <div className="col-span-2">
          <Textarea label="Ghi chú" rows={2} value={form.ghi_chu}
            onChange={(e) => setForm({ ...form, ghi_chu: e.target.value })} />
        </div>

        {error && <p className="col-span-2 text-sm text-rose-600">{error}</p>}

        <div className="col-span-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Hủy</Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Đang lưu...' : isEdit ? 'Lưu đơn' : 'Tạo đơn dịch vụ'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
