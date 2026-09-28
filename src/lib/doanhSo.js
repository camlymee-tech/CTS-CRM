import { giaTruocVat } from './constants'

// Xây shop + Tối ưu sản phẩm gộp thành 1 nhóm "Seller"; Chạy quảng cáo là "ADS"; còn lại là "Bổ sung"
export function nhomDichVu(ten) {
  if (/xây shop|tối ưu/i.test(ten || '')) return 'Seller'
  if (/quảng cáo/i.test(ten || '')) return 'ADS'
  return 'Bổ sung'
}

export const NHOM = ['Seller', 'ADS', 'Bổ sung']

const pad = (n) => String(n).padStart(2, '0')
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

// Khoảng ngày theo lựa chọn "Kỳ": trả về [từ, đến] dạng YYYY-MM-DD ('' = không giới hạn)
export function khoangNgay(ky, tu, den, homNay = new Date()) {
  const y = homNay.getFullYear(), m = homNay.getMonth()
  if (ky === 'thang_nay') return [ymd(new Date(y, m, 1)), ymd(new Date(y, m + 1, 0))]
  if (ky === 'thang_truoc') return [ymd(new Date(y, m - 1, 1)), ymd(new Date(y, m, 0))]
  if (ky === 'quy_nay') { const q = Math.floor(m / 3) * 3; return [ymd(new Date(y, q, 1)), ymd(new Date(y, q + 3, 0))] }
  if (ky === 'nam_nay') return [`${y}-01-01`, `${y}-12-31`]
  if (ky === 'tuy_chon') return [tu || '', den || '']
  return ['', '']
}

// Mỗi dòng dịch vụ của mỗi đơn (không tính đơn huỷ — đã loại từ lúc tải) thành 1 "dòng doanh số" chưa VAT
export function taoDong({ orders, items, tuNgay, denNgay, sale, nhom }) {
  const donMap = new Map(orders.map((o) => [o.id, o]))
  const kq = []
  for (const it of items) {
    const o = donMap.get(it.order_id)
    if (!o || !o.ngay_chot) continue
    if (tuNgay && o.ngay_chot < tuNgay) continue
    if (denNgay && o.ngay_chot > denNgay) continue
    const saleId = o.sale_id || 'chua_gan'
    if (sale && saleId !== sale) continue
    const n = nhomDichVu(it.ten_dich_vu)
    if (nhom && n !== nhom) continue
    kq.push({
      orderId: o.id,
      sale: saleId,
      loai: o.loai_don === 'tai_ky' ? 'tai_ky' : 'moi',
      nhom: n,
      dichVu: it.ten_dich_vu || '(Chưa đặt tên)',
      goi: it.ten_goi || '',
      thang: o.ngay_chot.slice(0, 7),
      tien: giaTruocVat(it.gia),
    })
  }
  return kq
}

// Gom các dòng theo 1 khoá (sale / tháng ...) -> tiền mới, tiền tái ký, số đơn, tiền theo nhóm dịch vụ
export function gom(rows, khoa) {
  const m = new Map()
  for (const r of rows) {
    const k = khoa(r)
    if (!m.has(k)) {
      m.set(k, { moi: 0, tai_ky: 0, donMoi: new Set(), donTaiKy: new Set(), Seller: 0, ADS: 0, 'Bổ sung': 0 })
    }
    const a = m.get(k)
    a[r.loai] += r.tien
    a[r.nhom] += r.tien
    ;(r.loai === 'moi' ? a.donMoi : a.donTaiKy).add(r.orderId)
  }
  return [...m.entries()].map(([key, a]) => ({
    key, ...a,
    tong: a.moi + a.tai_ky,
    soDon: a.donMoi.size + a.donTaiKy.size,
    soDonMoi: a.donMoi.size,
    soDonTaiKy: a.donTaiKy.size,
  }))
}

// Tổng cộng cho 1 danh sách kết quả của gom()
export function cong(list) {
  const t = { moi: 0, tai_ky: 0, tong: 0, soDon: 0, soDonMoi: 0, soDonTaiKy: 0, Seller: 0, ADS: 0, 'Bổ sung': 0 }
  for (const r of list) for (const k of Object.keys(t)) t[k] += r[k]
  return t
}

// Báo cáo từng dịch vụ: mỗi dịch vụ (hoặc dịch vụ + gói) có số lượt/doanh số riêng cho đơn mới và tái ký
export function gomDichVu(rows, chiTietGoi) {
  const m = new Map()
  for (const r of rows) {
    const ten = chiTietGoi && r.goi ? `${r.dichVu} · ${r.goi}` : r.dichVu
    const k = `${r.nhom}|${ten}`
    if (!m.has(k)) m.set(k, { nhom: r.nhom, ten, moi: { luot: 0, tien: 0 }, tai_ky: { luot: 0, tien: 0 } })
    const a = m.get(k)
    a[r.loai].luot += 1
    a[r.loai].tien += r.tien
  }
  return [...m.values()].map((a) => ({
    ...a,
    luot: a.moi.luot + a.tai_ky.luot,
    tien: a.moi.tien + a.tai_ky.tien,
  }))
}
