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
 *  piship, pishipPhi   Gói tiết kiệm vận chuyển PiShip (số tiền mỗi đơn)
 *  nguoiBanMoi    bool — áp ưu đãi phí cố định cho người bán mới
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

  // Ưu đãi người bán mới (01/06–31/08/2026).
  // Ưu tiên mức Shopee công bố sẵn cho từng ngành; nếu không có thì suy ra:
  //   ngành phí < 6%  -> giảm một nửa
  //   ngành phí >= 6% -> giảm 3 điểm phần trăm
  const phiCoDinhGoc = so(d.phiCoDinhPct)
  const phiUuDaiCongBo = d.phiNguoiBanMoi === '' || d.phiNguoiBanMoi === null || d.phiNguoiBanMoi === undefined
    ? null : Number(d.phiNguoiBanMoi)
  const phiCoDinhPct = d.nguoiBanMoi
    ? (phiUuDaiCongBo !== null
        ? phiUuDaiCongBo
        : (phiCoDinhGoc < 6 ? phiCoDinhGoc / 2 : Math.max(phiCoDinhGoc - 3, 0)))
    : phiCoDinhGoc

  const phiCoDinh = (giaSauGiam * phiCoDinhPct) / 100
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
  const phiPiShip = d.piship ? so(d.pishipPhi) : 0
  const phiAffiliate = (giaSauGiam * so(d.affiliatePct)) / 100
  const phiQuangCao = (giaSauGiam * so(d.quangCaoPct)) / 100
  const thue = d.coThue ? (giaSauGiam * so(d.thuePct)) / 100 : 0

  const tongPhi = phiCoDinh + phiXuLy + phiHaTang + phiVoucherXtra
    + phiDongTaiTro + phiFreeship + phiPiShip + phiAffiliate + phiQuangCao + thue

  const loiNhuan = giaSauGiam - chiPhiThat - tongPhi
  const bien = giaSauGiam > 0 ? (loiNhuan / giaSauGiam) * 100 : 0
  const tyLeVon = giaVon > 0 ? (loiNhuan / giaVon) * 100 : 0

  return {
    giaNiemYet, giamGia, voucherShop, giaSauGiam,
    giaVon, dongGoi, chiPhiKhac, chiPhiThat,
    phiCoDinhGoc, phiCoDinhPct, phiCoDinh, phiXuLy, phiHaTang,
    phiVoucherXtra, phiDongTaiTro, phiFreeship, phiPiShip,
    phiAffiliate, phiQuangCao, thue,
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

// Giá niêm yết để đạt lợi nhuận mục tiêu tính bằng TIỀN mỗi đơn
export function timGiaTheoTien(d, tienMuc) {
  const muc = Number(tienMuc) || 0
  let thap = 0
  let cao = Math.max(so(d.giaVon), 10000) * 200 + 10_000_000 + muc * 50
  for (let i = 0; i < 60; i++) {
    const giua = (thap + cao) / 2
    const r = tinhToan({ ...d, giaNiemYet: giua })
    if (r.loiNhuan < muc) thap = giua
    else cao = giua
  }
  return Math.ceil(cao / 1000) * 1000
}

// Gom dữ liệu nhập + tham số phí sàn thành đầu vào cho tinhToan
export function gomDuLieu(f, cfg) {
  // Đóng gói, nhân công nhập theo % thì quy ra tiền: % trên giá vốn
  const dongGoi = f.dongGoiKieu === 'pct' ? Math.round((so(f.giaVon) * so(f.dongGoiPct)) / 100) : f.dongGoi
  return {
    ...f,
    dongGoi,
    phiXuLyPct: cfg?.phi_xu_ly ?? 6,
    phiHaTang: cfg?.phi_ha_tang ?? 3000,
    vxPct: cfg?.voucher_xtra_pct ?? 4,
    vxCap: cfg?.voucher_xtra_cap ?? 50000,
    fsPct: cfg?.freeship_xtra_pct ?? 6,
    dtdPct: cfg?.dong_tai_tro_pct ?? 30,
    dtdCap: cfg?.dong_tai_tro_cap ?? 50000,
    thuePct: cfg?.thue_pct ?? 1.5,
    pishipPhi: cfg?.piship_phi ?? 2700,
  }
}

export const CACH_TINH = {
  loi_nhuan: 'Theo mục tiêu lợi nhuận',
  gia_ban: 'Theo giá bán cạnh tranh',
}

/**
 * Tính một sản phẩm theo 1 trong 3 cách định giá.
 * sp = { cheDo, kieu ('pct'|'tien'), f: {...} }
 */
export function tinhSanPham(sp, cfg) {
  const d = gomDuLieu(sp.f, cfg)
  const chiPhiThat = so(d.giaVon) + so(d.dongGoi) + so(d.chiPhiKhac)
  let gia = 0
  if (chiPhiThat > 0) {
    if (sp.cheDo === 'gia_ban') gia = so(d.giaNiemYet)
    else if (sp.kieu === 'tien') gia = timGiaTheoTien(d, so(d.loiTien))
    else gia = timGiaBan(d, so(d.bienMongMuon))
  }
  const dd = { ...d, giaNiemYet: gia }
  const kq = tinhToan(dd)
  const chuaDu = chiPhiThat <= 0 || kq.giaSauGiam <= 0
  const hoaVon = chuaDu ? 0 : timGiaHoaVon(d)
  const khongSale = tinhToan({ ...dd, giamGiaPct: 0, voucherShop: 0 })
  return { d: dd, kq, chuaDu, lo: !chuaDu && kq.loiNhuan < 0, hoaVon, khongSale, gia }
}

// Các dòng của bảng dòng tiền (dùng chung cho màn hình và file Excel)
export function dongTien(kq, d) {
  const r = []
  const them = (nhan, tien, loai = '') => r.push({ nhan, tien, loai })
  them('Giá niêm yết', kq.giaNiemYet, 'dam')
  if (kq.giamGia > 0) them(`Giảm giá chương trình (${so(d.giamGiaPct)}%)`, -kq.giamGia)
  if (kq.voucherShop > 0) them('Mã giảm của shop', -kq.voucherShop)
  them('Khách thực trả', kq.giaSauGiam, 'dam')
  them('Giá vốn', -kq.giaVon)
  if (kq.dongGoi > 0) them('Đóng gói, nhân công', -kq.dongGoi)
  if (kq.chiPhiKhac > 0) them('Chi phí khác', -kq.chiPhiKhac)
  them(`Phí cố định (${kq.phiCoDinhPct}%)`, -kq.phiCoDinh)
  them(`Phí xử lý giao dịch (${d.phiXuLyPct}%)`, -kq.phiXuLy)
  them('Phí hạ tầng', -kq.phiHaTang)
  if (kq.phiVoucherXtra > 0) them('Voucher Xtra', -kq.phiVoucherXtra)
  if (kq.phiDongTaiTro > 0) them('Đồng tài trợ mã ưu đãi', -kq.phiDongTaiTro)
  if (kq.phiFreeship > 0) them('Freeship Xtra', -kq.phiFreeship)
  if (kq.phiPiShip > 0) them('Gói PiShip', -kq.phiPiShip)
  if (kq.phiAffiliate > 0) them(`Tiếp thị liên kết (${so(d.affiliatePct)}%)`, -kq.phiAffiliate)
  if (kq.phiQuangCao > 0) them(`Quảng cáo (${so(d.quangCaoPct)}%)`, -kq.phiQuangCao)
  if (kq.thue > 0) them(`Thuế (${d.thuePct}%)`, -kq.thue)
  them('Lợi nhuận còn lại', kq.loiNhuan, 'tong')
  return r
}
