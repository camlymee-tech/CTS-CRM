import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { Modal, Input, Select, Textarea, Button } from './ui'
import {
  NEN_TANG_OPTIONS,
  DICH_VU_OPTIONS,
  LOAI_KHACH_OPTIONS,
  NGUON_KHACH_OPTIONS,
  TRANG_THAI_OPTIONS,
} from '../lib/constants'

export default function CustomerForm({ customer, profiles, currentProfile, onClose, onSaved }) {
  const isEdit = !!customer
  const trangThaiCu = customer?.trang_thai_cham_soc || null
  const [form, setForm] = useState({
    ten_khach: customer?.ten_khach || '',
    link_fb: customer?.link_fb || '',
    link_shop: customer?.link_shop || '',
    sdt: customer?.sdt || '',
    nen_tang: customer?.nen_tang || [],
    dich_vu: customer?.dich_vu || [],
    nganh_hang: customer?.nganh_hang || '',
    loai_khach: customer?.loai_khach || 'moi',
    nguon_khach: customer?.nguon_khach || 'tu_tim',
    trang_thai_cham_soc: customer?.trang_thai_cham_soc || 'chua_lien_he',
    sale_id: customer?.sale_id || currentProfile?.id || '',
    ngay_lien_he_gan_nhat: customer?.ngay_lien_he_gan_nhat || '',
    ngay_cham_soc_tiep_theo: customer?.ngay_cham_soc_tiep_theo || '',
    ghi_chu: customer?.ghi_chu || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function toggleArray(field, value) {
    setForm((f) => ({
      ...f,
      [field]: f[field].includes(value) ? f[field].filter((v) => v !== value) : [...f[field], value],
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const payload = {
      ...form,
      ngay_lien_he_gan_nhat: form.ngay_lien_he_gan_nhat || null,
      ngay_cham_soc_tiep_theo: form.ngay_cham_soc_tiep_theo || null,
      sale_id: form.sale_id || null,
      link_fb: form.link_fb || null,
      link_shop: form.link_shop || null,
    }
    const { data, error } = isEdit
      ? await supabase.from('customers').update(payload).eq('id', customer.id).select().single()
      : await supabase.from('customers').insert(payload).select().single()
    setSaving(false)
    if (error) { setError(error.message); return }

    // Vừa chuyển sang "Đã ký hợp đồng" -> mời tạo đơn dịch vụ ngay
    const vuaChotDon = form.trang_thai_cham_soc === 'da_ky' && trangThaiCu !== 'da_ky'
    onSaved(vuaChotDon ? data : null)
  }

  const chotDon = form.trang_thai_cham_soc === 'da_ky' && trangThaiCu !== 'da_ky'

  return (
    <Modal title={isEdit ? 'Sửa thông tin khách hàng' : 'Thêm khách hàng mới'} onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
        <Input label="Tên khách hàng *" required value={form.ten_khach}
          onChange={(e) => setForm({ ...form, ten_khach: e.target.value })} />
        <Input label="Số điện thoại" value={form.sdt}
          onChange={(e) => setForm({ ...form, sdt: e.target.value })} />
        <Input label="Ngành hàng" value={form.nganh_hang}
          onChange={(e) => setForm({ ...form, nganh_hang: e.target.value })}
          placeholder="Thời trang, mỹ phẩm..." />
        <Input label="Link Facebook cá nhân" value={form.link_fb}
          onChange={(e) => setForm({ ...form, link_fb: e.target.value })}
          placeholder="https://facebook.com/..." />
        <Input label="Link shop" value={form.link_shop}
          onChange={(e) => setForm({ ...form, link_shop: e.target.value })}
          placeholder="https://shopee.vn/... hoặc TikTok Shop" />

        <div className="col-span-2 flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-navy-900">Nền tảng</span>
          <div className="flex gap-2">
            {NEN_TANG_OPTIONS.map((opt) => (
              <button type="button" key={opt.value} onClick={() => toggleArray('nen_tang', opt.value)}
                className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                  form.nen_tang.includes(opt.value) ? opt.className : 'border-slate-200 text-ink-600'
                }`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="col-span-2 flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-navy-900">Dịch vụ quan tâm</span>
          <div className="flex gap-2">
            {DICH_VU_OPTIONS.map((opt) => (
              <button type="button" key={opt.value} onClick={() => toggleArray('dich_vu', opt.value)}
                className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                  form.dich_vu.includes(opt.value) ? opt.className : 'border-slate-200 text-ink-600'
                }`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <Select label="Loại khách" value={form.loai_khach}
          onChange={(e) => setForm({ ...form, loai_khach: e.target.value })}>
          {LOAI_KHACH_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
        <Select label="Nguồn khách hàng" value={form.nguon_khach}
          onChange={(e) => setForm({ ...form, nguon_khach: e.target.value })}>
          {NGUON_KHACH_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>

        <Select label="Trạng thái chăm sóc" value={form.trang_thai_cham_soc}
          onChange={(e) => setForm({ ...form, trang_thai_cham_soc: e.target.value })}>
          {TRANG_THAI_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
        <Select label="Sale phụ trách" value={form.sale_id}
          onChange={(e) => setForm({ ...form, sale_id: e.target.value })}>
          <option value="">-- Chưa gán --</option>
          {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name || p.id}</option>)}
        </Select>

        <Input label="Ngày liên hệ gần nhất" type="date" value={form.ngay_lien_he_gan_nhat || ''}
          onChange={(e) => setForm({ ...form, ngay_lien_he_gan_nhat: e.target.value })} />
        <Input label="Ngày chăm sóc tiếp theo" type="date" value={form.ngay_cham_soc_tiep_theo || ''}
          onChange={(e) => setForm({ ...form, ngay_cham_soc_tiep_theo: e.target.value })} />

        <div className="col-span-2">
          <Textarea label="Ghi chú" rows={3} value={form.ghi_chu}
            onChange={(e) => setForm({ ...form, ghi_chu: e.target.value })} />
        </div>

        {chotDon && (
          <p className="col-span-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Sau khi lưu, app sẽ mở form tạo đơn dịch vụ để bạn chọn dịch vụ khách mua và nhập giá trị đơn.
          </p>
        )}

        {error && <p className="col-span-2 text-sm text-rose-600">{error}</p>}

        <div className="col-span-2 mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Hủy</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu khách hàng'}</Button>
        </div>
      </form>
    </Modal>
  )
}
