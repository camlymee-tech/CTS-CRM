import { danhSachNhacTaiKy } from './taiKy'
import { danhSachNhacBaoCao } from './baoCaoAds'

// Gộp các việc cần nhắc (tái ký hợp đồng ADS + báo cáo chỉ số ADS), áp quyền xem:
// sale chỉ thấy khách của mình, quản trị thấy cả team. Dùng chung cho trang Checklist và huy hiệu ở sidebar.
export function tinhNhacViec({ khach = [], hopDong = [], don = [], items = [], baoCao = [], isAdmin = false, userId = null, homNay }) {
  const khachTheoId = new Map(khach.map((c) => [c.id, c]))
  const gan = (r) => {
    const k = khachTheoId.get(r.hd.customer_id)
    return { ...r, khach: k, saleId: r.donGoc?.sale_id || k?.sale_id }
  }
  const duocXem = (r) => !!r.khach && (isAdmin || r.saleId === userId)
  return {
    taiKy: danhSachNhacTaiKy({ hopDong, don, items, homNay }).map(gan).filter(duocXem),
    baoCaoAds: danhSachNhacBaoCao({ hopDong, don, items, baoCao, homNay }).map(gan).filter(duocXem),
  }
}

// Đếm số việc cần nhắc cho huy hiệu ở sidebar (tự tải dữ liệu cần thiết)
export async function demNhacViec(supabase, { isAdmin, userId }) {
  const [{ data: khach }, { data: hopDong }, { data: don }, { data: items }, { data: baoCao }] = await Promise.all([
    supabase.from('customers').select('id, sale_id'),
    supabase.from('contracts').select('*').eq('trang_thai', 'hieu_luc'),
    supabase.from('orders').select('*').neq('trang_thai', 'huy'),
    supabase.from('order_items').select('order_id, ten_dich_vu'),
    supabase.from('ads_bao_cao').select('contract_id, ngay_bao_cao'),   // chưa chạy SQL thì trả rỗng, không sao
  ])
  const r = tinhNhacViec({ khach: khach || [], hopDong: hopDong || [], don: don || [], items: items || [], baoCao: baoCao || [], isAdmin, userId })
  return { taiKy: r.taiKy.length, baoCaoAds: r.baoCaoAds.length, tong: r.taiKy.length + r.baoCaoAds.length }
}
