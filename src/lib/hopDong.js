import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle,
} from 'docx'
import { docTienThanhChu } from './docSo'
import { BEN_B_MAC_DINH } from './benBMacDinh'

const FONT = 'Times New Roman'
const dinhDang = (n) => new Intl.NumberFormat('vi-VN').format(Math.round(Number(n) || 0))

const T = (text, o = {}) => new TextRun({ text, font: FONT, size: o.size || 24, bold: o.bold, italics: o.italics, ...o })
const P = (children, o = {}) => new Paragraph({
  children: Array.isArray(children) ? children : [children],
  alignment: o.align || AlignmentType.JUSTIFIED, spacing: { after: o.after ?? 120, line: 300 }, ...o,
})
const dong = (nhan, giaTri, o = {}) => P([T(nhan, { bold: o.bold }), T(giaTri || '.....................................')])

// ===== Thông tin Bên A / Bên B: dòng nào không có giá trị thì KHÔNG hiện trong hợp đồng =====
const coGiaTri = (v) => !!(v && String(v).trim())
const dongNeuCo = (nhan, giaTri) => coGiaTri(giaTri) ? [P(T(`${nhan}: ${String(giaTri).trim()}`))] : []
const tieuDeBen = (tieuDe, ten) => coGiaTri(ten) ? `${tieuDe} ${String(ten).trim().toUpperCase()}` : tieuDe

function khoiBenA(hd) {
  const daiDien = []
  if (coGiaTri(hd.nguoi_dai_dien)) daiDien.push(`Đại diện: ${String(hd.nguoi_dai_dien).trim()}`)
  if (coGiaTri(hd.chuc_vu)) daiDien.push(`Chức vụ: ${String(hd.chuc_vu).trim()}`)
  return [
    ...(daiDien.length ? [P(T(daiDien.join('  –  ')))] : []),
    ...dongNeuCo('Địa chỉ', hd.dia_chi),
    ...dongNeuCo('MST', hd.mst),
    ...dongNeuCo('SĐT', hd.sdt),
    ...dongNeuCo('Số tài khoản', hd.so_tai_khoan),
  ]
}

function khoiBenB(b) {
  const nhanDD = coGiaTri(b.giay_uy_quyen) ? 'Đại diện ký kết (Người được ủy quyền)' : 'Đại diện'
  const daiDien = []
  if (coGiaTri(b.dai_dien)) daiDien.push(`${nhanDD}: ${String(b.dai_dien).trim()}`)
  if (coGiaTri(b.chuc_vu)) daiDien.push(`Chức vụ: ${String(b.chuc_vu).trim()}`)
  return [
    ...(daiDien.length ? [P(T(daiDien.join('  –  ')))] : []),
    ...(coGiaTri(b.giay_uy_quyen) ? [P(T(`(Theo Giấy ủy quyền số: ${String(b.giay_uy_quyen).trim()})`))] : []),
    ...dongNeuCo('Địa chỉ', b.dia_chi),
    ...dongNeuCo('MST', b.mst),
    ...dongNeuCo('SĐT', b.sdt),
    ...dongNeuCo('Chủ tài khoản', b.chu_tai_khoan),
    ...dongNeuCo('Số tài khoản', b.so_tai_khoan),
    ...dongNeuCo('Ngân hàng', b.ngan_hang),
  ]
}

// Tên người ký bên B (bỏ phần "(Ông)/(Bà)" nếu có), in hoa
const tenKyBenB = (b) => String(b.dai_dien || '').replace(/^\(.*?\)\s*/, '').toUpperCase()

function bangNoiDung(rows, headers = ['NỘI DUNG TRIỂN KHAI', 'CHI TIẾT']) {
  const dem = { top: 100, bottom: 100, left: 120, right: 120 }
  const cell = (text, opt = {}) => new TableCell({
    width: { size: opt.w || 50, type: WidthType.PERCENTAGE },
    margins: dem,
    // text có thể là 1 chuỗi (tiêu đề cột) hoặc mảng nhiều ý — mỗi ý xuống 1 dòng riêng cho dễ đọc
    children: Array.isArray(text)
      ? text.map((t, i) => P(T(t, { bold: opt.bold, size: 22 }), { align: opt.align || AlignmentType.LEFT, after: i === text.length - 1 ? 40 : 60 }))
      : [P(T(text, { bold: opt.bold, size: 22 }), { align: opt.align || AlignmentType.LEFT, after: 40 })],
    shading: opt.header ? { fill: 'D9E2F3' } : undefined,
  })
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: [cell(headers[0], { header: true, bold: true, w: 40, align: AlignmentType.CENTER }), cell(headers[1], { header: true, bold: true, w: 60, align: AlignmentType.CENTER })] }),
      ...rows.map((r) => new TableRow({ children: [
        cell(r[0], { w: 40 }),
        cell(String(r[1] || '').split(';').map((s) => s.trim()).filter(Boolean), { w: 60 }),
      ] })),
    ],
  })
}

// Ô thông tin đóng khung (Bên A / Bên B kiểu Seller) — mỗi phần tử là 1 chuỗi (chiếm
// trọn hàng) hoặc mảng 2 chuỗi (chia 2 cột, dùng cho hàng "Đại diện | Chức vụ")
// Bảng "Giá trị hợp đồng" kiểu hoá đơn: 1 dòng dịch vụ, dòng thuế GTGT, dòng tổng, dòng bằng chữ
function bangGiaTri(tenDichVu, tong) {
  const gia = Math.round(tong / 1.08)   // giá trước VAT
  const vat = tong - gia
  const dem = { top: 100, bottom: 100, left: 120, right: 120 }
  const o = (children, opt = {}) => new TableCell({
    columnSpan: opt.span, margins: dem,
    width: opt.w ? { size: opt.w, type: WidthType.PERCENTAGE } : undefined,
    children: [P(Array.isArray(children) ? children : T(children, { bold: opt.bold, italics: opt.italics, size: 22 }),
      { align: opt.align || AlignmentType.LEFT, after: 0 })],
    shading: opt.header ? { fill: 'D9E2F3' } : undefined,
  })
  const hang = (cells) => new TableRow({ children: cells })
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      hang([
        o('STT', { header: true, bold: true, align: AlignmentType.CENTER, w: 6 }),
        o('Tên dịch vụ', { header: true, bold: true, align: AlignmentType.CENTER, w: 34 }),
        o('ĐVT', { header: true, bold: true, align: AlignmentType.CENTER, w: 8 }),
        o('Số lượng', { header: true, bold: true, align: AlignmentType.CENTER, w: 12 }),
        o('Đơn giá (VNĐ)', { header: true, bold: true, align: AlignmentType.CENTER, w: 20 }),
        o('Thành tiền (VNĐ)', { header: true, bold: true, align: AlignmentType.CENTER, w: 20 }),
      ]),
      hang([
        o('1', { align: AlignmentType.CENTER }),
        o(tenDichVu || 'Dịch vụ'),
        o('Gói', { align: AlignmentType.CENTER }),
        o('1', { align: AlignmentType.CENTER }),
        o(dinhDang(gia), { align: AlignmentType.RIGHT }),
        o(dinhDang(gia), { align: AlignmentType.RIGHT }),
      ]),
      hang([o('Thuế GTGT (8%)', { span: 5, bold: true }), o(dinhDang(vat), { bold: true, align: AlignmentType.RIGHT })]),
      hang([o('Tổng giá trị hợp đồng', { span: 5, bold: true }), o(dinhDang(tong), { bold: true, align: AlignmentType.RIGHT })]),
      hang([o(`Số tiền bằng chữ: ${docTienThanhChu(tong)}.`, { span: 6, italics: true, align: AlignmentType.CENTER })]),
    ],
  })
}

const canCu = () => [
  P(T('- Căn cứ vào Bộ luật Dân sự số 91/2015/QH13 của nước Cộng hòa Xã hội Chủ nghĩa Việt Nam, có hiệu lực kể từ ngày 01/01/2017 và các văn bản hướng dẫn thi hành.', { size: 22, italics: true })),
  P(T('- Căn cứ vào Luật Thương mại số 36/2005/QH11 của nước Cộng hoà Xã hội Chủ nghĩa Việt nam, có hiệu lực từ ngày 01/01/2006.', { size: 22, italics: true })),
  P(T('- Căn cứ vào Luật công nghệ thông tin số 67/2006/QH11 của nước Cộng hòa xã hội chủ nghĩa Việt Nam, có hiệu lực từ ngày 01/01/2007.', { size: 22, italics: true })),
  P(T('- Căn cứ vào khả năng và nhu cầu các bên trong Hợp đồng.', { size: 22, italics: true }), { after: 200 }),
]

const kyTen = (tenA, tenB) => new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
  rows: [
    new TableRow({ children: [
      new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: [P(T('ĐẠI DIỆN BÊN A', { bold: true }), { align: AlignmentType.CENTER, after: 40 }), P(T('(Ký, ghi rõ họ tên)', { italics: true, size: 20 }), { align: AlignmentType.CENTER }), ...(tenA ? [P(T(''), { after: 400 }), P(T(tenA, { bold: true }), { align: AlignmentType.CENTER })] : [])] }),
      new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: [P(T('ĐẠI DIỆN BÊN B', { bold: true }), { align: AlignmentType.CENTER, after: 40 }), P(T('(Ký, ghi rõ họ tên)', { italics: true, size: 20 }), { align: AlignmentType.CENTER }), ...(tenB ? [P(T(''), { after: 400 }), P(T(tenB, { bold: true }), { align: AlignmentType.CENTER })] : [])] }),
    ] }),
  ],
})

function ngayVN(d) {
  const x = d ? new Date(d) : new Date()
  return `Hà Nội, ngày ${x.getDate()} tháng ${x.getMonth() + 1} năm ${x.getFullYear()}`
}

// Ngày thanh toán khi gia hạn = cùng ngày ký của tháng kế tiếp, lặp lại hàng tháng -> chỉ cần lấy số ngày trong ngày ký
function ngayThanhToanHangThang(ngayKy) {
  const n = parseInt(String(ngayKy || '').slice(8, 10), 10)
  return n >= 1 && n <= 31 ? String(n) : '...'
}

// ===== Đầu trang: bên trái tên công ty (gạch ngắn dưới), bên phải Quốc hiệu - Tiêu ngữ (gạch dưới) + ngày tháng =====
// Tách "CÔNG TY TNHH TUKI ADS" thành 2 dòng: "CÔNG TY TNHH" / "TUKI ADS"
function tachTenCongTy(ten) {
  const s = String(ten || '').trim().toUpperCase()
  const m = s.match(/^(CÔNG TY (?:TNHH|CỔ PHẦN|TRÁCH NHIỆM HỮU HẠN))\s+(.+)$/)
  return m ? [m[1], m[2]] : [s, '']
}

// Đường kẻ ngắn nằm giữa ô (dùng viền dưới của 1 đoạn trống, thụt 2 bên để đường kẻ chỉ dài vừa phải)
const duongKe = (thut) => P(T('', { size: 4 }), {
  align: AlignmentType.CENTER, after: 0,
  indent: { left: thut, right: thut },
  border: { bottom: { style: BorderStyle.SINGLE, size: 6, space: 1, color: '000000' } },
})

function dauTrang(tenCongTy, ngayKy) {
  const [d1, d2] = tachTenCongTy(tenCongTy)
  const KHONG = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
  const khongVien = { top: KHONG, bottom: KHONG, left: KHONG, right: KHONG }
  const RONG_TRAI = 3810, RONG_PHAI = 5261   // tổng 9071 twips = bề rộng vùng chữ (A4, lề trái 3cm, phải 2cm)
  const giua = (text, o = {}) => P(T(text, { bold: true, size: 22, ...o }), { align: AlignmentType.CENTER, after: 0 })
  return [
    new Table({
      width: { size: RONG_TRAI + RONG_PHAI, type: WidthType.DXA },
      columnWidths: [RONG_TRAI, RONG_PHAI],
      borders: { ...khongVien, insideHorizontal: KHONG, insideVertical: KHONG },
      rows: [new TableRow({ children: [
        new TableCell({
          width: { size: RONG_TRAI, type: WidthType.DXA }, borders: khongVien,
          children: [giua(d1), ...(d2 ? [giua(d2)] : []), duongKe(1150)],
        }),
        new TableCell({
          width: { size: RONG_PHAI, type: WidthType.DXA }, borders: khongVien,
          children: [
            giua('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM'),
            giua('Độc lập – Tự do – Hạnh phúc'),
            duongKe(1150),
            P(T('', { size: 12 }), { after: 0 }),
            P(T(ngayVN(ngayKy), { italics: true }), { align: AlignmentType.CENTER, after: 0 }),
          ],
        }),
      ] })],
    }),
    P(T(''), { after: 120 }),
  ]
}

// ---------------- HỢP ĐỒNG QUẢNG CÁO ----------------
function hopDongAds(hd) {
  const b = { ...BEN_B_MAC_DINH.ads, ...(hd.ben_b || {}) }
  const tong = Math.round(Number(hd.gia_tri) || 0)   // giá trị đơn đã bao gồm VAT
  const giaTri = Math.round(tong / 1.08)              // tách ngược ra giá trước VAT để hiển thị
  const vat = tong - giaTri
  const noiDung = hd.rows_noi_dung || []
  const soSP = hd.so_san_pham || 30

  return [
    ...dauTrang(b.ten, hd.ngay_ky),

    P(T('HỢP ĐỒNG CUNG CẤP DỊCH VỤ THƯƠNG MẠI ĐIỆN TỬ', { bold: true, size: 32 }), { align: AlignmentType.CENTER, after: 60 }),
    P(T(`Số: ${hd.so_hop_dong}`, { bold: true }), { align: AlignmentType.CENTER, after: 200 }),

    ...canCu(),

    P(T(`Hôm nay, ${ngayVN(hd.ngay_ky).replace('Hà Nội, ', '')}, các bên gồm:`), { after: 160 }),

    P(T(tieuDeBen('I. BÊN SỬ DỤNG DỊCH VỤ (BÊN A):', hd.ten_tieu_de_bena), { bold: true })),
    ...khoiBenA(hd),
    P(T(''), { after: 60 }),

    P(T(`II. BÊN CUNG CẤP (BÊN B): ${b.ten}`, { bold: true })),
    ...khoiBenB(b),
    P(T(''), { after: 60 }),

    P(T('Sau khi thảo luận, hai bên thống nhất ký Hợp đồng cung ứng dịch vụ Chạy Quảng cáo gian hàng Shopee với các điều khoản sau:'), { after: 160 }),

    P(T('ĐIỀU 1: NỘI DUNG HỢP ĐỒNG', { bold: true }), { before: 240 }),
    P(T('Bên B cung cấp Gói dịch vụ SHOPEE ADS (Chạy quảng cáo gian hàng Shopee) cho bên A với những nội dung sau:')),
    dong('- Link shopee (tên shop): ', hd.link_shop),
    dong('- Tổng số lượng gian hàng: ', String(hd.so_luong_gian_hang || 1)),
    ...(noiDung.length ? [P(T('')), bangNoiDung(noiDung), P(T(''))] : []),

    P(T('ĐIỀU 2: GIÁ TRỊ HỢP ĐỒNG', { bold: true }), { before: 240 }),
    P(T('')),
    bangGiaTri(hd.ten_goi ? `Chạy quảng cáo Shopee (${hd.ten_goi})` : 'Chạy quảng cáo Shopee', tong),
    P(T('')),
    dong('Thời gian dự kiến bắt đầu: ', hd.ngay_bat_dau ? new Date(hd.ngay_bat_dau).toLocaleDateString('vi-VN') : ''),

    P(T('ĐIỀU 3: PHƯƠNG THỨC THANH TOÁN', { bold: true }), { before: 240 }),
    P([T('3.1. Bên A sẽ thanh toán chi phí dịch vụ cho bên B với số tiền: ', {}), T(`${dinhDang(tong)} VNĐ`, { bold: true })]),
    P([T('Bằng chữ: ', {}), T(`${docTienThanhChu(tong)}./.`, { italics: true })]),
    P(T('3.2. Thanh toán bằng hình thức: Chuyển khoản.')),
    P(T('3.3. Phương thức thanh toán khi gia hạn hợp đồng:')),
    P(T(`Trường hợp Bên A có gia hạn Hợp đồng, Bên A sẽ thanh toán phí dịch vụ theo chu kỳ từng lần/tháng vào ngày ${ngayThanhToanHangThang(hd.ngay_ky)} hàng tháng.`)),
    P(T('Nếu có điều chỉnh về giá dịch vụ, hai Bên phải thống nhất bằng văn bản trước ít nhất 07 ngày trước khi bắt đầu kỳ gia hạn mới.'), { after: 160 }),

    P(T('ĐIỀU 4: QUYỀN VÀ NGHĨA VỤ CỦA BÊN A', { bold: true }), { before: 240 }),
    P(T('4.1. Cung cấp những thông tin cần thiết có liên quan đến việc triển khai tổng thể cho gian hàng shopee của bên A cho bên B.')),
    P(T('4.2. Không kéo dài thời gian duyệt kế hoạch, sản phẩm khi hai bên làm việc để tránh trường hợp rủi ro, ảnh hưởng đến công việc và tiến độ chạy quảng cáo. Trong trường hợp quá 05 ngày sau khi bên B bàn giao, sau khi nhận được mẫu gửi từ bên B mà bên A không có ý kiến phản hồi cụ thể nào đối với Shop quảng cáo được xem như bên A đã phê duyệt.')),
    P(T('4.3. Có trách nhiệm thanh toán đầy đủ và đúng hạn các khoản thanh toán nêu tại điều 2 của hợp đồng này.')),
    P(T('4.4. Trong trường hợp Bên A đơn phương chấm dứt hợp đồng vì bất kỳ lý do nào không xuất phát từ lỗi của Bên B, Bên B không có nghĩa vụ hoàn trả toàn bộ hoặc một phần giá trị hợp đồng mà Bên A đã thanh toán. Số tiền Bên A đã thanh toán theo Điều 2 sẽ được Bên B xem xét và trao đổi với Bên A để quy đổi sang các dịch vụ khác do Bên B đang cung cấp tại thời điểm phát sinh việc chấm dứt hợp đồng, trên cơ sở khả năng cung cấp dịch vụ thực tế.'), { after: 160 }),

    P(T('ĐIỀU 5: QUYỀN VÀ NGHĨA VỤ CỦA BÊN B', { bold: true }), { before: 240 }),
    P(T('5.1. Chịu trách nhiệm lên kế hoạch chạy quảng cáo theo các đầu mục đã nêu tại Điều 1.')),
    P(T('5.2. Đảm bảo đúng quy trình, yêu cầu và tiến độ được quy định trong hợp đồng.')),
    P(T('5.3. Bảo mật những thông tin liên quan đến chiến lược kinh doanh, bí mật công nghệ và những thông tin được yêu cầu giữ bí mật của bên A trong suốt quá trình thực hiện hợp đồng.')),
    P(T('5.4. Bên B được quyền sử dụng các mẫu chiến dịch quảng cáo này với mục đích giới thiệu năng lực của bên B.')),
    P(T('5.5. Trong trường hợp công việc buộc phải chấm dứt do đề nghị từ phía bên B thì bên B có trách nhiệm báo trước bằng văn bản/email (trước 30 ngày làm việc), đồng thời hoàn trả lại toàn bộ số tiền bên A đã thanh toán.'), { after: 160 }),

    P(T('ĐIỀU 6: ĐIỀU KHOẢN CHUNG', { bold: true }), { before: 240 }),
    P(T('6.1. Hai bên cam kết thực hiện nghiêm túc tất cả các điều khoản trong Hợp đồng này, Bên nào vi phạm sẽ phải bồi thường thiệt hại cho Bên kia. Trường hợp có tranh chấp hai bên sẽ giải quyết trên tinh thần thỏa thuận hòa giải, hợp tác. Trong trường hợp hai Bên không thể thỏa thuận được thì tranh chấp sẽ được đưa ra toà án có thẩm quyền tại thành phố Hà Nội, Việt Nam để phán xử.')),
    P(T('6.2. Trong trường hợp bên A muốn bổ sung thêm các hạng mục thiết kế so với nội dung quy định tại hợp đồng này, hai bên sẽ thống nhất chi phí phát sinh, thời gian thực hiện và các thông tin liên quan bằng 01 phụ lục hợp đồng kèm theo.')),
    P(T('6.3. Hợp đồng này có hiệu lực kể từ ngày Bên B nhận được tiền thanh toán và hoàn tất thủ tục thanh lý khi hai bên đạt được các điều khoản trong hợp đồng.')),
    P(T('6.4. Hợp đồng này gồm 03 (bốn) trang bản Tiếng Việt có giá trị như nhau được lập thành 02 (hai) bản, mỗi bên giữ 01 (một) bản để thực hiện.'), { after: 300 }),

    kyTen('', tenKyBenB(b)),
  ]
}

// ---------------- HỢP ĐỒNG XÂY SHOP ----------------
function hopDongXayShop(hd) {
  const b = { ...BEN_B_MAC_DINH.xay_shop, ...(hd.ben_b || {}) }
  const tong = Number(hd.gia_tri) || 0          // đã gồm VAT
  const noiDung = hd.rows_noi_dung || []
  const soSP = hd.so_san_pham || 30
  const soShop = Number(hd.so_luong_gian_hang) || 1
  const soShopPad = String(soShop).padStart(2, '0')
  const linkShop = hd.link_shop || 'Chưa có link shop'

  return [
    ...dauTrang(b.ten, hd.ngay_ky),

    P(T('HỢP ĐỒNG CUNG CẤP DỊCH VỤ', { bold: true, size: 32 }), { align: AlignmentType.CENTER, after: 0 }),
    P(T('THƯƠNG MẠI ĐIỆN TỬ', { bold: true, size: 32 }), { align: AlignmentType.CENTER, after: 200 }),

    P(T(`Số: ${hd.so_hop_dong}`, { bold: true }), { align: AlignmentType.CENTER, after: 200 }),

    ...canCu(),

    P(T(tieuDeBen('I. BÊN SỬ DỤNG DỊCH VỤ:', hd.ten_tieu_de_bena), { bold: true })),
    ...khoiBenA(hd),
    P(T('(Sau đây gọi tắt là Bên A)', { italics: true }), { after: 200 }),

    P(T(`II. BÊN CUNG CẤP DỊCH VỤ: ${b.ten}`, { bold: true })),
    ...khoiBenB(b),
    P(T('(Sau đây gọi tắt là Bên B)', { italics: true }), { after: 200 }),

    P(T('Cùng nhau thoả thuận và thống nhất ký kết Hợp đồng dịch vụ thương mại điện tử (sau đây được gọi là Hợp đồng) với những điều khoản sau:'), { after: 160 }),

    P(T('ĐIỀU 1: NỘI DUNG HỢP ĐỒNG', { bold: true }), { before: 240 }),
    P(T(`Bên B cung cấp Gói dịch vụ TỐI ƯU (Chuẩn hóa và tối ưu TỐI ĐA ${soSP} sản phẩm) cho bên A với những nội dung sau:`)),
    dong('- Số lượng shop: ', soShopPad),
    dong('- Link Shopee: ', linkShop),
    ...(noiDung.length ? [P(T('')), bangNoiDung(noiDung, [`Hạng mục ${soShop} shop`, 'Nội dung']), P(T(''))] : []),

    P(T('ĐIỀU 2: GIÁ TRỊ HỢP ĐỒNG', { bold: true }), { before: 240 }),
    P(T('')),
    bangGiaTri(hd.ten_goi || 'Xây dựng gian hàng Shopee', tong),
    P(T(''), { after: 160 }),

    P(T('ĐIỀU 3: PHƯƠNG THỨC THANH TOÁN', { bold: true }), { before: 240 }),
    P([T('3.1. Bên A thanh toán 100% phí dịch vụ khi bắt đầu công việc với số tiền như sau: ', {}), T(`${dinhDang(tong)} VNĐ`, { bold: true })]),
    P([T('Bằng chữ: ', {}), T(`${docTienThanhChu(tong)}./.`, { italics: true })]),
    P(T('3.2. Thanh toán bằng hình thức: Chuyển khoản.'), { after: 160 }),

    P(T('ĐIỀU 4: QUYỀN VÀ NGHĨA VỤ CỦA BÊN A', { bold: true }), { before: 240 }),
    P(T('4.1. Cung cấp những thông tin cần thiết có liên quan đến việc triển khai tổng thể cho gian hàng shopee của bên A cho bên B.')),
    P(T('4.2. Không kéo dài thời gian duyệt mẫu, sản phẩm khi hai bên làm việc để tránh trường hợp rủi ro, ảnh hưởng đến công việc và tiến độ thiết kế. Trong trường hợp quá 10 ngày sau khi bên B bàn giao, sau khi nhận được mẫu gửi từ bên B mà bên A không có ý kiến phản hồi cụ thể nào đối với Shop thiết kế thì mặc nhiên mẫu thiết kế được xem như bên A đã phê duyệt.')),
    P(T('4.3. Có trách nhiệm thanh toán đầy đủ và đúng hạn các khoản thanh toán nêu tại điều 2 của hợp đồng này.')),
    P(T('4.5. Trong trường hợp bên A vi phạm và buộc phải chấm dứt hợp đồng, bên B sẽ không hoàn trả cho bên A toàn bộ giá trị hợp đồng mà bên A đã thanh toán.'), { after: 160 }),

    P(T('ĐIỀU 5: QUYỀN VÀ NGHĨA VỤ CỦA BÊN B', { bold: true }), { before: 240 }),
    P(T('5.1. Chịu trách nhiệm thiết kế sáng tạo.')),
    P(T('5.2. Đảm bảo đúng quy trình, yêu cầu và tiến độ được quy định trong hợp đồng. Bàn giao shop trong tối đa 20 ngày từ khi bên A cung cấp đủ dữ liệu triển khai công việc.')),
    P(T('5.3. Bảo mật những thông tin liên quan đến chiến lược kinh doanh, bí mật công nghệ và những thông tin được yêu cầu giữ bí mật của bên A trong suốt quá trình thực hiện hợp đồng và sau khi bàn giao shop.')),
    P(T('5.4. Chuyển giao cho bên A kết quả sản phẩm thiết kế, tài liệu và hóa đơn tài chính sau khi bên A thanh toán đầy đủ các chi phí theo nội dung của hợp đồng này.')),
    P(T('5.5. Bên B được quyền sử dụng các mẫu thiết kế này với mục đích giới thiệu năng lực của bên B.')),
    P(T('5.6. Trong trường hợp công việc buộc phải chấm dứt do đề nghị từ phía bên B thì bên B có trách nhiệm báo trước bằng văn bản/email (trước 30 ngày làm việc), đồng thời hoàn trả lại toàn bộ số tiền bên A đã thanh toán.')),
    P(T(`5.7. Trong trường hợp bên A chưa cung cấp đầy đủ số lượng ${soSP} sản phẩm để thiết kế, bên B sẽ hỗ trợ bảo lưu số lượng sản phẩm còn lại trong gói và hỗ trợ bên A triển khai đủ số lượng sản phẩm trong gói đã đăng kí khi có thêm sản phẩm.`), { after: 160 }),

    P(T('ĐIỀU 6: ĐIỀU KHOẢN CHUNG', { bold: true }), { before: 240 }),
    P(T('6.1. Hai bên cam kết thực hiện nghiêm túc tất cả các điều khoản trong Hợp đồng này, Bên nào vi phạm sẽ phải bồi thường thiệt hại cho Bên kia. Trường hợp có tranh chấp hai bên sẽ giải quyết trên tinh thần thỏa thuận hòa giải, hợp tác. Trong trường hợp hai Bên không thể thỏa thuận được thì tranh chấp sẽ được đưa ra toà án có thẩm quyền tại thành phố Hà Nội, Việt Nam để phán xử.')),
    P(T('6.2. Trong trường hợp Bên A muốn bổ sung thêm các mục thiết kế so với nội dung quy định tại hợp đồng này, hai bên sẽ thống nhất chi phí phát sinh, thời gian thực hiện và các thông tin liên quan bằng 01 phụ lục hợp đồng kèm theo.')),
    P(T('6.3. Hợp đồng này có hiệu lực kể từ ngày Bên B nhận được tiền thanh toán và hoàn tất thủ tục thanh lý khi hai bên đạt được các điều khoản trong hợp đồng.')),
    P(T('6.4. Hợp đồng này gồm 03 (ba) trang bản Tiếng Việt có giá trị như nhau được lập thành 02 (hai) bản, mỗi bên giữ 01 (một) bản để thực hiện.'), { after: 300 }),

    kyTen('', tenKyBenB(b)),
  ]
}

export async function taoFileHopDong(hd) {
  const children = hd.loai_dich_vu === 'xay_shop' ? hopDongXayShop(hd) : hopDongAds(hd)
  const doc = new Document({
    styles: { default: { document: { run: { font: FONT, size: 24 } } } },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 }, // khổ A4 chuẩn (21cm x 29.7cm) — trước đây thiếu dòng này nên Word tự hiểu là khổ Letter
          margin: { top: 1134, bottom: 1134, left: 1701, right: 1134 },
        },
      },
      children,
    }],
  })
  return await Packer.toBlob(doc)
}
