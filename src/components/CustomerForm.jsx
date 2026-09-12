import { useEffect, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { Modal, Input, Select, Textarea, Button, Badge } from './ui'
import { useTrangThai } from '../lib/StatusContext'
import {
  NEN_TANG_OPTIONS,
  DICH_VU_OPTIONS,
  LOAI_KHACH_OPTIONS,
  NGUON_KHACH_OPTIONS,
  labelOf,
} from '../lib/constants'

export default function CustomerForm({ customer, profiles, currentProfile, onClose, onSaved }) {
  const { options: TRANG_THAI, tenTrangThai, classTrangThai, maTaoDon } = useTrangThai()
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
  const [khachTrung, setKhachTrung] = useState(null)
  const [dangKiemTra, setDangKiemTra] = useState(false)
  const [saleList, setSaleList] = useState({})

  const chiSo = (v) => (v || '').replace(/\D/g, '')

  // Kiểm tra trùng số điện thoại ngay khi gõ
  useEffect(() => {
    const so = chiSo(form.sdt)
    if (so.length < 8) { setKhachTrung(null); return }
    setDangKiemTra(true)
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc('tim_khach_theo_sdt', { p_sdt: form.sdt })
      const trung = (data || []).find((k) => k.id !== customer?.id)
      setKhachTrung(trung || null)
      if (trung?.sale_id && !saleList[trung.sale_id]) {
        const { data: p } = await supabase.from('profiles').select('id, full_name').eq('id', trung.sale_id).single()
        if (p) setSaleList((old) => ({ ...old, [p.id]: p.full_name }))
      }
      setDangKiemTra(false)
    }, 500)
    return () => clearTimeout(t)
  }, [form.sdt])

  function toggleArray(field, value) {
    setForm((f) => ({
      ...f,
      [field]: f[field].includes(value) ? f[field].filter((v) => v !== value) : [...f[field], value],
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (khachTrung) {
      setError('Số điện thoại này đã có trong hệ thống. Vui lòng dùng số khác hoặc cập nhật vào khách hàng đã có.')
      return
    }
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
    if (error) {
      setError(error.message.includes('SDT_TRUNG')
        ? 'Số điện thoại này đã thuộc về một khách hàng khác trong hệ thống.'
        : error.message)
      return
    }

    // Vừa chuyển sang "Đã ký hợp đồng" -> mời tạo đơn dịch vụ ngay
    const vuaChotDon = maTaoDon.includes(form.trang_thai_cham_soc) && !maTaoDon.includes(trangThaiCu)
    onSaved(vuaChotDon ? data : null)
  }

  const chotDon = maTaoDon.includes(form.trang_thai_cham_soc) && !maTaoDon.includes(trangThaiCu)

  return (
    <Modal title={isEdit ? 'Sửa thông tin khách hàng' : 'Thêm khách hàng mới'} onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
        <Input label="Tên khách hàng *" required value={form.ten_khach}
          onChange={(e) => setForm({ ...form, ten_khach: e.target.value })} />
        <div>
          <Input label="Số điện thoại" value={form.sdt}
            onChange={(e) => setForm({ ...form, sdt: e.target.value })}
            className={khachTrung ? 'border-amber-400 bg-amber-50' : ''} />
          {dangKiemTra && <p className="mt-1 text-xs text-ink-400">Đang kiểm tra trùng...</p>}
        </div>
        <Input label="Ngành hàng" value={form.nganh_hang}
          onChange={(e) => setForm({ ...form, nganh_hang: e.target.value })}
          placeholder="Thời trang, mỹ phẩm..." />
        <Input label="Link Facebook cá nhân" value={form.link_fb}
          onChange={(e) => setForm({ ...form, link_fb: e.target.value })}
          placeholder="https://facebook.com/..." />
        <Input label="Link shop" value={form.link_shop}
          onChange={(e) => setForm({ ...form, link_shop: e.target.value })}
          placeholder="https://shopee.vn/... hoặc TikTok Shop" />

        {khachTrung && (
          <div className="col-span-2 rounded-xl border border-amber-300 bg-amber-50 p-4">
            <div className="flex items-center gap-2 text-amber-900">
              <TriangleAlert size={16} />
              <p className="text-sm font-semibold">Số điện thoại này đã có trong hệ thống</p>
            </div>
            <div className="mt-3 rounded-lg bg-white/70 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display font-semibold text-navy-900">{khachTrung.ten_khach}</p>
                  <p className="text-xs text-ink-400">{khachTrung.ma_khach} · {khachTrung.sdt}</p>
                </div>
                <Badge className={classTrangThai(khachTrung.trang_thai_cham_soc)}>
                  {tenTrangThai(khachTrung.trang_thai_cham_soc)}
                </Badge>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-ink-600">
                <span>Sale phụ trách: <b className="text-navy-900">{saleList[khachTrung.sale_id] || 'Chưa gán'}</b></span>
                <span>Nguồn: <b className="text-navy-900">{labelOf(NGUON_KHACH_OPTIONS, khachTrung.nguon_khach)}</b></span>
                <span>Ngành hàng: <b className="text-navy-900">{khachTrung.nganh_hang || '—'}</b></span>
                <span>Liên hệ gần nhất: <b className="text-navy-900">{khachTrung.ngay_lien_he_gan_nhat || '—'}</b></span>
              </div>
            </div>
            <p className="mt-3 text-xs text-amber-800">
              Không thể tạo trùng số. Hãy dùng số khác, hoặc đóng form này và cập nhật trực tiếp vào khách hàng ở trên.
            </p>
          </div>
        )}

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
          {TRANG_THAI.map((o) => <option key={o.ma} value={o.ma}>{o.ten}</option>)}
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

        

        {chotDon && (
          <p className="col-span-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Sau khi lưu, app sẽ mở form tạo đơn dịch vụ để bạn chọn dịch vụ khách mua và nhập giá trị đơn.
          </p>
        )}

        {error && <p className="col-span-2 text-sm text-rose-600">{error}</p>}

        <div className="col-span-2 mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Hủy</Button>
          <Button type="submit" disabled={saving || !!khachTrung}>
            {saving ? 'Đang lưu...' : khachTrung ? 'Số điện thoại bị trùng' : 'Lưu khách hàng'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
