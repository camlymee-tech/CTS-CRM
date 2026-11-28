// Trạng thái khách dùng chung toàn app. Phần tải dữ liệu (StatusProvider) nằm ở StatusProvider.jsx.
import { createContext, useContext } from 'react'

// Màu badge cho từng trạng thái — khoá màu lưu trong database
export const MAU_BADGE = {
  slate:   'bg-slate-100 text-slate-600',
  orange:  'bg-orange-100 text-orange-700',
  amber:   'bg-amber-100 text-amber-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  teal:    'bg-teal-50 text-teal-600',
  violet:  'bg-violet-100 text-violet-700',
  rose:    'bg-rose-100 text-rose-600',
  coral:   'bg-coral-50 text-coral-600',
  sky:     'bg-sky-100 text-sky-700',
  navy:    'bg-navy-900 text-white',
}

export const DANH_SACH_MAU = Object.keys(MAU_BADGE)

// Dùng tạm khi chưa tải xong, để giao diện không trống
export const MAC_DINH = [
  { ma: 'chua_lien_he', ten: 'Chưa liên hệ', mau: 'slate', thu_tu: 1, la_chot: false, tao_don: false, chung_sau_ngay: null, active: true },
  { ma: 'khong_nghe_may', ten: 'Không nghe máy', mau: 'orange', thu_tu: 2, la_chot: false, tao_don: false, chung_sau_ngay: 5, active: true },
  { ma: 'dang_tu_van', ten: 'Đang tư vấn', mau: 'amber', thu_tu: 3, la_chot: false, tao_don: false, chung_sau_ngay: 30, active: true },
  { ma: 'da_ky', ten: 'Chốt hợp đồng', mau: 'emerald', thu_tu: 4, la_chot: true, tao_don: true, chung_sau_ngay: null, active: true },
  { ma: 'dang_trien_khai', ten: 'Đang triển khai', mau: 'teal', thu_tu: 5, la_chot: true, tao_don: false, chung_sau_ngay: null, active: true },
  { ma: 'hoan_thanh', ten: 'Hoàn thành dịch vụ', mau: 'violet', thu_tu: 6, la_chot: true, tao_don: false, chung_sau_ngay: 0, active: true },
  { ma: 'tu_choi', ten: 'Từ chối / Ngừng', mau: 'rose', thu_tu: 7, la_chot: false, tao_don: false, chung_sau_ngay: 15, active: true },
]

export const Ctx = createContext(null)

export function useTrangThai() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useTrangThai phải nằm trong StatusProvider')
  return v
}
