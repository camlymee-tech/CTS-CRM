import { giaTruocVat, labelOf, NGUON_KHACH_OPTIONS } from './constants'
import { chuanSo } from './sdt'
import { ngayLocal, gioNgay } from './ngay'

// Trao đổi gần nhất của mỗi khách = lần CHĂM SÓC được ghi gần nhất (gọi điện, nhắn tin, gặp mặt...).
// Không lấy nhật ký hệ thống (đổi trạng thái, cập nhật vấn đề/giải pháp...) — khách chưa có lần chăm sóc nào thì để trống.
export function traoDoiGanNhat(interactions = []) {
  const map = {}
  for (const it of interactions) {
    const tg = it.ngay_thuc_hien || it.created_at || ''
    if (!map[it.customer_id] || tg > map[it.customer_id].thoiGian) {
      map[it.customer_id] = { loai: it.loai || 'khac', nguoi: it.sale_id, thoiGian: tg, noiDung: it.noi_dung }
    }
  }
  return map
}

// Số lượt chăm sóc của mỗi khách
export function demLuotChamSoc(interactions = []) {
  const m = {}
  for (const it of interactions) m[it.customer_id] = (m[it.customer_id] || 0) + 1
  return m
}

// Tổng doanh thu mỗi khách: cộng các đơn (trừ đơn huỷ), chưa VAT
// boQua = tập id khách có doanh số bị tính là hoàn / huỷ (theo trạng thái khách)
export function tongDoanhThu(orders = [], boQua) {
  const m = {}
  for (const o of orders) {
    if (o.trang_thai === 'huy' || boQua?.has(o.customer_id)) continue
    m[o.customer_id] = (m[o.customer_id] || 0) + giaTruocVat(o.gia_tri)
  }
  return m
}

const chuoi = (v) => String(v ?? '').toLowerCase()

// Sắp xếp danh sách khách theo 1 cột. dir: 'asc' | 'desc'
export function sapXepKhach(list, cot, dir, ctx) {
  if (!cot) return list
  const lay = {
    sdt: (c) => chuoi(c.sdt),
    sale: (c) => chuoi(ctx.tenSale(c.sale_id)),
    trao_doi: (c) => ctx.traoDoi[c.id]?.thoiGian || '',
    van_de: (c) => chuoi(c.van_de),
    nguon: (c) => chuoi(ctx.tenNguon(c.nguon_khach)),
    doanh_thu: (c) => ctx.doanhThu[c.id] || 0,
    luot_cs: (c) => ctx.luotCS[c.id] || 0,
  }[cot]
  if (!lay) return list
  const h = dir === 'desc' ? -1 : 1
  return [...list].sort((a, b) => {
    const x = lay(a), y = lay(b)
    if (x === y) return 0
    // khách chưa có dữ liệu luôn nằm cuối, dù sắp xếp chiều nào
    const rongX = x === '' || x === 0, rongY = y === '' || y === 0
    if (rongX !== rongY && cot !== 'doanh_thu') return rongX ? 1 : -1
    return (x < y ? -1 : 1) * h
  })
}

// Tìm khách: khớp chữ thường, hoặc khớp số điện thoại không phân biệt dấu cách / chấm / gạch
export const khopTim = (c, search) => {
  const q = search.toLowerCase().trim()
  if (`${c.ten_khach} ${c.ma_khach} ${c.sdt || ''} ${c.nganh_hang || ''}`.toLowerCase().includes(q)) return true
  const so = q.replace(/\D/g, '')
  if (so.length < 3) return false
  const cs = chuanSo(c.sdt)
  return cs.includes(so) || cs.includes(chuanSo(q)) || chuanSo(c.sdt).includes(so)
}

// Bộ lọc trang Khách hàng khi chưa lọc gì
export const BO_LOC_TRONG = { search: '', trangThai: '', sale: '', phong: '', dichVu: '', tuNgay: '', denNgay: '' }

// Lọc danh sách khách theo bộ lọc của trang Khách hàng.
// boLoc: { search, trangThai, sale, phong, dichVu, tuNgay, denNgay } · bỏ qua lọc trạng thái khi boTrangThai = true
// (dùng để đếm số khách trên từng thẻ trạng thái) · xemDuoc(saleId) nếu có thì chỉ giữ khách người xem được phép xem.
export function locKhach(ds, boLoc, { phongBanCua, xemDuoc, boTrangThai = false }) {
  const { search, trangThai, sale, phong, dichVu, tuNgay, denNgay } = boLoc
  return ds.filter((c) => {
    if (xemDuoc && !xemDuoc(c.sale_id)) return false
    if (search && !khopTim(c, search)) {
      if (!c._tuTraCuu) return false
    }
    if (!boTrangThai && trangThai && c.trang_thai_cham_soc !== trangThai) return false
    if (sale && c.sale_id !== sale) return false
    if (phong && phongBanCua(c.sale_id) !== phong) return false
    if (dichVu && !(c.dich_vu || []).includes(dichVu)) return false
    const ngayTao = ngayLocal(c.created_at)
    if (tuNgay && (!ngayTao || ngayTao < tuNgay)) return false
    if (denNgay && (!ngayTao || ngayTao > denNgay)) return false
    return true
  })
}

// Các dòng của file Excel danh sách khách
export function dongExcelKhach(ds, { profileName, phongBanCua, tenTrangThai, luotCS, traoDoi, doanhThu }) {
  return ds.map((c, i) => {
    const td = traoDoi[c.id]
    return {
      '#': i + 1,
      'Mã KH': c.ma_khach,
      'Tên khách hàng': c.ten_khach,
      'Điện thoại': c.sdt || '',
      'Tên sale': profileName(c.sale_id),
      'Phòng ban': phongBanCua(c.sale_id),
      'Trạng thái': tenTrangThai(c.trang_thai_cham_soc),
      'Hẹn chăm sóc tiếp': c.ngay_cham_soc_tiep_theo || '',
      'Số lượt chăm sóc': luotCS[c.id] || 0,
      'Trao đổi gần nhất': td ? `${profileName(td.nguoi)} (${gioNgay(td.thoiGian)}): ${td.noiDung}` : '',
      'Nguồn khách hàng': labelOf(NGUON_KHACH_OPTIONS, c.nguon_khach) || '',
      'Ngày tạo': ngayLocal(c.created_at),
      'Tổng doanh thu (chưa VAT)': doanhThu[c.id] || 0,
    }
  })
}
