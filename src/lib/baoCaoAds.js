import { congThang, soNgayGiua, laHopDongAds, homNayLocal } from './taiKy'

// Sau khi ký hợp đồng chạy ADS: cứ 2 tuần phải báo cáo chỉ số cho khách 1 lần.
// Lần báo cáo kế tiếp = lần báo cáo gần nhất + 14 ngày (chưa báo cáo lần nào thì tính từ ngày ký).
// Chỉ nhắc trong thời gian dịch vụ còn hiệu lực (kể cả các lần tái ký).

export const CHU_KY_BAO_CAO = 14          // ngày
export const SO_NGAY_BAO_TRUOC = 2        // nhắc trước hạn bao nhiêu ngày

export function congNgay(ymd, n) {
  const [y, m, d] = String(ymd).slice(0, 10).split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + n))
  const pad = (x) => String(x).padStart(2, '0')
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`
}

// Hạn dịch vụ hiện tại + mốc bắt đầu "liên tục": tái ký kịp thời thì chu kỳ báo cáo đi tiếp;
// tái ký trễ (sau khi hết hạn) thì dịch vụ chạy lại từ ngày chốt đơn và chu kỳ báo cáo tính lại từ đó.
function kyDichVu(hd, don = []) {
  let han = String(hd.ngay_het_han).slice(0, 10)
  let batDau = String(hd.ngay_ky).slice(0, 10)
  const ds = don
    .filter((o) => o.tai_ky_hop_dong_id === hd.id && o.trang_thai !== 'huy' && o.ngay_chot)
    .sort((a, b) => String(a.ngay_chot).localeCompare(String(b.ngay_chot)))
  for (const o of ds) {
    const ngayChot = String(o.ngay_chot).slice(0, 10)
    if (ngayChot > han) batDau = ngayChot
    han = congThang(ngayChot > han ? ngayChot : han, Number(o.so_thang) || 1)
  }
  return { han, batDau }
}

// Thông tin báo cáo kế tiếp của 1 hợp đồng (dùng cả ở tab Hợp đồng của khách). null nếu không áp dụng.
export function baoCaoKeTiep(hd, don = [], baoCao = [], items = [], homNay = homNayLocal()) {
  if (!hd || hd.trang_thai !== 'hieu_luc' || !hd.ngay_ky || !hd.ngay_het_han) return null
  if (!laHopDongAds(hd, items)) return null
  const { han, batDau } = kyDichVu(hd, don)
  const cua = baoCao.filter((b) => b.contract_id === hd.id && b.ngay_bao_cao)
  const lanCuoi = cua.reduce((m, b) => (String(b.ngay_bao_cao).slice(0, 10) > m ? String(b.ngay_bao_cao).slice(0, 10) : m), '')
  const goc = lanCuoi > batDau ? lanCuoi : batDau
  const ngayDenHan = congNgay(goc, CHU_KY_BAO_CAO)
  return {
    han, lanCuoi: lanCuoi || null, soLanDaBao: cua.length, lanThu: cua.length + 1,
    ngayDenHan,
    conLai: soNgayGiua(homNay, ngayDenHan),
    // còn cần báo cáo nữa không: lần kế tiếp phải nằm trong thời gian dịch vụ và dịch vụ chưa kết thúc
    canBaoCao: ngayDenHan <= han && homNay <= han,
  }
}

// Danh sách hợp đồng ADS đến hạn / trễ / sắp đến hạn báo cáo, gấp nhất lên đầu
export function danhSachNhacBaoCao({ hopDong = [], don = [], items = [], baoCao = [], homNay = homNayLocal(), soNgayTruoc = SO_NGAY_BAO_TRUOC }) {
  const donTheoId = new Map(don.map((o) => [o.id, o]))
  const itemTheoDon = new Map()
  for (const it of items) {
    if (!itemTheoDon.has(it.order_id)) itemTheoDon.set(it.order_id, [])
    itemTheoDon.get(it.order_id).push(it)
  }
  const kq = []
  for (const hd of hopDong) {
    const k = baoCaoKeTiep(hd, don, baoCao, itemTheoDon.get(hd.order_id) || [], homNay)
    if (!k || !k.canBaoCao || k.conLai > soNgayTruoc) continue
    kq.push({ hd, ...k, donGoc: donTheoId.get(hd.order_id), muc: k.conLai < 0 ? 'qua_han' : k.conLai === 0 ? 'hom_nay' : 'sap_toi' })
  }
  return kq.sort((a, b) => a.conLai - b.conLai)
}

export function moTaHanBaoCao(conLai) {
  if (conLai < 0) return `Trễ ${-conLai} ngày`
  if (conLai === 0) return 'Đến hạn hôm nay'
  return `Còn ${conLai} ngày`
}
