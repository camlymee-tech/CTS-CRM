// Mọi hàm xử lý NGÀY dùng chung cho cả app.
// Quy ước: ngày lưu dạng chuỗi 'YYYY-MM-DD' theo GIỜ MÁY (giờ Việt Nam).
// KHÔNG dùng new Date().toISOString().slice(0, 10) để lấy "hôm nay": đó là giờ UTC,
// trước 7h sáng sẽ ra ngày hôm qua.

const pad = (n) => String(n).padStart(2, '0')

// Ngày hôm nay (hoặc của 1 đối tượng Date) theo giờ máy -> 'YYYY-MM-DD'
export function homNayLocal(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Ngày theo giờ máy (YYYY-MM-DD) từ 1 mốc thời gian (chuỗi ISO / timestamp) — tránh lệch ngày do giờ UTC
export function ngayLocal(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return String(ts).slice(0, 10)
  return homNayLocal(d)
}

// Mốc thời gian -> 'DD/MM/YYYY HH:mm' theo giờ máy
export function gioNgay(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ''
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// 'YYYY-MM-DD' -> 'DD/MM/YYYY' (rỗng nếu không có ngày)
export const dinhDangNgay = (s) => (s ? String(s).slice(0, 10).split('-').reverse().join('/') : '')

// Cộng n tháng vào ngày YYYY-MM-DD, nếu tháng đích ngắn hơn thì lấy ngày cuối tháng (giống Postgres)
export function congThang(ymd, n) {
  const [y, m, d] = String(ymd).slice(0, 10).split('-').map(Number)
  const dich = new Date(Date.UTC(y, m - 1 + n, 1))
  const cuoiThang = new Date(Date.UTC(dich.getUTCFullYear(), dich.getUTCMonth() + 1, 0)).getUTCDate()
  return `${dich.getUTCFullYear()}-${pad(dich.getUTCMonth() + 1)}-${pad(Math.min(d, cuoiThang))}`
}

// Cộng n ngày vào ngày YYYY-MM-DD
export function congNgay(ymd, n) {
  const [y, m, d] = String(ymd).slice(0, 10).split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + n))
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`
}

// Số ngày từ `tu` đến `den` (YYYY-MM-DD), âm nếu `den` trước `tu`
export function soNgayGiua(tu, den) {
  const a = Date.UTC(...String(tu).slice(0, 10).split('-').map((x, i) => (i === 1 ? Number(x) - 1 : Number(x))))
  const b = Date.UTC(...String(den).slice(0, 10).split('-').map((x, i) => (i === 1 ? Number(x) - 1 : Number(x))))
  return Math.round((b - a) / 86400000)
}
