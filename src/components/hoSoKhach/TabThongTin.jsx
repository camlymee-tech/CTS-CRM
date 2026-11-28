// Tab "Thông tin" trong hồ sơ khách: form sửa thông tin (hoặc chỉ xem nếu không có quyền sửa)
// + cảnh báo số điện thoại có nhiều hồ sơ. Trạng thái form nằm ở CustomerDetail để chuyển tab không mất chữ đang gõ.
import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'
import { laLeader, locNhanSu } from '../../lib/quyen'
import { TINH_THANH } from '../../lib/constants'
import { Button, Select, Input } from '../ui'

export default function TabThongTin({ customer, suaDuoc, formTT, setFormTT, onLuu, dangLuuTT, luuXongTT, currentProfile, profiles }) {
  return (
    <>
      {customer.sdt && <HoSoTrung customer={customer} />}
      {suaDuoc ? (
        <form onSubmit={onLuu} className="space-y-5">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Input label="Tên khách hàng" value={formTT.ten_khach}
              onChange={(e) => setFormTT({ ...formTT, ten_khach: e.target.value })} />
            <Input label="Link Facebook" value={formTT.link_fb}
              onChange={(e) => setFormTT({ ...formTT, link_fb: e.target.value })} />
            <Input label="Link shop" value={formTT.link_shop}
              onChange={(e) => setFormTT({ ...formTT, link_shop: e.target.value })} />
            <Select label="Khu vực khách ở" value={formTT.khu_vuc}
              onChange={(e) => setFormTT({ ...formTT, khu_vuc: e.target.value })}>
              <option value="">-- Chọn tỉnh / thành --</option>
              {TINH_THANH.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
            <Input label="Số điện thoại" value={formTT.sdt}
              onChange={(e) => setFormTT({ ...formTT, sdt: e.target.value.replace(/[\s.-]/g, '') })} />
            <Input label="Ngành hàng" value={formTT.nganh_hang}
              onChange={(e) => setFormTT({ ...formTT, nganh_hang: e.target.value })} />
            <Select label="Sale phụ trách" value={formTT.sale_id}
              onChange={(e) => setFormTT({ ...formTT, sale_id: e.target.value })}>
              <option value="">-- Chưa gán --</option>
              {(laLeader(currentProfile) ? locNhanSu(currentProfile, profiles) : profiles).map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </Select>
            <Input label="Chăm sóc tiếp theo" type="date" value={formTT.ngay_cham_soc_tiep_theo}
              onChange={(e) => setFormTT({ ...formTT, ngay_cham_soc_tiep_theo: e.target.value })} />
          </div>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={dangLuuTT}>
              {dangLuuTT ? 'Đang lưu...' : 'Lưu thông tin'}
            </Button>
            {luuXongTT && <span className="text-sm text-emerald-600">{luuXongTT}</span>}
          </div>
        </form>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <Field label="Số điện thoại" value={customer.sdt} />
            <Field label="Ngành hàng" value={customer.nganh_hang} />
            <Field label="Khu vực khách ở" value={customer.khu_vuc} />
            <Field label="Chăm sóc tiếp theo" value={customer.ngay_cham_soc_tiep_theo} />
          </div>
        </div>
      )}
    </>
  )
}

export function Field({ label, value }) {
  return (
    <div>
      <p className="text-ink-400">{label}</p>
      <p className="font-medium text-navy-900">{value || '—'}</p>
    </div>
  )
}

// Khung cảnh báo: số điện thoại này có nhiều hồ sơ (do nhiều sale điền)
function HoSoTrung({ customer }) {
  const [ds, setDs] = useState([])
  useEffect(() => {
    let huy = false
    supabase.rpc('ho_so_trung_sdt', { p_sdt: customer.sdt }).then(({ data }) => { if (!huy) setDs(data || []) })
    return () => { huy = true }
  }, [customer.id, customer.sdt])
  if (ds.length < 2) return null
  const hien = ds.filter((r) => r.xem_duoc || r.da_chot)
  const an = ds.length - hien.length
  const th = 'border border-amber-200 bg-amber-100/60 px-2 py-1.5 text-left font-medium text-amber-900'
  const td = 'border border-amber-200 px-2 py-1.5'
  const ngay = (v) => (v ? new Date(v).toLocaleDateString('vi-VN') : 'Chưa có')
  return (
    <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3">
      <p className="mb-2 text-sm font-medium text-amber-900">Số {customer.sdt} có {ds.length} hồ sơ trong hệ thống</p>
      <table className="w-full border-collapse bg-white text-xs">
        <thead><tr>
          <th className={th}>Sale</th><th className={th}>Phòng</th><th className={th}>Trạng thái</th>
          <th className={th}>Liên hệ gần nhất</th><th className={th}>Ngày tạo</th><th className={th}></th>
        </tr></thead>
        <tbody>
          {hien.map((r) => {
            const dangXem = r.id === customer.id
            return (
              <tr key={r.id} className={dangXem ? 'bg-sky-50' : r.da_chot ? 'bg-emerald-50' : ''}>
                <td className={`${td} font-medium`}>{r.sale_ten || '—'}</td>
                <td className={td}>{r.phong_ban || '—'}</td>
                <td className={`${td} ${r.da_chot ? 'font-medium text-emerald-700' : ''}`}>{r.trang_thai || '—'}</td>
                <td className={td}>{ngay(r.lien_he_gan_nhat)}</td>
                <td className={td}>{ngay(r.ngay_tao)}</td>
                <td className={td}>
                  {dangXem ? <span className="text-sky-700">Đang xem</span>
                    : r.xem_duoc ? <button type="button" className="text-sky-700 hover:underline" onClick={() => window.dispatchEvent(new CustomEvent('mo-ho-so', { detail: r.id }))}>Mở hồ sơ</button>
                    : null}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {an > 0 && <p className="mt-2 text-xs text-amber-800">+ {an} hồ sơ khác (không hiển thị)</p>}
    </div>
  )
}
