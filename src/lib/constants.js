export const NEN_TANG_OPTIONS = [
  { value: 'shopee', label: 'Shopee', className: 'bg-coral-50 text-coral-600 border border-coral-500/30' },
  { value: 'tiktok', label: 'TikTok Shop', className: 'bg-teal-50 text-teal-500 border border-teal-500/30' },
]

export const DICH_VU_OPTIONS = [
  { value: 'quang_cao', label: 'Chạy quảng cáo', className: 'bg-violet-100 text-violet-700 border border-violet-300' },
  { value: 'xay_shop', label: 'Xây shop', className: 'bg-sky-100 text-sky-700 border border-sky-300' },
]

export const LOAI_KHACH_OPTIONS = [
  { value: 'moi', label: 'Khách mới' },
  { value: 'cu', label: 'Khách cũ' },
]

export const NGUON_KHACH_OPTIONS = [
  { value: 'gioi_thieu', label: 'Giới thiệu' },
  { value: 'tu_tim', label: 'Tự tìm kiếm' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'khac', label: 'Khác' },
]

export const TRANG_THAI_OPTIONS = [
  { value: 'chua_lien_he', label: 'Chưa liên hệ', className: 'bg-slate-100 text-slate-600' },
  { value: 'khong_nghe_may', label: 'Không nghe máy', className: 'bg-orange-100 text-orange-700' },
  { value: 'dang_tu_van', label: 'Đang tư vấn', className: 'bg-amber-100 text-amber-700' },
  { value: 'da_ky', label: 'Đã ký hợp đồng', className: 'bg-emerald-100 text-emerald-700' },
  { value: 'dang_trien_khai', label: 'Đang triển khai', className: 'bg-teal-50 text-teal-600' },
  { value: 'tam_dung', label: 'Tạm dừng', className: 'bg-rose-100 text-rose-600' },
]

export const TRANG_THAI_DON_OPTIONS = [
  { value: 'moi', label: 'Mới chốt', className: 'bg-coral-50 text-coral-600' },
  { value: 'dang_xu_ly', label: 'Đang triển khai', className: 'bg-teal-50 text-teal-600' },
  { value: 'hoan_thanh', label: 'Hoàn thành', className: 'bg-emerald-100 text-emerald-700' },
  { value: 'huy', label: 'Đã huỷ', className: 'bg-slate-100 text-slate-500' },
]

export const LOAI_TUONG_TAC_OPTIONS = [
  { value: 'goi_dien', label: 'Gọi điện' },
  { value: 'nhan_tin', label: 'Nhắn tin' },
  { value: 'gap_mat', label: 'Gặp mặt' },
  { value: 'khac', label: 'Khác' },
]

export function labelOf(options, value) {
  return options.find((o) => o.value === value)?.label ?? value
}

export function classOf(options, value) {
  return options.find((o) => o.value === value)?.className ?? 'bg-slate-100 text-slate-600'
}

export function formatVnd(n) {
  return new Intl.NumberFormat('vi-VN').format(Number(n) || 0) + ' đ'
}
