// Xuất file Excel dạng dashboard (thẻ chỉ số, thanh tiến độ, bảng màu) dùng chung cho các báo cáo.
// the: [{ nhan, gt, fmt, phu, pc }]  (pc = tỷ lệ 0..1 hoặc '' nếu không có thanh tiến độ)
// muc: danh sách khối theo thứ tự:
//   { loai: 'muc', text }                      tiêu đề mục
//   { loai: 'dai', text }                      dải tiêu đề nhỏ (ví dụ tên nhân sự)
//   { loai: 'ghichu', text }                   dòng ghi chú
//   { loai: 'bang', heads: [...], rows: [[...]], tong: true }
//   ô trong bảng: giá trị, hoặc { v, f: định dạng số, bar: tỷ lệ 0..1, mau: 'FFxxxxxx' }
const NAVY = 'FF0F1F3D', XANH = 'FFE0F2FE', XAM = 'FFF1F5F9', CHU = 'FF4338CA', MUTE = 'FF64748B'
const TEAL = 'FF14B8A6', VANG = 'FFF59E0B', DO = 'FFF0624D'
const vienMau = { argb: 'FFE2E8F0' }
const vien = { top: { style: 'thin', color: vienMau }, left: { style: 'thin', color: vienMau }, bottom: { style: 'thin', color: vienMau }, right: { style: 'thin', color: vienMau } }
const fill = (c, argb) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } } }
export const mauTienDo = (v) => (v === null || v === '' || v === undefined ? MUTE : v >= 1 ? TEAL : v >= 0.7 ? VANG : DO)
export const thanh = (v) => { const n = v === '' || v === undefined ? 0 : Math.max(0, Math.min(10, Math.round(v * 10))); return '█'.repeat(n) + '░'.repeat(10 - n) }
export const PT2 = '0.00%'
export const hienPt2 = (v) => (v === '' || v === null || v === undefined ? '' : `${new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v * 100)}%`)

export async function xuatDashboardXlsx({ tieuDe, phuDe, the, muc, tenFile }) {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Dashboard', { views: [{ showGridLines: false }], pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } })
  ws.columns = [{ width: 30 }, ...Array(10).fill({ width: 15 }), { width: 3 }]
  const gop = (r, c1, c2, r2 = r) => { if (c1 !== c2 || r !== r2) ws.mergeCells(r, c1, r2, c2); return ws.getCell(r, c1) }
  let r = 1
  let c = gop(r, 1, 11); c.value = tieuDe; c.font = { bold: true, size: 18, color: { argb: 'FFFFFFFF' } }; c.alignment = { vertical: 'middle', indent: 1 }; fill(c, NAVY); ws.getRow(r).height = 36
  r += 1; c = gop(r, 1, 11); c.value = phuDe || ''; c.font = { italic: true, size: 10, color: { argb: MUTE } }; c.alignment = { indent: 1 }
  r += 2

  const toa = [[1, 2], [3, 5], [6, 8], [9, 11]]
  the.forEach(({ nhan, gt, fmt, phu, pc }, i) => {
    const [c1, c2] = toa[i]
    const a = gop(r, c1, c2); a.value = nhan; a.font = { size: 10, color: { argb: MUTE } }
    const b = gop(r + 1, c1, c2); b.value = gt; if (fmt) b.numFmt = fmt; b.font = { bold: true, size: 22, color: { argb: NAVY } }
    const d = gop(r + 2, c1, c2); d.value = phu || ''; d.font = { size: 10, color: { argb: MUTE } }
    const e = gop(r + 3, c1, c2); e.value = pc === '' || pc === undefined ? '' : `${thanh(pc)}  ${hienPt2(pc)}`; e.font = { bold: true, size: 11, color: { argb: mauTienDo(pc) } }
    for (let rr = r; rr <= r + 3; rr++) for (let cc = c1; cc <= c2; cc++) fill(ws.getCell(rr, cc), XAM)
    for (let rr = r; rr <= r + 3; rr++) ws.getCell(rr, c1).alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
  })
  ws.getRow(r + 1).height = 34
  r += 5

  for (const m of muc) {
    if (m.loai === 'muc') {
      const x = gop(r, 1, 11); x.value = m.text; x.font = { bold: true, size: 13, color: { argb: NAVY } }; x.border = { bottom: { style: 'medium', color: { argb: DO } } }; r += 1
    } else if (m.loai === 'dai') {
      const x = gop(r, 1, 11); x.value = m.text; x.font = { bold: true, color: { argb: CHU } }; fill(x, XANH); r += 1
    } else if (m.loai === 'ghichu') {
      const x = gop(r, 1, 11); x.value = m.text; x.font = { italic: true, size: 10, color: { argb: MUTE } }; r += 2
    } else if (m.loai === 'bang') {
      m.heads.forEach((t, i) => { const x = ws.getCell(r, i + 1); x.value = t; x.font = { bold: true, color: { argb: 'FFFFFFFF' } }; fill(x, NAVY); x.alignment = { horizontal: i ? 'center' : 'left', vertical: 'middle', wrapText: true, indent: i ? 0 : 1 }; x.border = vien })
      ws.getRow(r).height = 34
      m.rows.forEach((row, j) => {
        r += 1
        const tong = m.tong !== false && j === m.rows.length - 1
        row.forEach((v, i) => {
          const x = ws.getCell(r, i + 1); const o = v && typeof v === 'object' && 'v' in v ? v : { v }
          x.value = o.v; if (o.f) x.numFmt = o.f
          x.border = vien; x.alignment = { horizontal: i ? 'center' : 'left', vertical: 'middle', indent: i ? 0 : 1 }
          if (o.bar !== undefined) { x.value = o.bar === '' ? '' : thanh(o.bar); x.font = { color: { argb: o.mau || mauTienDo(o.bar) }, size: 11 }; x.alignment = { horizontal: 'left', indent: 1 } }
          if (tong) { x.font = { bold: true, color: { argb: CHU } }; fill(x, XANH) } else if (j % 2 === 1) fill(x, 'FFFAFBFC')
        })
        ws.getRow(r).height = 22
      })
      r += 2
    }
  }
  const buf = await wb.xlsx.writeBuffer()
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const a = document.createElement('a'); a.href = url; a.download = tenFile
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
