import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { Modal, Input, Select, Textarea, Button } from './ui'
import { formatVnd } from '../lib/constants'

// Đơn có thể gồm nhiều dịch vụ; hợp đồng chỉ có 1 loại (ads/xay_shop), nên ưu
// tiên dịch vụ "Xây shop"/"Tối ưu sản phẩm" làm dịch vụ chính, còn lại là "Chạy quảng cáo"
function goiChinhCuaDon(items, packages) {
  const xayShop = items.find((it) => it.package_id && /xây shop|tối ưu/i.test(it.ten_dich_vu))
  const ads = items.find((it) => it.package_id && /quảng cáo/i.test(it.ten_dich_vu))
  const it = xayShop || ads
  const pk = it && packages.find((p) => p.id === it.package_id)
  if (!pk) return null
  return {
    loai_dich_vu: xayShop ? 'xay_shop' : 'ads',
    ten_goi: pk.ten_goi,
    so_san_pham: pk.so_san_pham || null,
    noi_dung_hd: pk.noi_dung_hd || null,
  }
}

export default function OrderForm({ order, customer, customers = [], profiles = [], currentProfile, onClose, onSaved }) {
  const isEdit = !!order
  const [services, setServices] = useState([])
  const [packages, setPackages] = useState([])
  const [form, setForm] = useState({
    customer_id: order?.customer_id || customer?.id || '',
    sale_id: order?.sale_id || customer?.sale_id || currentProfile?.id || '',
    ngay_chot: order?.ngay_chot || new Date().toISOString().slice(0, 10),
    so_thang: order?.so_thang || '',
    ghi_chu: order?.ghi_chu || '',
  })
  const [items, setItems] = useState([{ service_id: '', package_id: '', ten_dich_vu: '', ten_goi: '', gia: '', so_thang: '' }])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('services').select('*').eq('active', true).order('ten_dich_vu')
      .then(({ data }) => setServices(data || []))
    supabase.from('service_packages').select('*').eq('active', true).order('thu_tu')
      .then(({ data }) => setPackages(data || []))
    if (isEdit) {
      supabase.from('order_items').select('*').eq('order_id', order.id)
        .then(({ data }) => {
          if (data?.length) setItems(data.map((i) => ({
            service_id: i.service_id || '', package_id: i.package_id || '',
            ten_dich_vu: i.ten_dich_vu, ten_goi: i.ten_goi || '',
            gia: i.gia, so_thang: i.so_thang || '',
          })))
        })
    }
  }, [])

  function setItem(idx, patch) {
    setItems((old) => old.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  }

  function pickService(idx, serviceId) {
    const sv = services.find((s) => s.id === serviceId)
    // Đổi dịch vụ thì bỏ gói cũ đi
    setItem(idx, { service_id: serviceId, ten_dich_vu: sv?.ten_dich_vu || '', package_id: '', ten_goi: '', gia: '', so_thang: '' })
  }

  function pickPackage(idx, packageId) {
    const pk = packages.find((p) => p.id === packageId)
    setItem(idx, {
      package_id: packageId,
      ten_goi: pk?.ten_goi || '',
      gia: pk ? String(pk.gia) : '',
      so_thang: pk?.so_thang || '',
    })
  }

  const goiCua = (serviceId) => packages.filter((p) => p.service_id === serviceId)

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
      so_thang: form.so_thang ? Number(form.so_thang)
        : (Math.max(0, ...hopLe.map((it) => Number(it.so_thang) || 0)) || null),
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
        package_id: it.package_id || null,
        ten_dich_vu: it.ten_dich_vu,
        ten_goi: it.ten_goi || null,
        so_thang: it.so_thang ? Number(it.so_thang) : null,
        gia: Number(it.gia) || 0,
      }))
    )
    if (itemErr) { setSaving(false); setError(itemErr.message); return }

    // Đẩy tên gói, số sản phẩm, nội dung triển khai sang hợp đồng tự sinh của đơn —
    // để mở trang Hợp đồng lên là đã có sẵn, không cần điền lại thủ công
    const goiChinh = goiChinhCuaDon(hopLe, packages)
    if (goiChinh) {
      await supabase.from('contracts').update(goiChinh).eq('order_id', orderId)
    }

    setSaving(false)
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
            {customer.ma_khach && <p className="text-sm text-ink-600">{customer.ma_khach}</p>}
          </div>
        ) : (
          <div className="col-span-2">
            <Select label="Khách hàng *" required value={form.customer_id}
              onChange={(e) => setForm({ ...form, customer_id: e.target.value })}>
              <option value="">-- Chọn khách hàng --</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.ten_khach}{c.ma_khach ? ` — ${c.ma_khach}` : ''}</option>
              ))}
            </Select>
          </div>
        )}

        <div className="col-span-2">
          <p className="mb-2 text-sm font-medium text-navy-900">Dịch vụ khách mua *</p>
          <div className="space-y-2">
            {items.map((it, idx) => {
              const dsGoi = goiCua(it.service_id)
              const goiDangChon = packages.find((p) => p.id === it.package_id)
              return (
                <div key={idx} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-start gap-2">
                    <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,9rem)]">
                      <select
                        value={it.service_id}
                        onChange={(e) => pickService(idx, e.target.value)}
                        className="w-full min-w-0 truncate rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-coral-500"
                      >
                        <option value="">-- Chọn dịch vụ --</option>
                        {services.map((s) => <option key={s.id} value={s.id}>{s.ten_dich_vu}</option>)}
                      </select>

                      <select
                        value={it.package_id}
                        disabled={!it.service_id}
                        onChange={(e) => pickPackage(idx, e.target.value)}
                        className="w-full min-w-0 truncate rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-coral-500 disabled:bg-slate-50 disabled:text-ink-400"
                      >
                        <option value="">{it.service_id ? '-- Chọn gói --' : 'Chọn dịch vụ trước'}</option>
                        {dsGoi.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.ten_goi} — {formatVnd(p.gia)}
                          </option>
                        ))}
                      </select>

                      <input
                        type="text" inputMode="numeric" placeholder="Giá (đ)"
                        value={it.gia === '' ? '' : Number(it.gia).toLocaleString('vi-VN')}
                        onChange={(e) => setItem(idx, { gia: e.target.value.replace(/\D/g, '') })}
                        className="w-full min-w-0 rounded-lg border border-slate-200 px-3 py-2 text-right text-sm outline-none focus:border-coral-500"
                      />
                    </div>

                    {items.length > 1 && (
                      <button type="button" onClick={() => setItems(items.filter((_, i) => i !== idx))}
                        className="mt-2 flex-none text-ink-400 hover:text-rose-500">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>

                  {goiDangChon && (
                    <p className="mt-2 text-xs text-ink-600">
                      {goiDangChon.so_thang ? <b className="text-navy-900">{goiDangChon.so_thang} tháng · </b> : null}
                      {goiDangChon.mo_ta}
                    </p>
                  )}
                  {it.package_id && Number(it.gia) !== Number(goiDangChon?.gia) && (
                    <p className="mt-1 text-xs text-amber-700">
                      Giá đã sửa khác bảng giá gốc ({formatVnd(goiDangChon?.gia)})
                    </p>
                  )}
                </div>
              )
            })}
          </div>
          <button type="button" onClick={() => setItems([...items, { service_id: '', package_id: '', ten_dich_vu: '', ten_goi: '', gia: '', so_thang: '' }])}
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
          onChange={(e) => setForm({ ...form, so_thang: e.target.value })}
          placeholder="Để trống sẽ lấy theo gói" />

        <div className="col-span-2">
          <Select label="Sale phụ trách" value={form.sale_id}
            onChange={(e) => setForm({ ...form, sale_id: e.target.value })}>
            <option value="">-- Chưa gán --</option>
            {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </Select>
          <p className="mt-1 text-xs text-ink-400">
            Trạng thái đơn bám theo trạng thái khách hàng, đổi ở trang Khách hàng.
          </p>
        </div>

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
