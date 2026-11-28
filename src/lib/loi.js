// Đổi lỗi (từ Supabase / database / mạng / JS) thành câu tiếng Việt dễ hiểu để hiện cho người dùng.
// Dùng: if (error) setMsg('Không lưu được: ' + loiDeHieu(error))
// Lỗi lạ không nhận ra thì giữ nguyên câu gốc, để vẫn biết đường sửa.
export function loiDeHieu(e) {
  if (!e) return ''
  const goc = String(typeof e === 'string' ? e : e.message || e.error_description || e.error || e)
  const ma = typeof e === 'object' ? e.code : undefined

  // Lỗi tự đặt trong database dạng "MA_LOI: câu tiếng Việt" (vd SDT_TRUNG, KHACH_CO_DON) -> chỉ lấy câu
  const tuDat = goc.match(/^[A-Z][A-Z_]{2,}:\s*([\s\S]+)$/)
  if (tuDat) return tuDat[1]

  let dich = ''
  if (ma === '42501' || /row-level security|permission denied/i.test(goc)) dich = 'Bạn không có quyền thực hiện thao tác này.'
  else if (ma === '23505' || /duplicate key/i.test(goc)) dich = 'Dữ liệu này đã có rồi (bị trùng).'
  else if (ma === '23503' || /foreign key/i.test(goc)) dich = 'Dữ liệu này đang được dùng ở nơi khác nên chưa xoá / sửa được.'
  else if (ma === '23502' || /null value in column/i.test(goc)) dich = 'Còn thiếu thông tin bắt buộc.'
  else if (/failed to fetch|networkerror|load failed|network request failed/i.test(goc)) dich = 'Mất kết nối mạng, kiểm tra Internet rồi thử lại.'
  else if (/jwt expired|invalid jwt|refresh token/i.test(goc)) dich = 'Phiên đăng nhập đã hết hạn, hãy tải lại trang và đăng nhập lại.'
  else if (/payload too large|maximum allowed size/i.test(goc)) dich = 'File quá lớn.'

  if (!dich) return goc
  console.warn('[loi]', e)   // giữ câu gốc trong Console để dò lỗi khi cần
  return dich
}
