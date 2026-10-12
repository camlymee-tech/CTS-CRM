// Đọc bảng phí sàn từ file PDF: gom chữ theo toạ độ thành dòng + cột, trả về dạng bảng như đọc từ Excel
const boDau = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/\s+/g, ' ').trim().toLowerCase()
const laPhanTram = (s) => /^\d{1,3}([.,]\d+)?\s*%?$/.test(String(s).trim())

export async function docBangTuPdf(pdfjs, buf) {
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise
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
      // tiêu đề "Phí cố định áp dụng từ …" thường xuống nhiều dòng: lấy tâm của cả khối chữ nằm cùng cột
      if (phi) {
        const cung = it.filter((x) => x.x > (c3?.x ?? c2?.x ?? c1.x) + 60 && x.y >= cot.yTieuDe - 70 && !laPhanTram(x.s) && !(ud && Math.abs(x.x + x.w / 2 - cot.tam2) < 40 && x !== phi))
        const trai = cung.filter((x) => !ud || x.x + x.w / 2 < (phi.x + (ud.x)) / 2)
        if (trai.length) cot.tam1 = trai.reduce((s, x) => s + x.x + x.w / 2, 0) / trai.length
      }
    }
    if (!cot) continue

    if (c1) {
      // tiêu đề nhiều dòng: đi xuống theo các dòng chữ (không phải số) nằm ở cột phí cho tới khi hết
      let day = cot.yTieuDe
      const trongCotPhi = it.filter((x) => !laPhanTram(x.s) && [cot.tam1, cot.tam2].some((t) => t != null && Math.abs(x.x + x.w / 2 - t) < 90) && x.y <= cot.yTieuDe + 12)
        .sort((a, b) => b.y - a.y)
      for (const x of trongCotPhi) { if (day - x.y <= 16) day = Math.min(day, x.y) }
      cot.yTieuDe = day
    }
    const duoi = c1 ? cot.yTieuDe - 4 : Infinity // trang có tiêu đề thì chỉ lấy phần dưới tiêu đề
    const chu = it.filter((x) => x.y < duoi && !(c1 && /^(stt|nganh hang cap|phi co dinh|muc phi|\(da bao gom)/.test(boDau(x.s))))
    const so = chu.filter((x) => laPhanTram(x.s) && x.x + x.w / 2 > (cot.a3 ?? cot.a2 ?? cot.a1) + 40)
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
  return bang
}
