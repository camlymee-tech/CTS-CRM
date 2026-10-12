// Xuất bảng tính giá bán Shopee ra Excel: 1 sheet tổng hợp + 1 sheet dòng tiền chi tiết từng sản phẩm
import { CACH_TINH, dongTien } from './pricing'

const NAVY = 'FF16213E', XAM = 'FFF3F5F8', XANH = 'FFE6F4EF', DO = 'FFE0533D', CHU = 'FF1F2A44', MUTE = 'FF6B7385', LO = 'FFC0392B', LAI = 'FF1E8E6E'
const vien = { top: { style: 'thin', color: { argb: 'FFB8BFCC' } }, left: { style: 'thin', color: { argb: 'FFB8BFCC' } }, bottom: { style: 'thin', color: { argb: 'FFB8BFCC' } }, right: { style: 'thin', color: { argb: 'FFB8BFCC' } } }
const fill = (c, argb) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } } }
const TIEN = '#,##0'
const PT = '0.00%'

export async function xuatBangGia({ tenNhom, sps, kqs, cfg }) {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  const homNay = new Date().toLocaleDateString('vi-VN')
  const ten = (x, i) => (x.ten || '').trim() || `Sản phẩm ${i + 1}`

  // ===== Sheet 1: Tổng hợp =====
  const ws = wb.addWorksheet('Tổng hợp', { views: [{ showGridLines: false }], pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } })
  const heads = ['STT', 'Sản phẩm', 'Ngành hàng', 'Cách định giá', 'Giá vốn', 'Chi phí thật', 'Giảm giá', 'Giá niêm yết', 'Khách trả', 'Tổng phí sàn', 'Lợi nhuận / đơn', 'Biên lợi nhuận', 'Lãi / vốn', 'Giá hoà vốn']
  ws.columns = [6, 30, 28, 24, 14, 14, 11, 15, 15, 15, 16, 14, 12, 15].map((width) => ({ width }))
  const n = heads.length
  ws.mergeCells(1, 1, 1, n)
  let c = ws.getCell(1, 1); c.value = 'BẢNG TÍNH GIÁ BÁN SHOPEE'; c.font = { bold: true, size: 18, color: { argb: 'FFFFFFFF' } }; c.alignment = { vertical: 'middle', indent: 1 }; fill(c, NAVY); ws.getRow(1).height = 36
  ws.mergeCells(2, 1, 2, n)
  c = ws.getCell(2, 1); c.value = `${tenNhom ? `Nhóm: ${tenNhom}  ·  ` : ''}Ngày xuất: ${homNay}  ·  ${sps.length} sản phẩm`; c.font = { italic: true, size: 10, color: { argb: MUTE } }; c.alignment = { indent: 1 }

  const coDu = kqs.filter((k) => !k.chuaDu)
  const lai = coDu.filter((k) => !k.lo).length
  const bienTb = coDu.length ? coDu.reduce((s, k) => s + k.kq.bien, 0) / coDu.length : 0
  const the = [['Số sản phẩm', sps.length, '0'], ['Sản phẩm có lãi', lai, '0'], ['Sản phẩm bị lỗ', coDu.length - lai, '0'], ['Biên lợi nhuận trung bình', bienTb / 100, PT]]
  const toa = [[1, 3], [4, 6], [7, 10], [11, 14]]
  the.forEach(([nhan, gt, fmt], i) => {
    const [c1, c2] = toa[i]
    ws.mergeCells(4, c1, 4, c2); ws.mergeCells(5, c1, 5, c2)
    const a = ws.getCell(4, c1); a.value = nhan; a.font = { size: 10, color: { argb: MUTE } }
    const b = ws.getCell(5, c1); b.value = gt; b.numFmt = fmt; b.font = { bold: true, size: 20, color: { argb: i === 2 && gt > 0 ? LO : NAVY } }
    for (let rr = 4; rr <= 5; rr++) for (let cc = c1; cc <= c2; cc++) fill(ws.getCell(rr, cc), XAM)
    a.alignment = { vertical: 'middle', indent: 1 }; b.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
  })
  ws.getRow(5).height = 32

  let r = 7
  heads.forEach((h, i) => {
    const x = ws.getCell(r, i + 1); x.value = h; x.font = { bold: true, color: { argb: 'FFFFFFFF' } }; fill(x, NAVY)
    x.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; x.border = vien
  })
  ws.getRow(r).height = 34
  sps.forEach((x, i) => {
    r += 1
    const k = kqs[i]; const o = k.kq
    const giaTri = k.chuaDu
      ? [i + 1, ten(x, i), x.nganh2 || '', CACH_TINH[x.cheDo], o.giaVon, o.chiPhiThat, '', '', '', '', '', '', '', '']
      : [i + 1, ten(x, i), x.nganh2 || '', CACH_TINH[x.cheDo], o.giaVon, o.chiPhiThat, Number(x.f.giamGiaPct || 0) / 100, o.giaNiemYet, o.giaSauGiam, o.tongPhi, o.loiNhuan, o.bien / 100, o.tyLeVon / 100, k.hoaVon]
    const fmts = [0, 0, 0, 0, TIEN, TIEN, PT, TIEN, TIEN, TIEN, TIEN, PT, PT, TIEN]
    giaTri.forEach((v, j) => {
      const cell = ws.getCell(r, j + 1); cell.value = v; if (fmts[j]) cell.numFmt = fmts[j]
      cell.border = vien
      cell.alignment = { vertical: 'middle', horizontal: j === 0 ? 'center' : j < 4 ? 'left' : 'right', indent: j === 1 || j === 2 || j === 3 ? 1 : 0, wrapText: j === 2 }
      if (i % 2) fill(cell, 'FFFAFBFC')
      if (j === 7) cell.font = { bold: true, color: { argb: CHU } }
      if (j === 10 && !k.chuaDu) cell.font = { bold: true, color: { argb: k.lo ? LO : LAI } }
    })
    ws.getRow(r).height = 24
  })
  r += 2
  ws.mergeCells(r, 1, r, n)
  c = ws.getCell(r, 1)
  c.value = `Phí xử lý giao dịch ${cfg?.phi_xu_ly ?? 6}% · phí hạ tầng ${(cfg?.phi_ha_tang ?? 3000).toLocaleString('vi-VN')}đ/đơn · thuế ${cfg?.thue_pct ?? 1.5}% (nếu có). Phí sàn tính trên số tiền khách thực trả sau giảm giá.`
  c.font = { italic: true, size: 10, color: { argb: MUTE } }; c.alignment = { indent: 1 }

  // ===== Sheet 2: Dòng tiền =====
  const w2 = wb.addWorksheet('Dòng tiền', { views: [{ showGridLines: false, state: 'frozen', xSplit: 1, ySplit: 3 }] })
  w2.columns = [{ width: 38 }, ...sps.map(() => ({ width: 22 }))]
  w2.mergeCells(1, 1, 1, sps.length + 1)
  c = w2.getCell(1, 1); c.value = 'CHI TIẾT DÒNG TIỀN TỪNG SẢN PHẨM'; c.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } }; c.alignment = { vertical: 'middle', indent: 1 }; fill(c, NAVY); w2.getRow(1).height = 32
  const dts = sps.map((_, i) => (kqs[i].chuaDu ? [] : dongTien(kqs[i].kq, kqs[i].d)))
  const nhanDong = (dts.find((a) => a.length) || []).map((x) => x.nhan.replace(/\s*\(.*\)$/, ''))
  // gộp nhãn theo tên gốc để các sản phẩm khác nhau (có/không có phí) vẫn thẳng hàng
  const goc = (s) => s.replace(/\s*\(.*\)$/, '')
  const tatCa = []
  dts.forEach((a) => a.forEach((x) => { if (!tatCa.includes(goc(x.nhan))) tatCa.push(goc(x.nhan)) }))
  const thuTu = ['Giá niêm yết', 'Giảm giá chương trình', 'Mã giảm của shop', 'Khách thực trả', 'Giá vốn', 'Đóng gói, nhân công', 'Chi phí khác', 'Phí cố định', 'Phí xử lý giao dịch', 'Phí hạ tầng', 'Voucher Xtra', 'Đồng tài trợ mã ưu đãi', 'Freeship Xtra', 'Gói PiShip', 'Tiếp thị liên kết', 'Quảng cáo', 'Thuế', 'Lợi nhuận còn lại']
  const dsNhan = thuTu.filter((t) => tatCa.includes(t))
  void nhanDong
  const hd = w2.getRow(3)
  ;['Khoản mục', ...sps.map((x, i) => ten(x, i))].forEach((t, i) => {
    const x = hd.getCell(i + 1); x.value = t; x.font = { bold: true, color: { argb: 'FFFFFFFF' } }; fill(x, NAVY)
    x.alignment = { horizontal: i ? 'center' : 'left', vertical: 'middle', wrapText: true, indent: i ? 0 : 1 }; x.border = vien
  })
  hd.height = 34
  w2.getCell(2, 1).value = ''
  dsNhan.forEach((nh, j) => {
    const row = w2.getRow(4 + j)
    const dam = ['Giá niêm yết', 'Khách thực trả', 'Lợi nhuận còn lại'].includes(nh)
    const x = row.getCell(1); x.value = nh; x.border = vien; x.alignment = { vertical: 'middle', indent: 1 }
    x.font = { bold: dam, color: { argb: CHU } }; if (dam) fill(x, nh === 'Lợi nhuận còn lại' ? XANH : XAM)
    sps.forEach((_, i) => {
      const it = dts[i].find((z) => goc(z.nhan) === nh)
      const cell = row.getCell(i + 2); cell.value = it ? it.tien : ''; cell.numFmt = TIEN; cell.border = vien
      cell.alignment = { horizontal: 'right', vertical: 'middle' }
      cell.font = { bold: dam, color: { argb: nh === 'Lợi nhuận còn lại' && it ? (it.tien < 0 ? LO : LAI) : CHU } }
      if (dam) fill(cell, nh === 'Lợi nhuận còn lại' ? XANH : XAM)
    })
    row.height = 22
  })

  const buf = await wb.xlsx.writeBuffer()
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const a = document.createElement('a'); a.href = url
  a.download = `Bang-tinh-gia-${(tenNhom || 'shopee').replace(/[^\p{L}\p{N}]+/gu, '-')}.xlsx`
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
