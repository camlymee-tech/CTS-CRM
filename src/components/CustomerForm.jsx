import { useEffect, useState } from 'react'
import { TriangleAlert, Upload } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { Modal, Input, Select, Button, Badge } from './ui'
import { useTrangThai } from '../lib/StatusContext'
import { TINH_THANH } from '../lib/constants'

export default function CustomerForm({ customer, profiles, currentProfile, onClose, onSaved, onTaiFile }) {
  const { options: TRANG_THAI, tenTrangThai, classTrangThai, maTaoDon } = useTrangThai()
  const isEdit = !!customer
  const trangThaiCu = customer?.trang_thai_cham_soc || null
  const [form, setForm] = useState({
    ten_khach: customer?.ten_khach || '',
    khu_vuc: customer?.khu_vuc || '',
    link_fb: customer?.link_fb || '',
    link_shop: customer?.link_shop || '',
    dia_chi: customer?.dia_chi || '',
    mst: customer?.mst || '',
    nguoi_dai_dien: customer?.nguoi_dai_dien || '',
    chuc_vu: customer?.chuc_vu || '',
    email: customer?.email || '',
    sdt: customer?.sdt || '',
    nen_tang: customer?.nen_tang || [],
    dich_vu: customer?.dich_vu || [],
    nganh_hang: customer?.nganh_hang || '',
    loai_khach: customer?.loai_khach || 'moi',
    nguon_khach: customer?.nguon_khach || 'tu_tim',
    trang_thai_cham_soc: customer?.trang_thai_cham_soc || 'chua_lien_he',
    sale_id: customer?.sale_id || currentProfile?.id || '',
    ngay_cham_soc_tiep_theo: customer?.ngay_cham_soc_tiep_theo || '',
    ghi_chu: customer?.ghi_chu || '',
    van_de: customer?.van_de || '',
    giai_phap: customer?.giai_phap || '',
    goi_tu_van: customer?.goi_tu_van || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [khachTrung, setKhachTrung] = useState(null)
  const [dangKiemTra, setDangKiemTra] = useState(false)
  const [saleList, setSaleList] = useState({})

  const daChot = !!khachTrung?.daChot   // chỉ khách đã CHỐT mới chặn lưu
  const chiSo = (v) => { const d = (v || '').replace(/\D/g, ''); return /^84\d{9,10}$/.test(d) ? '0' + d.slice(2) : d }

  // Kiểm tra trùng số điện thoại ngay khi gõ
  useEffect(() => {
    const so = chiSo(form.sdt)
    if (so.length < 8) { setKhachTrung(null); return }
    setDangKiemTra(true)
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc('tim_khach_theo_sdt', { p_sdt: form.sdt })
      const ds = (data || []).filter((k) => k.id !== customer?.id)
      // Ưu tiên báo khách đã chốt; không thì lấy hồ sơ trùng đầu tiên
      const trung = ds.find((k) => k.da_chot) || ds[0] || null
      // Gộp thông tin (nếu được phép xem) với cờ: đã chốt / có xem được hồ sơ không
      setKhachTrung(trung ? { ...(trung.thong_tin || {}), id: trung.id, daChot: trung.da_chot, xemDuoc: trung.xem_duoc, soHoSo: ds.length } : null)
      const sid = trung?.thong_tin?.sale_id
      if (sid && !saleList[sid]) {
        const { data: p } = await supabase.from('profiles').select('id, full_name').eq('id', sid).single()
        if (p) setSaleList((old) => ({ ...old, [p.id]: p.full_name }))
      }
      setDangKiemTra(false)
    }, 500)
    return () => clearTimeout(t)
  }, [form.sdt])

  async function handleSubmit(e) {
    e.preventDefault()
    if (daChot) {
      setError('Số điện thoại này thuộc về khách đã chốt. Vui lòng dùng số khác hoặc liên hệ quản lý.')
      return
    }
    setSaving(true)
    setError('')
    const payload = {
      ...form,
      khu_vuc: form.khu_vuc || null,
      ngay_cham_soc_tiep_theo: form.ngay_cham_soc_tiep_theo || null,
      van_de: form.van_de || null,
      giai_phap: form.giai_phap || null,
      goi_tu_van: form.goi_tu_van || null,
      sale_id: form.sale_id || null,
      link_fb: form.link_fb || null,
      link_shop: form.link_shop || null,
      dia_chi: form.dia_chi || null,
      mst: form.mst || null,
      nguoi_dai_dien: form.nguoi_dai_dien || null,
      chuc_vu: form.chuc_vu || null,
      email: form.email || null,
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
            onChange={(e) => setForm({ ...form, sdt: e.target.value.replace(/[\s.\-]/g, '') })}
            className={khachTrung ? 'border-amber-400 bg-amber-50' : ''} />
          {dangKiemTra && <p className="mt-1 text-xs text-ink-400">Đang kiểm tra trùng...</p>}
        </div>
        <Input label="Ngành hàng" value={form.nganh_hang}
          onChange={(e) => setForm({ ...form, nganh_hang: e.target.value })}
          placeholder="Thời trang, mỹ phẩm..." />
        <Select label="Khu vực khách ở (tỉnh / thành)" value={form.khu_vuc}
          onChange={(e) => setForm({ ...form, khu_vuc: e.target.value })}>
          <option value="">-- Chọn tỉnh / thành --</option>
          {TINH_THANH.map((t) => <option key={t} value={t}>{t}</option>)}
        </Select>
        <Input label="Link Facebook cá nhân" value={form.link_fb}
          onChange={(e) => setForm({ ...form, link_fb: e.target.value })}
          placeholder="https://facebook.com/..." />
        <Input label="Link shop" value={form.link_shop}
          onChange={(e) => setForm({ ...form, link_shop: e.target.value })}
          placeholder="https://shopee.vn/... hoặc TikTok Shop" />

        {khachTrung && (
          <div className={`col-span-2 rounded-xl border p-4 ${daChot ? 'border-rose-300 bg-rose-50' : 'border-amber-300 bg-amber-50'}`}>
            <div className={`flex items-center gap-2 ${daChot ? 'text-rose-800' : 'text-amber-900'}`}>
              <TriangleAlert size={16} />
              <p className="text-sm font-semibold">
                {daChot
                  ? `⚠ Khách hàng này ĐÃ CHỐT rồi — của ${saleList[khachTrung.sale_id] || 'sale khác'} (${tenTrangThai(khachTrung.trang_thai_cham_soc)})`
                  : 'Số điện thoại này đã có trong hệ thống (trùng data), bạn vẫn lưu được'}
              </p>
            </div>
            {(daChot || khachTrung.xemDuoc) ? (
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
                  <span>Ngành hàng: <b className="text-navy-900">{khachTrung.nganh_hang || '—'}</b></span>
                  <span>Liên hệ gần nhất: <b className="text-navy-900">{khachTrung.ngay_lien_he_gan_nhat || '—'}</b></span>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-sm text-amber-900">Số này đã có trong hệ thống ({khachTrung.soHoSo} hồ sơ). Hồ sơ khác không hiển thị cho bạn.</p>
            )}
            <p className={`mt-3 text-xs ${daChot ? 'text-rose-700' : 'text-amber-800'}`}>
              {daChot
                ? 'Khách đã chốt nên không thể tạo trùng số. Hãy dùng số khác hoặc liên hệ quản lý.'
                : 'Bạn vẫn có thể lưu. Hồ sơ của bạn tách riêng, chỉ bạn, leader trong team và admin xem được.'}
            </p>
          </div>
        )}

        <Select label="Trạng thái chăm sóc" value={form.trang_thai_cham_soc}
          onChange={(e) => setForm({ ...form, trang_thai_cham_soc: e.target.value })}>
          {TRANG_THAI.map((o) => <option key={o.ma} value={o.ma}>{o.ten}</option>)}
        </Select>
        <Select label="Sale phụ trách" value={form.sale_id}
          onChange={(e) => setForm({ ...form, sale_id: e.target.value })}>
          <option value="">-- Chưa gán --</option>
          {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name || p.id}</option>)}
        </Select>

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
          <Button type="submit" disabled={saving || daChot}>
            {saving ? 'Đang lưu...' : daChot ? 'Khách đã chốt, không lưu được' : 'Lưu khách hàng'}
          </Button>
        </div>

        {!isEdit && onTaiFile && (
          <div className="col-span-2 mt-1 flex items-center justify-between gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-navy-900">Có nhiều khách?</p>
              <p className="text-xs text-ink-600">Thêm nhiều khách cùng lúc từ file Excel hoặc CSV</p>
            </div>
            <Button type="button" variant="secondary" onClick={onTaiFile}>
              <Upload size={16} /> Tải file lên
            </Button>
          </div>
        )}
      </form>
    </Modal>
  )
}
