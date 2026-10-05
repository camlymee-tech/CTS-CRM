import { giaTruocVat } from './constants'

const pad = (n) => String(n).padStart(2, '0')

// Ngày theo GIỜ MÁY (YYYY-MM-DD) từ 1 mốc thời gian — tránh lệch ngày do giờ UTC
export function ngayLocal(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return String(ts).slice(0, 10)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function gioNgay(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ''
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

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
export function tongDoanhThu(orders = []) {
  const m = {}
  for (const o of orders) {
    if (o.trang_thai === 'huy') continue
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
