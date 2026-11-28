// Nhắc tái ký hợp đồng ADS khi sắp / đã hết hạn.
// Không cần SQL: hạn dịch vụ hiện tại = ngày hết hạn của hợp đồng + thời hạn các lần đã tái ký.

import { homNayLocal, congThang, soNgayGiua } from './ngay'

export const SO_NGAY_NHAC = 7   // nhắc trước khi hết hạn bao nhiêu ngày

// Hợp đồng ADS? Ưu tiên loai_dich_vu; hợp đồng cũ chưa có thì xem đơn gốc có dịch vụ quảng cáo không
export function laHopDongAds(hd, itemsCuaDon = []) {
  if (hd.loai_dich_vu) return hd.loai_dich_vu === 'ads'
  const ten = itemsCuaDon.map((i) => i.ten_dich_vu || '').join(' ')
  return /quảng cáo/i.test(ten) && !/xây shop|tối ưu/i.test(ten)
}

// Hạn dịch vụ hiện tại: mỗi lần tái ký (đơn tái ký trỏ vào hợp đồng này) cộng thêm so_thang,
// tính từ ngày hết hạn cũ (hoặc từ ngày chốt nếu khách tái ký trễ sau khi đã hết hạn)
export function hanDichVu(hd, donTaiKy = []) {
  let han = hd.ngay_het_han
  if (!han) return null
  const ds = donTaiKy
    .filter((o) => o.tai_ky_hop_dong_id === hd.id && o.trang_thai !== 'huy' && o.ngay_chot)
    .sort((a, b) => String(a.ngay_chot).localeCompare(String(b.ngay_chot)))
  for (const o of ds) {
    const batDau = o.ngay_chot > han ? o.ngay_chot : han
    han = congThang(batDau, Number(o.so_thang) || 1)
  }
  return han
}

// Danh sách hợp đồng ADS cần nhắc tái ký, sắp theo gấp nhất lên đầu
export function danhSachNhacTaiKy({ hopDong = [], don = [], items = [], homNay = homNayLocal(), soNgay = SO_NGAY_NHAC }) {
  const donTheoId = new Map(don.map((o) => [o.id, o]))
  const itemTheoDon = new Map()
  for (const it of items) {
    if (!itemTheoDon.has(it.order_id)) itemTheoDon.set(it.order_id, [])
    itemTheoDon.get(it.order_id).push(it)
  }
  const kq = []
  for (const hd of hopDong) {
    if (hd.trang_thai !== 'hieu_luc' || !hd.ngay_het_han) continue
    if (!laHopDongAds(hd, itemTheoDon.get(hd.order_id) || [])) continue
    const han = hanDichVu(hd, don)
    const conLai = soNgayGiua(homNay, han)
    if (conLai > soNgay) continue
    const donGoc = donTheoId.get(hd.order_id)
    // Đơn gần nhất của hợp đồng này (lần tái ký mới nhất, hoặc đơn gốc) — dùng để điền sẵn khi tái ký
    const donTaiKyCuaHd = don
      .filter((o) => o.tai_ky_hop_dong_id === hd.id && o.trang_thai !== 'huy')
      .sort((a, b) => String(b.ngay_chot).localeCompare(String(a.ngay_chot)))
    const donGanNhat = donTaiKyCuaHd[0] || donGoc || null
    kq.push({
      hd, han, conLai, donGoc, donGanNhat,
      soLanTaiKy: donTaiKyCuaHd.length,
      muc: conLai < 0 ? 'qua_han' : conLai === 0 ? 'hom_nay' : 'sap_het',
    })
  }
  return kq.sort((a, b) => a.conLai - b.conLai)
}
