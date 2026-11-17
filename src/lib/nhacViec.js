import { danhSachNhacTaiKy } from './taiKy'
import { danhSachNhacBaoCao } from './baoCaoAds'
import { homNayLocal } from './taiKy'
import { nhanSuXemDuoc } from './quyen'

// Gộp các việc cần nhắc (tái ký hợp đồng ADS + báo cáo chỉ số ADS), áp quyền xem:
// sale chỉ thấy khách của mình, quản trị thấy cả team. Dùng chung cho trang Checklist và huy hiệu ở sidebar.
export function tinhNhacViec({ khach = [], hopDong = [], don = [], items = [], baoCao = [], isAdmin = false, userId = null, uids = null, homNay }) {
  const khachTheoId = new Map(khach.map((c) => [c.id, c]))
  const gan = (r) => {
    const k = khachTheoId.get(r.hd.customer_id)
    return { ...r, khach: k, saleId: r.donGoc?.sale_id || k?.sale_id }
  }
  const duocXem = (r) => !!r.khach && (isAdmin || (uids ? uids.has(r.saleId) : r.saleId === userId))
  return {
    taiKy: danhSachNhacTaiKy({ hopDong, don, items, homNay }).map(gan).filter(duocXem),
    baoCaoAds: danhSachNhacBaoCao({ hopDong, don, items, baoCao, homNay }).map(gan).filter(duocXem),
  }
}

// ---- Nhận diện trạng thái theo tên (tên do chị tự đặt nên so khớp không dấu) ----
const boDau = (t = '') => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().trim()
const timMa = (statuses, tenRe, maMacDinh) => {
  const theoTen = statuses.filter((s) => tenRe.test(boDau(s.ten))).map((s) => s.ma)
  if (theoTen.length) return theoTen
  return statuses.some((s) => s.ma === maMacDinh) ? [maMacDinh] : []
}
export const maChuaLienHe = (statuses = []) => timMa(statuses, /^chua lien he/, 'chua_lien_he')
export const maKhNgheMay = (statuses = []) => timMa(statuses, /^kh nghe may/, 'khong_nghe_may')
// Trạng thái "KH đã gửi báo giá" và "KH hẹn đi đơn"
export const maCanGoiLai = (statuses = []) =>
  statuses.filter((s) => s.active !== false && /bao gia|hen di don/.test(boDau(s.ten))).map((s) => s.ma)

const ngayCuaLog = (iso) => homNayLocal(new Date(iso))
const chenhNgay = (tu, den) => Math.floor((Date.parse(den) - Date.parse(tu)) / 86400000)

export const SO_NGAY_GOI_LAI = 7

// Khách cần gọi lại: đang ở trạng thái báo giá / hẹn đi đơn mà đã >= 7 ngày chưa liên hệ lại và chưa đổi trạng thái.
// Mốc tính = ngày mới nhất trong: lần liên hệ gần nhất, lần đổi trạng thái gần nhất, ngày tạo khách.
export function tinhCanGoiLai({ khach = [], logs = [], statuses = [], isAdmin = false, userId = null, uids = null, homNay = homNayLocal() }) {
  const ma = new Set(maCanGoiLai(statuses))
  const logMoiNhat = new Map()
  for (const l of logs) {
    if (l.hanh_dong !== 'Đổi trạng thái') continue
    const d = ngayCuaLog(l.created_at)
    if (!logMoiNhat.has(l.customer_id) || d > logMoiNhat.get(l.customer_id)) logMoiNhat.set(l.customer_id, d)
  }
  return khach
    .filter((c) => ma.has(c.trang_thai_cham_soc) && (isAdmin || (uids ? uids.has(c.sale_id) : c.sale_id === userId)))
    .map((c) => {
      const moc = [c.ngay_lien_he_gan_nhat, logMoiNhat.get(c.id), (c.created_at || '').slice(0, 10)]
        .filter(Boolean).sort().pop()
      return { khach: c, saleId: c.sale_id, moc, soNgay: moc ? chenhNgay(moc, homNay) : 0 }
    })
    .filter((r) => r.soNgay >= SO_NGAY_GOI_LAI)
    .sort((a, b) => b.soNgay - a.soNgay)
}

// Khách đến hạn follow-up hôm nay (ngày chăm sóc tiếp theo = hôm nay), bỏ khách đã chốt
export function tinhFollowUpHomNay({ khach = [], maDaChot = [], isAdmin = false, userId = null, uids = null, homNay = homNayLocal() }) {
  return khach.filter((c) =>
    c.ngay_cham_soc_tiep_theo === homNay &&
    !maDaChot.includes(c.trang_thai_cham_soc) &&
    (isAdmin || (uids ? uids.has(c.sale_id) : c.sale_id === userId)))
}

// Đếm số việc cần nhắc cho huy hiệu ở sidebar (tự tải dữ liệu cần thiết)
export async function demNhacViec(supabase, { isAdmin, userId, me = null }) {
  const [{ data: khach }, { data: hopDong }, { data: don }, { data: items }, { data: baoCao }, { data: tt }, { data: logs }, { data: ps }] = await Promise.all([
    supabase.from('customers').select('id, sale_id, trang_thai_cham_soc, ngay_cham_soc_tiep_theo, ngay_lien_he_gan_nhat, created_at'),
    supabase.from('contracts').select('*').eq('trang_thai', 'hieu_luc'),
    supabase.from('orders').select('*').neq('trang_thai', 'huy'),
    supabase.from('order_items').select('order_id, ten_dich_vu'),
    supabase.from('ads_bao_cao').select('contract_id, ngay_bao_cao'),   // chưa chạy SQL thì trả rỗng, không sao
    supabase.from('customer_statuses').select('ma, ten, la_chot, active'),
    supabase.from('customer_logs').select('customer_id, hanh_dong, created_at').eq('hanh_dong', 'Đổi trạng thái').order('created_at', { ascending: false }).limit(5000),
    supabase.from('profiles').select('id, role, phong_ban'),
  ])
  const k = khach || []
  const uids = me ? nhanSuXemDuoc(me, ps || []) : null
  const statuses = tt || []
  const r = tinhNhacViec({ khach: k, hopDong: hopDong || [], don: don || [], items: items || [], baoCao: baoCao || [], isAdmin: uids === null && me ? true : isAdmin, userId, uids: me ? uids : null })
  const maDaChot = statuses.filter((s) => s.la_chot && s.active !== false).map((s) => s.ma)
  const followUp = tinhFollowUpHomNay({ khach: k, maDaChot, isAdmin: me && uids === null ? true : isAdmin, userId, uids: me ? uids : null }).length
  const canGoiLai = tinhCanGoiLai({ khach: k, logs: logs || [], statuses, isAdmin: me && uids === null ? true : isAdmin, userId, uids: me ? uids : null }).length
  return { followUp, canGoiLai, baoCaoAds: r.baoCaoAds.length, tong: followUp + canGoiLai + r.baoCaoAds.length }
}
