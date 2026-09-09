// ============================================================
// Công thức tính giá bán / lợi nhuận trên Shopee
// Điểm mấu chốt: phí sàn tính trên GIÁ SAU GIẢM (số tiền khách trả
// cho sản phẩm), không phải giá niêm yết. Ngày khuyến mãi giá sau
// giảm tụt xuống nhưng giá vốn giữ nguyên, nên biên lợi nhuận mỏng đi.
// ============================================================

export const so = (v) => Number(String(v ?? '').replace(/[^\d.-]/g, '')) || 0

/**
 * @param {object} d
 *  giaNiemYet     Giá gốc trên sàn
 *  giamGiaPct     % giảm của chương trình khuyến mãi
 *  voucherShop    Mã giảm của shop (số tiền)
 *  giaVon, dongGoi, chiPhiKhac   Chi phí thật (số tiền)
 *  phiCoDinhPct   % phí cố định theo ngành hàng
 *  phiXuLyPct     % phí xử lý giao dịch
 *  phiHaTang      Số tiền cố định mỗi đơn
 *  voucherXtra    bool — tham gia gói Voucher Xtra
 *  vxPct, vxCap   % và mức trần Voucher Xtra
 *  maUuDai        Giá trị mã ưu đãi Shopee áp lên sản phẩm (số tiền)
 *  dtdPct, dtdCap % shop đồng tài trợ và mức trần
 *  freeshipXtra   bool
 *  fsPct          % Freeship Xtra
 *  affiliatePct   % hoa hồng tiếp thị liên kết
 *  quangCaoPct    % ngân sách quảng cáo trên doanh thu
 *  coThue         bool — trừ thuế
 *  thuePct        % thuế trên doanh thu
 */
export function tinhToan(d) {
  const giaNiemYet = so(d.giaNiemYet)
  const giamGia = (giaNiemYet * so(d.giamGiaPct)) / 100
  const voucherShop = so(d.voucherShop)

  // Số tiền khách thực trả cho sản phẩm — mọi phí % tính trên số này
  const giaSauGiam = Math.max(giaNiemYet - giamGia - voucherShop, 0)

  const giaVon = so(d.giaVon)
  const dongGoi = so(d.dongGoi)
  const chiPhiKhac = so(d.chiPhiKhac)
  const chiPhiThat = giaVon + dongGoi + chiPhiKhac

  const phiCoDinh = (giaSauGiam * so(d.phiCoDinhPct)) / 100
  const phiXuLy = (giaSauGiam * so(d.phiXuLyPct)) / 100
  const phiHaTang = so(d.phiHaTang)

  // Voucher Xtra và Đồng tài trợ loại trừ nhau: tham gia gói này thì
  // không áp dụng chính sách kia
  let phiVoucherXtra = 0
  let phiDongTaiTro = 0
  if (d.voucherXtra) {
    phiVoucherXtra = Math.min((giaSauGiam * so(d.vxPct)) / 100, so(d.vxCap))
  } else {
    const maUuDai = so(d.maUuDai)
    phiDongTaiTro = Math.min((maUuDai * so(d.dtdPct)) / 100, so(d.dtdCap))
  }

  const phiFreeship = d.freeshipXtra ? (giaSauGiam * so(d.fsPct)) / 100 : 0
  const phiAffiliate = (giaSauGiam * so(d.affiliatePct)) / 100
  const phiQuangCao = (giaSauGiam * so(d.quangCaoPct)) / 100
  const thue = d.coThue ? (giaSauGiam * so(d.thuePct)) / 100 : 0

  const tongPhi = phiCoDinh + phiXuLy + phiHaTang + phiVoucherXtra
    + phiDongTaiTro + phiFreeship + phiAffiliate + phiQuangCao + thue

  const loiNhuan = giaSauGiam - chiPhiThat - tongPhi
  const bien = giaSauGiam > 0 ? (loiNhuan / giaSauGiam) * 100 : 0
  const tyLeVon = giaVon > 0 ? (loiNhuan / giaVon) * 100 : 0

  return {
    giaNiemYet, giamGia, voucherShop, giaSauGiam,
    giaVon, dongGoi, chiPhiKhac, chiPhiThat,
    phiCoDinh, phiXuLy, phiHaTang, phiVoucherXtra, phiDongTaiTro,
    phiFreeship, phiAffiliate, phiQuangCao, thue,
    tongPhi, loiNhuan, bien, tyLeVon,
  }
}

/**
 * Tìm giá niêm yết để đạt biên lợi nhuận mong muốn.
 * Do có phí trần (Voucher Xtra, Đồng tài trợ) và phí cố định theo đơn
 * (phí hạ tầng), quan hệ giá và lợi nhuận không còn tuyến tính,
 * nên dò nhị phân thay vì giải công thức.
 */
export function timGiaBan(d, bienMongMuon) {
  const muc = Number(bienMongMuon) || 0
  let thap = 0
  let cao = Math.max(so(d.giaVon), 10000) * 200 + 10_000_000

  for (let i = 0; i < 60; i++) {
    const giua = (thap + cao) / 2
    const r = tinhToan({ ...d, giaNiemYet: giua })
    if (r.bien < muc) thap = giua
    else cao = giua
  }
  // Làm tròn lên bội số 1.000 cho gọn giá
  return Math.ceil(cao / 1000) * 1000
}

// Giá niêm yết để hoà vốn (lợi nhuận bằng 0)
export function timGiaHoaVon(d) {
  return timGiaBan(d, 0)
}
