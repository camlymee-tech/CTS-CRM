// Xuất báo giá dịch vụ CTS ra Excel: bảng kẻ ô, đúng thứ tự các dòng như file báo giá mẫu
import { so, tinhThue, tinhXNK, tinhOrder, khungXNK, TEN_DV } from './baoGia'
import logoUrl from '../assets/cts-logo.png'

let LOGO = null   // dữ liệu ảnh logo CTS, nạp 1 lần khi xuất file

const NAVY = 'FF0A2463', CAM = 'FFFFEDD5', XAM = 'FFF1F5F9', TRANG = 'FFFFFFFF'
const mau = { argb: 'FFCBD5E1' }
const vien = { top: { style: 'thin', color: mau }, left: { style: 'thin', color: mau }, bottom: { style: 'thin', color: mau }, right: { style: 'thin', color: mau } }
const TIEN = '#,##0'
const fill = (c, argb) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } } }

function tieuDe(ws, n, tieu, khach, ma) {
  ws.mergeCells(1, 1, 1, n)
  ws.getRow(1).height = 46
  if (LOGO) {
    const id = ws.workbook.addImage({ buffer: LOGO, extension: 'png' })
    ws.addImage(id, { tl: { col: 0.1, row: 0.1 }, ext: { width: 150, height: 44 } })
  } else {
    const a = ws.getCell(1, 1); a.value = 'CTS GROUP'; a.font = { bold: true, size: 12, color: { argb: 'FF2A62AF' } }
  }
  ws.mergeCells(2, 1, 2, n)
  const b = ws.getCell(2, 1); b.value = tieu; b.font = { bold: true, size: 16, color: { argb: NAVY } }; ws.getRow(2).height = 26
  ws.mergeCells(3, 1, 3, n)
  const c = ws.getCell(3, 1)
  c.value = `Khách hàng: ${khach || '..........'}   ·   Mã báo giá: ${ma || '..........'}   ·   Ngày: ${new Date().toLocaleDateString('vi-VN')}`
  c.font = { italic: true, size: 10, color: { argb: 'FF64748B' } }
}
function dongDau(ws, r, heads) {
  heads.forEach((h, i) => {
    const c = ws.getCell(r, i + 1)
    c.value = h; c.border = vien; c.font = { bold: true, color: { argb: TRANG } }; fill(c, NAVY)
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
  })
  ws.getRow(r).height = 34
}
function o(ws, r, ci, v, { fmt, dam, nen, canh } = {}) {
  const c = ws.getCell(r, ci)
  c.value = v === undefined || v === null ? '' : v; c.border = vien
  if (typeof v === 'number') c.numFmt = fmt || TIEN
  c.font = { bold: !!dam, size: 10 }
  c.alignment = { vertical: 'middle', horizontal: canh || (typeof v === 'number' ? 'right' : 'left'), wrapText: true }
  if (nen) fill(c, nen)
  return c
}
const pt = (v) => (so(v) ? `${so(v).toFixed(2).replace('.', ',')}%` : '')

export async function xuatBaoGia({ loai, st }) {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  if (!LOGO) { try { LOGO = await (await fetch(logoUrl)).arrayBuffer() } catch { LOGO = null } }
  const order = loai === 'order'
  const dv = order ? (st.dichVu || 'van_chuyen') : loai
  const ten = order ? 'Báo giá order' : `Báo giá dịch vụ ${TEN_DV[loai]}`
  if (order) sheetOrder(wb, st)
  const ws = wb.addWorksheet(order ? 'Vận chuyển' : 'Báo giá', { views: [{ showGridLines: false }], pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } })

  {
    const kq = tinhXNK(st, dv, order)
    const heads = ['STT', 'Nội dung', 'ĐVT', 'Số lượng', 'Đơn giá', 'Thành tiền theo KG', 'Thành tiền theo M3']
    ws.columns = [7, 52, 8, 14, 15, 20, 20].map((width) => ({ width }))
    tieuDe(ws, heads.length, order ? `BÁO GIÁ VẬN CHUYỂN - ${TEN_DV[dv]}` : `BÁO GIÁ DỊCH VỤ ${TEN_DV[loai]}`, st.khach, st.ma)
    let r = 4
    r++
    dongDau(ws, r, heads); r++
    const giaTri = (x) => (x && typeof x === 'object' ? (x.fix ?? so(st[x.k])) : x)
    khungXNK(st, kq, dv, order).forEach((row) => {
      const dam = row.loai !== 'dong' || row.dam
      const nen = row.loai === 'tong' ? (row.lon ? CAM : XAM) : row.loai === 'nhom' ? XAM : undefined
      o(ws, r, 1, row.stt, { canh: 'center', dam, nen })
      o(ws, r, 2, row.nd + (row.pct ? ` (${pt(st[row.pct.k])})` : ''), { dam, nen })
      o(ws, r, 3, row.dvt || '', { canh: 'center', nen })
      o(ws, r, 4, row.sl === undefined ? '' : giaTri(row.sl), { nen, fmt: '#,##0.##' })
      o(ws, r, 5, row.dg === undefined ? '' : giaTri(row.dg), { nen, fmt: row.dg && row.dg.pct ? '0.00"%"' : '#,##0.##' })
      o(ws, r, 6, row.t.kg ?? '', { dam, nen })
      o(ws, r, 7, row.t.m3 ?? '', { dam, nen })
      r++
    })
    r += 1
    ws.mergeCells(r, 1, r, 7); const c = ws.getCell(r, 1); c.value = 'TỔNG HỢP SO SÁNH'; c.font = { bold: true, size: 12, color: { argb: NAVY } }; r++
    dongDau(ws, r, ['', 'Nội dung', '', '', '', 'Theo KG', 'Theo M3']); r++
    const gop = (nd, a, b, dam) => { o(ws, r, 1, '', { nen: XAM }); o(ws, r, 2, nd, { dam }); ;[3, 4, 5].forEach((i) => o(ws, r, i, '')); o(ws, r, 6, a ?? '', { dam }); o(ws, r, 7, b ?? '', { dam }); r++ }
    gop('Số lượng (KG / M3)', kq.kg.sl, kq.m3.sl)
    gop('Giá bán dự kiến (thành tiền)', kq.kg.duKien, kq.m3.duKien, true)
    gop('Giá bán dự kiến (đơn giá)', kq.kg.duKienDg, kq.m3.duKienDg)
    gop('Giá bán chốt (thành tiền)', so(st.chotKg) ? kq.kg.chotTT : '', so(st.chotM3) ? kq.m3.chotTT : '')
    gop('Chênh lệch chốt - dự kiến', kq.kg.cl, kq.m3.cl)

    {
      const w2 = wb.addWorksheet('Khai báo thuế', { views: [{ showGridLines: false }] })
      const h2 = ['STT', 'Sản phẩm', 'Số lượng', 'Đơn giá (tệ)', 'Giá trị (tệ)', 'Tỷ giá tệ', 'Tiền hàng (VND)', 'Đơn giá khai (USD)', 'Giá trị khai (USD)', 'Tỷ giá USD', 'Giá trị khai (VND)', 'TS thuế NK', 'TS GTGT', 'CBPG', 'TTDB', 'BVMT', 'Thuế NK', 'CBPG', 'TTDB', 'Thuế GTGT', 'Tổng thuế']
      w2.columns = [6, 26, 10, 12, 14, 10, 16, 14, 14, 10, 16, 11, 11, 10, 10, 12, 15, 14, 14, 16, 16].map((width) => ({ width }))
      tieuDe(w2, h2.length, 'KHAI BÁO THUẾ', st.khach, st.ma)
      dongDau(w2, 5, h2)
      const th = tinhThue(st)
      st.sp.forEach((p, i) => {
        const d = th.dong[i]
        ;[i + 1, p.ten || `Sản phẩm ${i + 1}`, so(p.sl), so(p.dg), d.tri, so(st.tyGiaTe), d.W, so(p.dgUsd), d.usd, so(st.tyGiaUsd), d.WU, pt(p.nk), pt(p.gtgt), pt(p.cbpg), pt(p.ttdb), so(p.bvmt), d.nk, d.cbpg, d.ttdb, d.gtgt, d.tong]
          .forEach((v, ci) => o(w2, 6 + i, ci + 1, v, { canh: ci === 0 ? 'center' : ci >= 11 && ci <= 14 ? 'center' : undefined, fmt: '#,##0.##', dam: ci === 20 }))
      })
      const rr = 6 + st.sp.length
      ;['', 'TỔNG CỘNG', '', '', '', '', th.dong.reduce((a, d) => a + d.W, 0), '', th.dong.reduce((a, d) => a + d.usd, 0), '', th.dong.reduce((a, d) => a + d.WU, 0), '', '', '', '', '', th.dong.reduce((a, d) => a + d.nk, 0), th.dong.reduce((a, d) => a + d.cbpg, 0), th.dong.reduce((a, d) => a + d.ttdb, 0), th.dong.reduce((a, d) => a + d.gtgt, 0), th.tong.tong]
        .forEach((v, ci) => o(w2, rr, ci + 1, v, { dam: true, nen: XAM }))
    }
  }

  const buf = await wb.xlsx.writeBuffer()
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const a = document.createElement('a')
  a.href = url; a.download = `${ten}${st.khach ? ' - ' + st.khach : ''}.xlsx`; a.click()
  URL.revokeObjectURL(url)
}

// Sheet đầu của báo giá order: giá xưởng + bảng tổng hợp + giá về tay
function sheetOrder(wb, st) {
  const ws = wb.addWorksheet('Giá xưởng & giá về tay', { views: [{ showGridLines: false }], pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } })
  const kq = tinhOrder(st)
  const heads = ['STT', 'Sản phẩm', 'Link SP', 'Số lượng', 'Giá web (¥)', 'Ship nội địa (¥)', 'Giá trị đơn hàng (¥)']
  ws.columns = [6, 28, 26, 11, 13, 15, 18].map((width) => ({ width }))
  tieuDe(ws, heads.length, 'BÁO GIÁ ORDER', st.khach, st.ma)
  ws.mergeCells(4, 1, 4, heads.length)
  const gc = ws.getCell(4, 1)
  gc.value = `Tỷ giá tệ: ${so(st.tyGiaTe).toLocaleString('vi-VN')}   ·   Tỷ lệ phí dịch vụ: ${pt(st.phiDVPct)}   ·   Dịch vụ vận chuyển: ${TEN_DV[st.dichVu] || ''}`
  gc.font = { size: 10, bold: true }
  dongDau(ws, 6, heads)
  st.sp.forEach((p, i) => {
    const r = 7 + i
    ;[i + 1, p.ten || `Sản phẩm ${i + 1}`, p.link || '', so(p.sl), so(p.dg), so(p.ship), kq.tri[i]]
      .forEach((v, ci) => o(ws, r, ci + 1, v, { canh: ci === 0 ? 'center' : undefined, fmt: ci >= 4 ? '#,##0.00' : undefined, dam: ci === 6 }))
  })
  let r = 7 + st.sp.length + 1
  const khoi = (tieu, heads2, rows) => {
    ws.mergeCells(r, 1, r, 4); const c = ws.getCell(r, 1); c.value = tieu; c.font = { bold: true, size: 12, color: { argb: NAVY } }; r++
    heads2.forEach((h, i) => { const c2 = ws.getCell(r, i + 1); c2.value = h; c2.border = vien; c2.font = { bold: true, color: { argb: TRANG } }; fill(c2, NAVY); c2.alignment = { horizontal: 'center', vertical: 'middle' } })
    r++
    rows.forEach(({ v, dam, nen }) => {
      v.forEach((val, ci) => o(ws, r, ci + 1, val, { dam, nen, canh: ci === 0 ? 'center' : undefined, fmt: typeof val === 'number' && heads2[ci].includes('¥') ? '#,##0.00' : undefined }))
      r++
    })
    r++
  }
  const t = (s, v) => [s, v.te, v.vnd]
  khoi('1. GIÁ XƯỞNG', ['STT', 'Nội dung', 'Số tiền (¥ - RMB)', 'Quy đổi VND'], [
    { v: ['1', 'Giá trị đơn hàng', kq.gt1.te, kq.gt1.vnd] },
    { v: ['2', 'Tổng tiền ship nội địa', kq.ship.te, kq.ship.vnd] },
    { v: ['3', 'Giá trị đơn hàng + ship nội địa TQ', kq.gt3.te, kq.gt3.vnd] },
    { v: ['4', `Phí dịch vụ mua hàng (${pt(st.phiDVPct)})`, kq.phi.te, kq.phi.vnd] },
    { v: ['5', 'TỔNG PHẢI THANH TOÁN', kq.tong.te, kq.tong.vnd], dam: true, nen: CAM },
    { v: ['6', `${pt(st.tamUngPct)} tiền tạm ứng`, kq.tamUng.te, kq.tamUng.vnd] },
  ].map((x) => x))
  khoi('2. GIÁ VỀ TAY', ['STT', 'Nội dung', 'Theo KG', 'Theo M3'], [
    { v: ['1', 'Tổng số lượng sản phẩm', kq.tongSl, kq.tongSl] },
    { v: ['2', 'Tổng phải thanh toán tiền hàng (đã gồm phí mua hàng)', kq.tong.vnd, kq.tong.vnd] },
    { v: ['3', 'Chi phí vận chuyển + thuế (sheet Khai báo thuế và Vận chuyển)', kq.ve.kg.vc, kq.ve.m3.vc] },
    { v: ['4', 'TỔNG TIỀN HÀNG VỀ TAY', kq.ve.kg.tongVe, kq.ve.m3.tongVe], dam: true, nen: XAM },
    { v: ['5', 'GIÁ VỀ TAY 1 SẢN PHẨM', kq.ve.kg.motSp, kq.ve.m3.motSp], dam: true, nen: CAM },
  ])
}
