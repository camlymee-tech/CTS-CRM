// Tính báo giá dịch vụ CTS Logistics: Mua bán / Vận chuyển / Uỷ thác (theo 3 file báo giá mẫu)

export const so = (v) => {
  if (v === '' || v === null || v === undefined) return 0
  const n = Number(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}
const lam = (n) => Math.round(Number(n) || 0)

// ============ MUA BÁN / VẬN CHUYỂN / UỶ THÁC: cùng một giao diện (khai thuế + báo giá), chỉ khác cách tính báo giá ============
export const HINH_THUC_UT = {
  ut: { ten: 'Khách ủy thác XNK', phiTach: '3000000' },
  cts: { ten: 'Khách đứng & CTS đứng tờ khai', phiTach: '3000000' },
  nsx: { ten: 'Khách và nhà sản xuất đứng tờ khai', phiTach: '5000000' },
}
export const SP_THUE = () => ({ ten: '', sl: '', dg: '', dgUsd: '', nk: '', gtgt: '8', cbpg: '', ttdb: '', bvmt: '' })

const XNK_CHUNG = () => ({
  khach: '', ma: '', tuyen: 'BT-HN',
  kg: '', dgKg: '', m3: '', dgM3: '',
  phiTach: '3000000',
  thueNk: '', thueVat: '', thueKhac: '',
  shipKho: '', tauSl: '', tauDg: '', tauKgSl: '', tauKgDg: '', pallet: '', hoanGt: '', hoanPct: '0,6', khacVN: '',
  tq1Sl: '', tq1Dg: '3965', tq2Sl: '', tq2Dg: '3965', tq3Sl: '', tq3Dg: '3965',
  vatDV: '8', chotKg: '', chotM3: '', phiMuaPct: '2',
  tyGiaTe: '3965', tyGiaUsd: '26800', sp: [SP_THUE()],
})
export const MUA_BAN_MAC_DINH = () => ({ ...XNK_CHUNG(), phiTach: '' })
export const VAN_CHUYEN_MAC_DINH = () => XNK_CHUNG()
export const UY_THAC_MAC_DINH = () => ({ ...XNK_CHUNG(), hinhThuc: 'ut', phiTach: HINH_THUC_UT.ut.phiTach, tauDg: '550000' })

// Thuế theo từng sản phẩm (tab Uỷ thác)
export function tinhThue(st) {
  const ty = so(st.tyGiaTe), tyUsd = so(st.tyGiaUsd)
  const dong = (st.sp || []).map((p) => {
    const tri = so(p.sl) * so(p.dg)                     // giá trị (tệ)
    const W = lam(tri * ty)                             // tiền hàng theo tệ (VND)
    const usd = so(p.sl) * so(p.dgUsd)                  // giá trị khai (USD)
    const WU = lam(usd * tyUsd)                         // giá trị khai (VND)
    const T = so(p.dgUsd) > 0 ? WU : W                  // giá trị tính thuế: ưu tiên giá khai USD, không có thì dùng tệ
    const nk = lam(T * so(p.nk) / 100)
    const cbpg = lam(T * so(p.cbpg) / 100)
    const ttdb = lam((T + nk) * so(p.ttdb) / 100)
    const bvmt = lam(so(p.bvmt))
    const gtgt = lam((T + nk + cbpg + ttdb + bvmt) * so(p.gtgt) / 100)
    return { tri, W, usd, WU, T, nk, cbpg, ttdb, bvmt, gtgt, tong: nk + cbpg + ttdb + bvmt + gtgt }
  })
  const t = { nk: 0, vat: 0, khac: 0, tong: 0 }
  dong.forEach((d) => { t.nk += d.nk; t.vat += d.gtgt; t.khac += d.cbpg + d.ttdb + d.bvmt; t.tong += d.tong })
  return { dong, tong: t }
}

export function tinhXNK(st, loai, order = false) {
  const th = tinhThue(st)
  const thue = th.tong
  const tienHang = th.dong.reduce((a, d) => a + d.W, 0)
  // order = true: tiền hàng và phí mua hàng đã tính ở bước giá xưởng nên không tính lại ở phần vận chuyển
  const muaBan = loai === 'mua_ban' && !order
  const mb = loai === 'mua_ban'   // bố cục bảng mua bán (kể cả khi tính trong order)
  const coPhiMua = !order && (loai === 'mua_ban' || loai === 'uy_thac')
  const thueTuNop = loai === 'van_chuyen' && !order   // Vận chuyển: thuế khách tự nộp, CTS chỉ thu tiền dịch vụ
  const nenHoan = th.dong.reduce((a, d) => a + d.T, 0)   // giá trị tính thuế: có giá khai USD thì giá trị khai (VND), không thì tiền hàng theo tệ
  const phiMua = coPhiMua ? lam(tienHang * so(st.phiMuaPct) / 100) : 0

  const phiTach = mb ? 0 : lam(so(st.phiTach))   // Mua bán không có phí tách tờ khai
  const tauM3 = lam((mb ? so(st.m3) : so(st.tauSl)) * so(st.tauDg))   // Mua bán: số khối lấy tự động từ dòng cước M3
  const tauKg = mb ? lam(so(st.kg) * so(st.tauKgDg)) : 0   // Mua bán: số cân lấy tự động từ dòng cước KG
  const vnDong = [lam(so(st.shipKho)), tauM3, lam(so(st.pallet)), (mb || loai === 'uy_thac') ? 0 : lam(nenHoan * so(st.hoanPct) / 100), lam(so(st.khacVN)), tauKg]
  const tqDong = [lam(so(st.tq1Sl) * so(st.tq1Dg)), lam(so(st.tq2Sl) * so(st.tq2Dg)), lam(so(st.tq3Sl) * so(st.tq3Dg))]
  const vnChung = vnDong[0] + vnDong[2] + vnDong[3] + vnDong[4]
  const vnKg = vnChung + (mb ? tauKg + tauM3 : tauM3)   // Mua bán: phí gửi tàu (nhập theo KG hoặc M3) cộng vào cả 2 cột
  const vnM3 = vnKg
  const vn = vnM3
  const tq = tqDong.reduce((a, b) => a + b, 0)
  const vatDV = so(st.vatDV)

  const kich = (sl, dg, chot, vn) => {
    const cuoc = lam(sl * dg)
    const tongCP = cuoc + phiTach + phiMua + vn + tq
    const vat = lam(tongCP * vatDV / 100)
    const hoaDon = tongCP + vat
    const phaiTra = hoaDon + (thueTuNop ? 0 : thue.tong) + (muaBan ? tienHang : 0)
    const duKien = cuoc + phiTach + phiMua + thue.tong + vn + tq
    const chotTT = lam(sl * so(chot))
    const khac = phiTach + phiMua + thue.tong + vn + tq
    return {
      sl, cuoc, tongCP, vat, hoaDon, phaiTra,
      giaTB: sl ? lam(phaiTra / sl) : 0,
      duKien, duKienDg: sl ? lam(duKien / sl) : 0,
      chotTT, cl: so(chot) ? chotTT - duKien : null,
      cuocChot: so(chot) ? chotTT - khac : null,
      cuocChotDg: so(chot) && sl ? Math.round((chotTT - khac) / sl * 100) / 100 : null,
    }
  }
  return {
    thue, tienHang, nenHoan, phiMua, phiTach, vnDong, tqDong, vn, tq,
    kg: { ...kich(so(st.kg), so(st.dgKg), st.chotKg, vnKg), vn: vnKg },
    m3: { ...kich(so(st.m3), so(st.dgM3), st.chotM3, vnM3), vn: vnM3 },
  }
}

// Khung bảng báo giá (dùng chung cho màn hình và file Excel).
// sl / dg: số (hiện chữ), hoặc {k, tp} = ô nhập gắn với st[k] (tp = cho phép số lẻ), hoặc {fix:số}.
export function khungXNK(st, kq, loai, order = false) {
  const muaBan = loai === 'mua_ban' && !order
  const mb = loai === 'mua_ban'
  const coPhiMua = !order && (loai === 'mua_ban' || loai === 'uy_thac')
  const thueTuNop = loai === 'van_chuyen' && !order
  const o = thueTuNop ? -1 : mb ? (coPhiMua ? 0 : -1) : (coPhiMua ? 1 : 0)   // Mua bán không có dòng phí tách tờ khai nên đánh số lùi 1
  const n = (x) => String(x + o)
  const tuyen = st.tuyen || 'BT-HN'
  const dongTien = (k) => ({ k })
  const R = []
  const nhom = (stt, nd, kg, m3) => R.push({ loai: 'nhom', stt, nd, t: { kg, m3 } })
  const dong = (o) => R.push({ loai: 'dong', ...o })
  const chung = (v) => ({ kg: v, m3: v })

  dong({ stt: 'I', nd: `Cước vận chuyển ${tuyen} theo KG`, dvt: 'KG', sl: { k: 'kg', tp: 1 }, dg: dongTien('dgKg'), t: { kg: kq.kg.cuoc, m3: null }, dam: 1 })
  dong({ stt: '', nd: `Cước vận chuyển ${tuyen} theo M3`, dvt: 'M3', sl: { k: 'm3', tp: 1 }, dg: dongTien('dgM3'), t: { kg: null, m3: kq.m3.cuoc }, dam: 1 })
  nhom('II', 'Các khoản chi phí', null, null)
  if (!mb) dong({ stt: '1', nd: 'Phí tách tờ khai', dvt: 'TK', sl: 1, dg: dongTien('phiTach'), t: chung(kq.phiTach) })
  if (coPhiMua) dong({ stt: muaBan ? '1' : '2', nd: muaBan ? 'Phí mua hàng (% × tiền hàng)' : 'Phí mua hàng uỷ thác (% × tiền hàng)', pct: { k: 'phiMuaPct' }, dvt: 'Lô', sl: 1, dg: kq.phiMua, t: chung(kq.phiMua) })
  if (!thueTuNop) {
    nhom(n(2), thueTuNop ? 'Các khoản tiền thuế (khách tự nộp, không tính vào tổng thanh toán)' : 'Các khoản tiền thuế', kq.thue.tong, kq.thue.tong)
    dong({ stt: n(2) + '.1', nd: 'Thuế nhập khẩu', dvt: 'Lô', sl: 1, dg: kq.thue.nk, t: chung(kq.thue.nk), sub: 1 })
    dong({ stt: n(2) + '.2', nd: 'Thuế VAT', dvt: 'Lô', sl: 1, dg: kq.thue.vat, t: chung(kq.thue.vat), sub: 1 })
    dong({ stt: n(2) + '.3', nd: 'Thuế khác (CBPG, TTDB, BVMT)', dvt: 'Lô', sl: 1, dg: kq.thue.khac, t: chung(kq.thue.khac), sub: 1 })
  }
  nhom(n(3), 'Các chi phí nội địa Việt Nam', kq.kg.vn, kq.m3.vn)
  dong({ stt: n(3) + '.1', nd: 'Phí ship kho VN đến khách hàng', dvt: 'Lô', sl: 1, dg: dongTien('shipKho'), t: chung(kq.vnDong[0]), sub: 1 })
  if (mb) {
    // Phí gửi tàu: 1 mục, bên trong có 2 mục nhỏ theo KG / theo M3 (sale chỉ điền 1 trong 2)
    dong({ stt: n(3) + '.2', nd: 'Phí gửi tàu', t: chung(kq.vnDong[5] + kq.vnDong[1]), sub: 1, dam: 1 })
    dong({ stt: n(3) + '.2.1', nd: 'Theo KG', dvt: 'KG', sl: { fix: so(st.kg) }, dg: dongTien('tauKgDg'), t: chung(kq.vnDong[5]), sub: 2 })
    dong({ stt: n(3) + '.2.2', nd: 'Theo M3', dvt: 'M3', sl: { fix: so(st.m3) }, dg: dongTien('tauDg'), t: chung(kq.vnDong[1]), sub: 2 })
  } else {
    dong({ stt: n(3) + '.2', nd: 'Phí gửi tàu', dvt: 'M3', sl: { k: 'tauSl', tp: 1 }, dg: dongTien('tauDg'), t: chung(kq.vnDong[1]), sub: 1 })
  }
  const k3 = 0
  dong({ stt: n(3) + '.' + (3 + k3), nd: 'Phí nâng hạ pallet cửa khẩu', dvt: 'Lô', sl: 1, dg: dongTien('pallet'), t: chung(kq.vnDong[2]), sub: 1 })
  if (!mb && loai !== 'uy_thac') dong({ stt: n(3) + '.4', nd: 'Phí hoàn tiền hợp đồng ngoại (SL = tỉ lệ %, đơn giá = giá trị khai VND nếu có giá khai USD, không thì tiền hàng theo tệ)', dvt: 'HĐ', sl: { k: 'hoanPct', tp: 1 }, dg: { fix: kq.nenHoan, money: 1 }, t: chung(kq.vnDong[3]), sub: 1 })
  dong({ stt: n(3) + ((mb || loai === 'uy_thac') ? '.4' : '.5'), nd: 'Phí khác tại Việt Nam', dvt: 'Lô', sl: 1, dg: dongTien('khacVN'), t: chung(kq.vnDong[4]), sub: 1 })
  nhom(n(4), 'Các chi phí nội địa Trung Quốc (SL = số tệ, đơn giá = tỷ giá)', kq.tq, kq.tq)
  dong({ stt: n(4) + '.1', nd: 'Ứng / kéo / hạ hàng / cân TQ', dvt: 'Tệ', sl: { k: 'tq1Sl', tp: 1 }, dg: { k: 'tq1Dg' }, t: chung(kq.tqDong[0]), sub: 1 })
  dong({ stt: n(4) + '.2', nd: 'Phí kiểm dịch TQ', dvt: 'Tệ', sl: { k: 'tq2Sl', tp: 1 }, dg: { k: 'tq2Dg' }, t: chung(kq.tqDong[1]), sub: 1 })
  dong({ stt: n(4) + '.3', nd: 'Phí khác tại TQ', dvt: 'Tệ', sl: { k: 'tq3Sl', tp: 1 }, dg: { k: 'tq3Dg' }, t: chung(kq.tqDong[2]), sub: 1 })
  R.push({ loai: 'tong', stt: 'III', nd: 'Tổng chi phí xuất nhập khẩu', t: { kg: kq.kg.tongCP, m3: kq.m3.tongCP } })
  R.push({ loai: 'tong', stt: 'IV', nd: loai === 'uy_thac' ? 'Thuế VAT phí dịch vụ uỷ thác' : 'Thuế VAT phí dịch vụ', pct: { k: 'vatDV' }, t: { kg: kq.kg.vat, m3: kq.m3.vat } })
  if (thueTuNop) {
    // Vận chuyển: thuế khách tự nộp, CTS chỉ thu tiền dịch vụ
    R.push({ loai: 'tong', stt: 'V', nd: 'Tổng tiền phải thanh toán cho CTS (chỉ gồm tiền dịch vụ)', t: { kg: kq.kg.phaiTra, m3: kq.m3.phaiTra }, lon: 1 })
    // Thuế khách tự nộp: chỉ để khách nắm, không cộng vào tổng thanh toán ở trên
    R.push({ loai: 'nhom', stt: 'VI', nd: 'Thuế khách tự nộp (không tính vào tổng thanh toán cho CTS)', t: { kg: kq.thue.tong, m3: kq.thue.tong }, nhan: 1 })
    dong({ stt: 'VI.1', nd: 'Thuế nhập khẩu', dvt: 'Lô', sl: 1, dg: kq.thue.nk, t: chung(kq.thue.nk), sub: 1 })
    dong({ stt: 'VI.2', nd: 'Thuế VAT', dvt: 'Lô', sl: 1, dg: kq.thue.vat, t: chung(kq.thue.vat), sub: 1 })
    dong({ stt: 'VI.3', nd: 'Thuế khác (CBPG, TTDB, BVMT)', dvt: 'Lô', sl: 1, dg: kq.thue.khac, t: chung(kq.thue.khac), sub: 1 })
  } else {
    // V gom 3 khoản cộng vào tổng thanh toán: hoá đơn dịch vụ, tiền hàng (mua bán), thuế nộp hộ
    nhom('V', 'Các khoản thanh toán', null, null)
    dong({ stt: 'V.1', nd: 'Tổng tiền hoá đơn dịch vụ', t: { kg: kq.kg.hoaDon, m3: kq.m3.hoaDon }, sub: 1 })
    if (muaBan) dong({ stt: 'V.2', nd: 'Tiền hàng khách mua qua CTS', t: chung(kq.tienHang), sub: 1 })
    dong({ stt: muaBan ? 'V.3' : 'V.2', nd: 'Tổng tiền thuế nộp hộ khách', t: chung(kq.thue.tong), sub: 1 })
    R.push({ loai: 'tong', stt: 'VI', nd: 'Tổng tiền phải thanh toán cho CTS', t: { kg: kq.kg.phaiTra, m3: kq.m3.phaiTra }, lon: 1 })
  }
  return R
}

export const TEN_DV = { order: 'ORDER', mua_ban: 'MUA BÁN', van_chuyen: 'VẬN CHUYỂN', uy_thac: 'UỶ THÁC XUẤT NHẬP KHẨU' }

// Khung báo giá Mua bán (cùng kiểu bảng STT / Nội dung / ĐVT / Số lượng / Đơn giá / Thành tiền với 2 dịch vụ kia).
// sl / dg: số, hoặc {sp: số thứ tự sản phẩm, k: tên trường, tp: cho số lẻ}
export function khungMuaBan(st, kq) {
  return st.sp.map((p, i) => {
    const d = kq.dong[i]
    const f = (k, tp) => ({ sp: i, k, tp })
    const rows = [
      { loai: 'dong', stt: 'I', nd: `Tiền hàng (tỷ giá ${so(st.tyGia).toLocaleString('vi-VN')} đ/tệ)`, dvt: 'Tệ', sl: f('sl'), dg: f('dg', 1), t: d.G, dam: 1 },
      { loai: 'dong', stt: 'II', nd: 'Phí mua hàng', pct: so(st.phiMua), dvt: '%', sl: d.G, dg: so(st.phiMua), dgPct: 1, t: d.I, dam: 1 },
      { loai: 'dong', stt: 'III', nd: 'Cước vận chuyển', dvt: 'Lô', sl: 1, dg: f('cuoc'), t: d.J, dam: 1 },
      { loai: 'tong', stt: 'IV', nd: 'Tổng trước thuế (I + II + III)', t: d.L },
      { loai: 'dong', stt: 'V', nd: 'Thuế VAT hàng hoá', dvt: '%', sl: d.G, dg: so(st.vatHang), dgPct: 1, t: d.H, dam: 1 },
      { loai: 'dong', stt: 'VI', nd: 'Thuế VAT phí dịch vụ và vận chuyển', dvt: '%', sl: d.I + d.J, dg: so(st.vatVC), dgPct: 1, t: d.K, dam: 1 },
      { loai: 'tong', stt: 'VII', nd: 'Tổng tiền thuế (V + VI)', t: d.M },
      { loai: 'tong', stt: 'VIII', nd: 'Tổng tiền phải thanh toán (IV + VII)', t: d.N, lon: 1 },
      { loai: 'tong', stt: '', nd: 'Giá 1 sản phẩm', t: d.O, nhat: 1 },
      { loai: 'dong', stt: '', nd: 'Giá khách mong muốn (1 sản phẩm)', dvt: 'Lô', sl: 1, dg: f('mong'), t: d.mong || null },
      { loai: 'tong', stt: '', nd: 'Chênh lệch (giá thực tế - giá khách mong muốn)', t: d.chenh, nhat: 1 },
    ]
    return { ten: p.ten || `Sản phẩm ${i + 1}`, rows }
  })
}

// ============ BÁO GIÁ ORDER: giá xưởng → khai thuế → vận chuyển → giá về tay ============
export const SP_ORDER = () => ({
  ten: '', link: '', can: '', khoi: '', sl: '', dg: '', ship: '',
  dgUsd: '', nk: '', gtgt: '8', cbpg: '', ttdb: '', bvmt: '',
})
export const ORDER_MAC_DINH = () => ({
  ...XNK_CHUNG(), hinhThuc: 'ut', dichVu: 'van_chuyen', phiDVPct: '2', tamUngPct: '80', sp: [SP_ORDER()],
})

export function tinhOrder(st) {
  const ty = so(st.tyGiaTe), pct = so(st.phiDVPct), tamUng = so(st.tamUngPct)
  const sps = st.sp || []
  const tri = sps.map((p) => so(p.sl) * so(p.dg))                       // giá trị đơn hàng từng sản phẩm (tệ)
  const ship = sps.map((p) => so(p.ship))                               // ship nội địa TQ từng sản phẩm (tệ)
  const gt1 = tri.reduce((a, b) => a + b, 0)
  const shipTong = ship.reduce((a, b) => a + b, 0)
  const gt3 = gt1 + shipTong
  const phi = gt3 * pct / 100
  const tong = gt3 + phi
  const r = {
    gt1: { te: gt1, vnd: lam(gt1 * ty) },
    ship: { te: shipTong, vnd: lam(shipTong * ty) },
    gt3: { te: gt3, vnd: lam(gt3 * ty) },
    phi: { te: phi, vnd: lam(phi * ty) },
  }
  r.tong = { te: tong, vnd: r.gt3.vnd + r.phi.vnd }
  r.tamUng = { te: tong * tamUng / 100, vnd: lam(tong * tamUng / 100 * ty) }

  // phần vận chuyển + thuế theo dịch vụ đã chọn (bỏ tiền hàng và phí mua hàng vì đã tính ở trên)
  const xnk = tinhXNK(st, st.dichVu || 'van_chuyen', true)
  const thue = tinhThue(st)
  const tongSl = sps.reduce((a, p) => a + so(p.sl), 0)

  const ve = (k) => {
    const vc = xnk[k].phaiTra
    const tongVe = r.tong.vnd + vc
    // chia chi phí vận chuyển cho từng sản phẩm theo tỷ lệ giá trị hàng, thuế tính đúng theo sản phẩm
    const phanChia = vc - xnk.thue.tong
    const dong = sps.map((p, i) => {
      const w = gt3 > 0 ? (tri[i] + ship[i]) / gt3 : 0
      const hang = lam((tri[i] + ship[i]) * ty * (1 + pct / 100))
      const tong1 = hang + (thue.dong[i]?.tong || 0) + lam(phanChia * w)
      return { tong: tong1, mot: so(p.sl) ? lam(tong1 / so(p.sl)) : 0 }
    })
    return { vc, tongVe, motSp: tongSl ? lam(tongVe / tongSl) : 0, dong }
  }
  r.xnk = xnk
  r.tongSl = tongSl
  r.ve = { kg: ve('kg'), m3: ve('m3') }
  r.tri = tri
  return r
}
