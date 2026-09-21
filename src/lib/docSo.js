// Đọc số tiền thành chữ tiếng Việt
const DONVI = ['', 'nghìn', 'triệu', 'tỷ']
const CHUSO = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín']

function docBaChuSo(n, dayDu) {
  const tram = Math.floor(n / 100)
  const chuc = Math.floor((n % 100) / 10)
  const donvi = n % 10
  let kq = ''
  if (dayDu || tram > 0) kq += CHUSO[tram] + ' trăm'
  if (chuc === 0) {
    if (donvi > 0) kq += (dayDu || tram > 0 ? ' lẻ ' : '') + CHUSO[donvi]
  } else if (chuc === 1) {
    kq += ' mười'
    if (donvi === 5) kq += ' lăm'
    else if (donvi > 0) kq += ' ' + CHUSO[donvi]
  } else {
    kq += ' ' + CHUSO[chuc] + ' mươi'
    if (donvi === 1) kq += ' mốt'
    else if (donvi === 5) kq += ' lăm'
    else if (donvi > 0) kq += ' ' + CHUSO[donvi]
  }
  return kq.trim()
}

export function docTienThanhChu(so) {
  so = Math.round(Number(so) || 0)
  if (so === 0) return 'Không đồng'
  const nhom = []
  let n = so
  while (n > 0) { nhom.unshift(n % 1000); n = Math.floor(n / 1000) }
  let kq = ''
  const soNhom = nhom.length
  for (let i = 0; i < soNhom; i++) {
    const bac = soNhom - 1 - i
    if (nhom[i] === 0) continue
    kq += docBaChuSo(nhom[i], i > 0) + ' ' + DONVI[bac % 4] + ' '
  }
  kq = kq.trim().replace(/\s+/g, ' ')
  return kq.charAt(0).toUpperCase() + kq.slice(1) + ' đồng'
}

// Tạo tên viết tắt từ họ tên: "Nguyễn Thành An" -> "NTA"
export function vietTat(ten) {
  return (ten || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .split(/\s+/).filter(Boolean).map((w) => w[0]?.toUpperCase() || '').join('')
    .slice(0, 4)
}

// Số hợp đồng theo dịch vụ
export function taoSoHopDong({ loaiDichVu, ngay, maKhach, tenVietTat }) {
  const d = ngay ? new Date(ngay) : new Date()
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yy = String(d.getFullYear()).slice(-2)
  const ben = loaiDichVu === 'xay_shop' ? 'TUKISELLER' : 'TUKIADS'
  const ma = (maKhach || '').replace('KH-', '') || 'KH'
  return `${dd}${mm}${yy}/${ma}/HDDV/${ben}-${tenVietTat || 'KH'}`
}
