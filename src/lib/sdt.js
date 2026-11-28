// Chuẩn hoá số điện thoại: chỉ giữ chữ số, đổi đầu 84 (kể cả +84) về 0.
// "0912 345 678", "+84912345678", "84912345678" -> "0912345678"
// Phải khớp với hàm SQL chuan_hoa_sdt (migration_44) và hàm chuanSo trong supabase/functions/callio.
export function chuanSo(v) {
  const d = String(v ?? '').replace(/\D/g, '')
  return /^84\d{9,10}$/.test(d) ? '0' + d.slice(2) : d
}
