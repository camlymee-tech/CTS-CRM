// Tóm tắt từng khách cho trang Khách hàng: nhật ký mới nhất, lần chăm sóc gần nhất, số lượt chăm sóc.
// Cách nhanh: hàm database tom_tat_khach() (migration 49) tính sẵn, trả về tất cả trong 1 lần gọi.
// Database chưa có hàm đó (chưa chạy migration 49) → tự quay về cách cũ: tải hết nhật ký + chăm sóc rồi tính ở đây.
import { supabase } from '../supabaseClient'
import { layHet } from './layHet'
import { traoDoiGanNhat, demLuotChamSoc } from './danhSachKhach'

// Trả về { nhatKy, traoDoi, luotCS } — mỗi cái là object theo mã khách
export async function taiTomTatKhach() {
  const { data, error } = await supabase.rpc('tom_tat_khach')
  // Chỉ dùng khi đúng dạng mới (danh sách các mảng). Dạng khác (vd. bản thử cũ, bị cắt ở 1.000 dòng) → cách cũ cho chắc.
  if (!error && Array.isArray(data) && data.every(Array.isArray)) return tuHamDatabase(data)
  return taiCachCu()
}

// Mỗi mục: [mã khách, nk hành động, nk người, nk thời gian, td loại, td sale, td nội dung, td thời gian, số lượt CS]
function tuHamDatabase(rows) {
  const nhatKy = {}, traoDoi = {}, luotCS = {}
  for (const [id, nkHanhDong, nkNguoi, nkLuc, tdLoai, tdSale, tdNoiDung, tdLuc, soLuot] of rows) {
    if (nkHanhDong != null) nhatKy[id] = { customer_id: id, hanh_dong: nkHanhDong, user_id: nkNguoi, created_at: nkLuc }
    if (tdLuc != null) traoDoi[id] = { loai: tdLoai, nguoi: tdSale, thoiGian: tdLuc, noiDung: tdNoiDung }
    if (soLuot) luotCS[id] = soLuot
  }
  return { nhatKy, traoDoi, luotCS }
}

async function taiCachCu() {
  const [{ data: logs }, { data: its }] = await Promise.all([
    layHet(() => supabase.from('customer_logs')
      .select('customer_id, hanh_dong, user_id, created_at')
      .order('created_at', { ascending: false }).order('id')),
    layHet(() => supabase.from('customer_interactions')
      .select('customer_id, sale_id, loai, noi_dung, ngay_thuc_hien, created_at')
      .order('ngay_thuc_hien', { ascending: false }).order('id')),
  ])
  const nhatKy = {}
  for (const l of logs || []) if (!nhatKy[l.customer_id]) nhatKy[l.customer_id] = l
  return { nhatKy, traoDoi: traoDoiGanNhat(its || []), luotCS: demLuotChamSoc(its || []) }
}
