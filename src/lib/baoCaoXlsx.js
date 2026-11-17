// Xuất 1 bảng báo cáo ra Excel: mỗi ô có viền, dòng tiêu đề tô xanh đậm.
export async function xuatBangXlsx({ tieuDe, phuDe = '', heads, rows, tenFile }) {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Báo cáo', { views: [{ showGridLines: false }] })
  const mau = { argb: 'FFCBD5E1' }
  const vien = { top: { style: 'thin', color: mau }, left: { style: 'thin', color: mau }, bottom: { style: 'thin', color: mau }, right: { style: 'thin', color: mau } }

  ws.mergeCells(1, 1, 1, Math.max(heads.length, 1))
  const t = ws.getCell(1, 1)
  t.value = tieuDe; t.font = { bold: true, size: 14, color: { argb: 'FF0A2463' } }
  ws.mergeCells(2, 1, 2, Math.max(heads.length, 1))
  const p = ws.getCell(2, 1)
  p.value = phuDe; p.font = { italic: true, size: 10, color: { argb: 'FF64748B' } }

  const hang = 4
  heads.forEach((h, i) => {
    const c = ws.getCell(hang, i + 1)
    c.value = h; c.border = vien
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A2463' } }
    c.alignment = { horizontal: i ? 'center' : 'left', vertical: 'middle', wrapText: true }
  })
  ws.getRow(hang).height = 32
  rows.forEach((r, j) => {
    r.forEach((v, i) => {
      const c = ws.getCell(hang + 1 + j, i + 1)
      c.value = v; c.border = vien
      c.alignment = { horizontal: i ? 'center' : 'left', vertical: 'middle' }
    })
  })
  ws.columns = heads.map((h, i) => ({ width: i === 0 ? 26 : Math.max(14, Math.min(24, String(h).length + 4)) }))

  const buf = await wb.xlsx.writeBuffer()
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const a = document.createElement('a'); a.href = url; a.download = tenFile
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
