import { supabase } from '../supabaseClient'

// Danh sách nhân sự (bảng profiles) dùng chung cho mọi màn hình.
// Nhớ tạm 1 phút để chuyển qua lại giữa các trang không phải tải lại; trang Nhân sự gọi quenNhanSu()
// mỗi khi tải lại (sau khi thêm / sửa / khoá tài khoản) để các trang khác thấy ngay thay đổi.
// Trả về đúng dạng { data, error } như supabase, nên dùng được trong Promise.all như cũ.
const NHO_TRONG = 60 * 1000
let boNho = null   // { luc, promise }

export function layNhanSu() {
  if (!boNho || Date.now() - boNho.luc > NHO_TRONG) {
    const promise = supabase.from('profiles').select('*').order('full_name')
      .then((r) => { if (r.error) boNho = null; return r })
    boNho = { luc: Date.now(), promise }
  }
  // Trả bản sao mảng để chỗ nào sắp xếp / lọc tại chỗ cũng không ảnh hưởng chỗ khác
  return boNho.promise.then((r) => ({ ...r, data: r.data ? [...r.data] : r.data }))
}

export function quenNhanSu() {
  boNho = null
}
