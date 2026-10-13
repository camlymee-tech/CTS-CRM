// Đọc bảng phí sàn từ file PDF: gom chữ theo toạ độ thành dòng + cột, trả về dạng bảng như đọc từ Excel
const boDau = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/\s+/g, ' ').trim().toLowerCase()
const laPhanTram = (s) => /^\d{1,3}([.,]\d+)?\s*%?$/.test(String(s).trim())

export async function docBangTuPdf(pdfjs, buf) {
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise
  let tongSo = 0, tongChu = 0
  const bang = [['Ngành hàng cấp 1', 'Ngành hàng cấp 2', 'Ngành hàng cấp 3', 'Mức phí tiêu chuẩn', 'Mức phí ưu đãi cho Người bán mới']]
  let cot = null // vị trí các cột, lấy từ dòng tiêu đề (cột nào ở trang nào cũng dùng lại cho trang sau)

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const tc = await page.getTextContent()
    const it = tc.items
      .filter((x) => String(x.str).trim() !== '')
      .map((x) => ({ s: String(x.str).trim(), x: x.transform[4], y: x.transform[5], w: x.width || 0 }))

    // Tìm vị trí cột từ tiêu đề (nếu trang này có)
    const tim = (...k) => it.find((x) => k.some((t) => boDau(x.s).includes(t)))
    const c1 = tim('nganh hang cap 1'), c2 = tim('nganh hang cap 2'), c3 = tim('nganh hang cap 3')
    if (c1) {
      const phi = tim('phi co dinh', 'muc phi tieu chuan', 'phi tieu chuan')
      const ud = tim('uu dai', 'nguoi ban moi')
      cot = {
        a1: c1.x, a2: c2?.x ?? null, a3: c3?.x ?? null,
        tam1: phi ? phi.x + phi.w / 2 : null,
        tam2: ud ? ud.x + ud.w / 2 : null,
        yTieuDe: Math.min(c1.y, c2?.y ?? c1.y, c3?.y ?? c1.y) - 1,
      }
    }
    if (!cot) continue

    const kieuTieuDe = /^(stt|nganh hang cap|phi co dinh|muc phi|\(da bao gom|gtgt)/
    const goc = it.filter((x) => !(c1 && kieuTieuDe.test(boDau(x.s))))
    const phaiCot = (cot.a3 ?? cot.a2 ?? cot.a1) + 40
    const so0 = goc.filter((x) => laPhanTram(x.s) && x.x + x.w / 2 > phaiCot && (!c1 || x.y < c1.y - 8))
    // trang có tiêu đề: bỏ mọi chữ nằm trên dòng dữ liệu đầu tiên (tiêu đề nhiều dòng, nền đen/đỏ)
    const yTren = c1 && so0.length ? Math.max(...so0.map((x) => x.y)) + 5 : Infinity
    const chu = goc.filter((x) => x.y <= yTren)
    const so = so0
    tongSo += so.length; tongChu += chu.length
    if (!so.length) continue

    // mỗi số % tạo thành một dòng; số ở cột tiêu chuẩn thì xác định dòng, số ở cột ưu đãi gắn vào dòng cùng y
    const tamChuan = cot.tam1, tamUuDai = cot.tam2
    const dong = []
    const laUuDai = (x) => tamUuDai != null && (tamChuan == null || Math.abs(x.x + x.w / 2 - tamUuDai) < Math.abs(x.x + x.w / 2 - tamChuan))
    so.filter((x) => !laUuDai(x)).sort((a, b) => b.y - a.y).forEach((x) => dong.push({ y: x.y, chuan: x.s, uudai: '', t: [[], [], []] }))
    so.filter(laUuDai).forEach((x) => {
      const d = dong.reduce((m, r) => (Math.abs(r.y - x.y) < Math.abs(m.y - x.y) ? r : m), dong[0] || null)
      if (d && Math.abs(d.y - x.y) < 12) d.uudai = x.s
    })
    if (!dong.length) continue

    // chữ: gán vào dòng gần nhất theo trục y, chia cột theo vị trí x
    const nhanCot = (x) => {
      if (cot.a3 != null && x >= cot.a3 - 6) return 2
      if (cot.a2 != null && x >= cot.a2 - 6) return 1
      return 0
    }
    chu.filter((x) => !so.includes(x) && x.x >= cot.a1 - 6).forEach((x) => {
      const d = dong.reduce((m, r) => (Math.abs(r.y - x.y) < Math.abs(m.y - x.y) ? r : m), dong[0])
      d.t[nhanCot(x.x)].push(x)
    })
    dong.forEach((d) => {
      const ghep = (ds) => ds.sort((a, b) => b.y - a.y || a.x - b.x).map((z) => z.s).join(' ').replace(/\s+/g, ' ').trim()
      bang.push(['', '', '', d.chuan, d.uudai])
      const hang = bang[bang.length - 1]
      hang[0] = ghep(d.t[0]); hang[1] = ghep(d.t[1]); hang[2] = ghep(d.t[2])
    })
  }

  // ô gộp trong PDF chỉ in 1 lần ở dòng đầu: điền tiếp xuống các dòng trống bên dưới
  let g1 = '', g2 = ''
  for (let i = 1; i < bang.length; i++) {
    const h = bang[i]
    if (h[0]) { if (h[0] !== g1) { g1 = h[0]; if (!h[1]) g2 = '' } } else h[0] = g1
    if (h[1]) g2 = h[1]; else if (!h[2] && g2 && !h[1]) h[1] = g2; else if (h[2] && !h[1]) h[1] = g2
  }
  bang.info = `Đọc ${pdf.numPages} trang, tìm thấy ${tongSo} số %, ${tongChu} ô chữ, ${bang.length - 1} dòng.`
  return bang
}
