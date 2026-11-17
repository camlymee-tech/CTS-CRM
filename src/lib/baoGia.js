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
export const SP_THUE = () => ({ ten: '', sl: '', dg: '', nk: '', gtgt: '8', cbpg: '', ttdb: '', bvmt: '' })

const XNK_CHUNG = () => ({
  khach: '', ma: '', tuyen: 'BT-HN',
  kg: '', dgKg: '', m3: '', dgM3: '',
  phiTach: '3000000',
  thueNk: '', thueVat: '', thueKhac: '',
  shipKho: '', tauSl: '', tauDg: '', pallet: '', hoanGt: '', hoanPct: '0,6', khacVN: '',
  tq1Sl: '', tq1Dg: '3965', tq2Sl: '', tq2Dg: '3965', tq3Sl: '', tq3Dg: '3965',
  vatDV: '8', chotKg: '', chotM3: '', phiMuaPct: '2',
  tyGiaTe: '3965', sp: [SP_THUE()],
})
export const MUA_BAN_MAC_DINH = () => ({ ...XNK_CHUNG(), phiTach: '' })
export const VAN_CHUYEN_MAC_DINH = () => XNK_CHUNG()
export const UY_THAC_MAC_DINH = () => ({ ...XNK_CHUNG(), hinhThuc: 'ut', phiTach: HINH_THUC_UT.ut.phiTach, tauDg: '550000' })

// Thuế theo từng sản phẩm (tab Uỷ thác)
export function tinhThue(st) {
  const ty = so(st.tyGiaTe)
  const dong = (st.sp || []).map((p) => {
    const tri = so(p.sl) * so(p.dg)                     // giá trị (tệ)
    const W = lam(tri * ty)                             // giá trị tính thuế (VND)
    const nk = lam(W * so(p.nk) / 100)
    const cbpg = lam(W * so(p.cbpg) / 100)
    const ttdb = lam((W + nk) * so(p.ttdb) / 100)
    const bvmt = lam(so(p.bvmt))
    const gtgt = lam((W + nk + cbpg + ttdb + bvmt) * so(p.gtgt) / 100)
    return { tri, W, nk, cbpg, ttdb, bvmt, gtgt, tong: nk + cbpg + ttdb + bvmt + gtgt }
  })
  const t = { nk: 0, vat: 0, khac: 0, tong: 0 }
  dong.forEach((d) => { t.nk += d.nk; t.vat += d.gtgt; t.khac += d.cbpg + d.ttdb + d.bvmt; t.tong += d.tong })
  return { dong, tong: t }
}

export function tinhXNK(st, loai) {
  const th = tinhThue(st)
  const thue = th.tong
  const tienHang = th.dong.reduce((a, d) => a + d.W, 0)
  const muaBan = loai === 'mua_ban'
  const phiMua = muaBan ? lam(tienHang * so(st.phiMuaPct) / 100) : 0

  const phiTach = lam(so(st.phiTach))
  const vnDong = [lam(so(st.shipKho)), lam(so(st.tauSl) * so(st.tauDg)), lam(so(st.pallet)), lam(so(st.hoanGt) * so(st.hoanPct) / 100), lam(so(st.khacVN))]
  const tqDong = [lam(so(st.tq1Sl) * so(st.tq1Dg)), lam(so(st.tq2Sl) * so(st.tq2Dg)), lam(so(st.tq3Sl) * so(st.tq3Dg))]
  const vn = vnDong.reduce((a, b) => a + b, 0)
  const tq = tqDong.reduce((a, b) => a + b, 0)
  const vatDV = so(st.vatDV)

  const kich = (sl, dg, chot) => {
    const cuoc = lam(sl * dg)
    const tongCP = cuoc + phiTach + phiMua + vn + tq
    const vat = lam(tongCP * vatDV / 100)
    const hoaDon = tongCP + vat
    const phaiTra = hoaDon + thue.tong + (muaBan ? tienHang : 0)
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
    thue, tienHang, phiMua, phiTach, vnDong, tqDong, vn, tq,
    kg: kich(so(st.kg), so(st.dgKg), st.chotKg),
    m3: kich(so(st.m3), so(st.dgM3), st.chotM3),
  }
}

// Khung bảng báo giá (dùng chung cho màn hình và file Excel).
// sl / dg: số (hiện chữ), hoặc {k, tp} = ô nhập gắn với st[k] (tp = cho phép số lẻ), hoặc {fix:số}.
export function khungXNK(st, kq, loai) {
  const muaBan = loai === 'mua_ban'
  const o = muaBan ? 1 : 0
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
  dong({ stt: '1', nd: 'Phí tách tờ khai', dvt: 'TK', sl: 1, dg: dongTien('phiTach'), t: chung(kq.phiTach) })
  if (muaBan) dong({ stt: '2', nd: 'Phí mua hàng (% × tiền hàng)', pct: { k: 'phiMuaPct' }, dvt: 'Lô', sl: 1, dg: kq.phiMua, t: chung(kq.phiMua) })
  nhom(n(2), 'Các khoản tiền thuế', kq.thue.tong, kq.thue.tong)
  dong({ stt: n(2) + '.1', nd: 'Thuế nhập khẩu', dvt: 'Lô', sl: 1, dg: kq.thue.nk, t: chung(kq.thue.nk), sub: 1 })
  dong({ stt: n(2) + '.2', nd: 'Thuế VAT', dvt: 'Lô', sl: 1, dg: kq.thue.vat, t: chung(kq.thue.vat), sub: 1 })
  dong({ stt: n(2) + '.3', nd: 'Thuế khác (CBPG, TTDB, BVMT)', dvt: 'Lô', sl: 1, dg: kq.thue.khac, t: chung(kq.thue.khac), sub: 1 })
  nhom(n(3), 'Các chi phí nội địa Việt Nam', kq.vn, kq.vn)
  dong({ stt: n(3) + '.1', nd: 'Phí ship kho VN đến khách hàng', dvt: 'Lô', sl: 1, dg: dongTien('shipKho'), t: chung(kq.vnDong[0]), sub: 1 })
  dong({ stt: n(3) + '.2', nd: 'Phí gửi tàu', dvt: 'M3', sl: { k: 'tauSl', tp: 1 }, dg: dongTien('tauDg'), t: chung(kq.vnDong[1]), sub: 1 })
  dong({ stt: n(3) + '.3', nd: 'Phí nâng hạ pallet cửa khẩu', dvt: 'Lô', sl: 1, dg: dongTien('pallet'), t: chung(kq.vnDong[2]), sub: 1 })
  dong({ stt: n(3) + '.4', nd: 'Phí hoàn tiền hợp đồng ngoại (SL = trị giá hợp đồng, đơn giá = tỉ lệ %)', dvt: 'HĐ', sl: dongTien('hoanGt'), dg: { k: 'hoanPct', tp: 1, pct: 1 }, t: chung(kq.vnDong[3]), sub: 1 })
  dong({ stt: n(3) + '.5', nd: 'Phí khác tại Việt Nam', dvt: 'Lô', sl: 1, dg: dongTien('khacVN'), t: chung(kq.vnDong[4]), sub: 1 })
  nhom(n(4), 'Các chi phí nội địa Trung Quốc (SL = số tệ, đơn giá = tỷ giá)', kq.tq, kq.tq)
  dong({ stt: n(4) + '.1', nd: 'Ứng / kéo / hạ hàng / cân TQ', dvt: 'Tệ', sl: { k: 'tq1Sl', tp: 1 }, dg: { k: 'tq1Dg' }, t: chung(kq.tqDong[0]), sub: 1 })
  dong({ stt: n(4) + '.2', nd: 'Phí kiểm dịch TQ', dvt: 'Tệ', sl: { k: 'tq2Sl', tp: 1 }, dg: { k: 'tq2Dg' }, t: chung(kq.tqDong[1]), sub: 1 })
  dong({ stt: n(4) + '.3', nd: 'Phí khác tại TQ', dvt: 'Tệ', sl: { k: 'tq3Sl', tp: 1 }, dg: { k: 'tq3Dg' }, t: chung(kq.tqDong[2]), sub: 1 })
  R.push({ loai: 'tong', stt: 'III', nd: 'Tổng chi phí xuất nhập khẩu', t: { kg: kq.kg.tongCP, m3: kq.m3.tongCP } })
  R.push({ loai: 'tong', stt: 'IV', nd: loai === 'uy_thac' ? 'Thuế VAT phí dịch vụ uỷ thác' : 'Thuế VAT phí dịch vụ', pct: { k: 'vatDV' }, t: { kg: kq.kg.vat, m3: kq.m3.vat } })
  R.push({ loai: 'tong', stt: 'V', nd: 'Tổng tiền hoá đơn dịch vụ', t: { kg: kq.kg.hoaDon, m3: kq.m3.hoaDon } })
  if (muaBan) R.push({ loai: 'tong', stt: '', nd: 'Tiền hàng khách mua qua CTS', t: chung(kq.tienHang) })
  R.push({ loai: 'tong', stt: 'VI', nd: 'Tổng tiền thuế nộp hộ khách', t: chung(kq.thue.tong) })
  R.push({ loai: 'tong', stt: 'VII', nd: 'Tổng tiền phải thanh toán cho CTS', t: { kg: kq.kg.phaiTra, m3: kq.m3.phaiTra }, lon: 1 })
  R.push({ loai: 'tong', stt: '', nd: 'Giá trung bình (đ / KG và đ / M3)', t: { kg: kq.kg.giaTB, m3: kq.m3.giaTB }, nhat: 1 })
  return R
}

export const TEN_DV = { mua_ban: 'MUA BÁN', van_chuyen: 'VẬN CHUYỂN', uy_thac: 'UỶ THÁC XUẤT NHẬP KHẨU' }

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
