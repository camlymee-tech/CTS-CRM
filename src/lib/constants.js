export const NEN_TANG_OPTIONS = [
  { value: 'shopee', label: 'Shopee', className: 'bg-coral-50 text-coral-600 border border-coral-500/30' },
  { value: 'tiktok', label: 'TikTok Shop', className: 'bg-teal-50 text-teal-500 border border-teal-500/30' },
]

export const DICH_VU_OPTIONS = [
  { value: 'mua_ban', label: 'Mua bán', className: 'bg-violet-100 text-violet-700 border border-violet-300' },
  { value: 'uy_thac', label: 'Uỷ thác', className: 'bg-sky-100 text-sky-700 border border-sky-300' },
  { value: 'van_chuyen', label: 'Vận chuyển', className: 'bg-amber-100 text-amber-700 border border-amber-300' },
]

// 34 tỉnh, thành phố hiện hành (sau sắp xếp đơn vị hành chính 2025)
export const TINH_THANH = [
  'Hà Nội', 'TP Hồ Chí Minh', 'Hải Phòng', 'Đà Nẵng', 'Cần Thơ', 'Huế',
  'An Giang', 'Bắc Ninh', 'Cà Mau', 'Cao Bằng', 'Đắk Lắk', 'Điện Biên', 'Đồng Nai', 'Đồng Tháp',
  'Gia Lai', 'Hà Tĩnh', 'Hưng Yên', 'Khánh Hoà', 'Lai Châu', 'Lâm Đồng', 'Lạng Sơn', 'Lào Cai',
  'Nghệ An', 'Ninh Bình', 'Phú Thọ', 'Quảng Ngãi', 'Quảng Ninh', 'Quảng Trị', 'Sơn La',
  'Tây Ninh', 'Thái Nguyên', 'Thanh Hoá', 'Tuyên Quang', 'Vĩnh Long',
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
  { value: 'da_ky', label: 'Chốt hợp đồng', className: 'bg-emerald-100 text-emerald-700' },
  { value: 'dang_trien_khai', label: 'Đang triển khai', className: 'bg-teal-50 text-teal-600' },
  { value: 'hoan_thanh', label: 'Hoàn thành dịch vụ', className: 'bg-violet-100 text-violet-700' },
  { value: 'tu_choi', label: 'Từ chối / Ngừng', className: 'bg-rose-100 text-rose-600' },
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

// Mục đã tắt trong "Danh mục" vẫn cần hiện đúng tên cho dữ liệu cũ
export const DA_AN = {}

export function labelOf(options, value) {
  return options.find((o) => o.value === value)?.label ?? DA_AN[value]?.label ?? value
}

export function classOf(options, value) {
  return options.find((o) => o.value === value)?.className ?? DA_AN[value]?.className ?? 'bg-slate-100 text-slate-600'
}

// Đã từng ký hợp đồng (dùng để loại khỏi danh sách cần chăm sóc)
export const TT_DA_KY = ['da_ky', 'dang_trien_khai', 'hoan_thanh']

// Phễu: mỗi trạng thái chỉ nằm ở ĐÚNG MỘT bước, không cộng dồn
export const PHEU_BUOC = [
  { value: 'chua_lien_he',    label: 'Chưa liên hệ' },
  { value: 'khong_nghe_may',  label: 'Không nghe máy' },
  { value: 'dang_tu_van',     label: 'Đang tư vấn' },
  { value: 'da_ky',           label: 'Chốt hợp đồng' },
  { value: 'dang_trien_khai', label: 'Đang triển khai' },
  { value: 'hoan_thanh',      label: 'Hoàn thành dịch vụ' },
]
// Rơi khỏi phễu, thống kê riêng
export const PHEU_ROI = 'tu_choi'

// Data do người khác giao cho sale (không tính data sale tự nhập / tự nhận)
export function laDataDuocChia(c) {
  return !!c.nguoi_chia && c.nguoi_chia !== c.sale_id
}

export const TRANG_THAI_HD_OPTIONS = [
  { value: 'hieu_luc', label: 'Còn hiệu lực', className: 'bg-emerald-100 text-emerald-700' },
  { value: 'het_han', label: 'Hết hạn', className: 'bg-slate-100 text-slate-600' },
  { value: 'da_huy', label: 'Đã huỷ', className: 'bg-rose-100 text-rose-600' },
]

export function formatVnd(n) {
  return new Intl.NumberFormat('vi-VN').format(Number(n) || 0) + ' đ'
}

// Giá lưu trong hệ thống luôn là giá SAU VAT (giá bán thực tế cho khách).
// Hàm này tách ngược ra giá TRƯỚC VAT chỉ để hiển thị tham khảo, làm tròn đến nghìn đồng.
export function giaTruocVat(giaSauVat, thuePct = 8) {
  const g = Number(giaSauVat) || 0
  return Math.round(g / (1 + thuePct / 100) / 1000) * 1000
}
