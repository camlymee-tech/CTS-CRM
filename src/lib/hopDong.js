import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle,
} from 'docx'
import { docTienThanhChu } from './docSo'

const FONT = 'Times New Roman'
const dinhDang = (n) => new Intl.NumberFormat('vi-VN').format(Math.round(Number(n) || 0))

const T = (text, o = {}) => new TextRun({ text, font: FONT, size: o.size || 24, bold: o.bold, italics: o.italics, ...o })
const P = (children, o = {}) => new Paragraph({
  children: Array.isArray(children) ? children : [children],
  alignment: o.align || AlignmentType.JUSTIFIED, spacing: { after: o.after ?? 120, line: 300 }, ...o,
})
const dong = (nhan, giaTri, o = {}) => P([T(nhan, { bold: o.bold }), T(giaTri || '.....................................')])

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

const canCu = () => [
  P(T('- Căn cứ Bộ luật Dân sự số 91/2015/QH13 có hiệu lực từ ngày 01/01/2017 và các văn bản hướng dẫn thi hành.', { size: 22 })),
  P(T('- Căn cứ Luật Thương mại số 36/2005/QH11 có hiệu lực từ ngày 01/01/2006.', { size: 22 })),
  P(T('- Căn cứ Luật Công nghệ thông tin số 67/2006/QH11 có hiệu lực từ ngày 01/01/2007.', { size: 22 })),
  P(T('- Căn cứ vào khả năng và nhu cầu của các bên trong Hợp đồng.', { size: 22, }), { after: 200 }),
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

// ---------------- HỢP ĐỒNG QUẢNG CÁO ----------------
function hopDongAds(hd) {
  const tong = Math.round(Number(hd.gia_tri) || 0)   // giá trị đơn đã bao gồm VAT
  const giaTri = Math.round(tong / 1.08)              // tách ngược ra giá trước VAT để hiển thị
  const vat = tong - giaTri
  const noiDung = hd.rows_noi_dung || []
  const soSP = hd.so_san_pham || 30

  return [
    P([T('CÔNG TY TNHH TUKI ADS', { bold: true, size: 22 })], { align: AlignmentType.LEFT, after: 0 }),
    P([T('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', { bold: true, size: 22 })], { align: AlignmentType.RIGHT, after: 0 }),
    P([T('Độc lập – Tự do – Hạnh phúc', { bold: true, size: 22 })], { align: AlignmentType.RIGHT, after: 200 }),
    P(T(ngayVN(hd.ngay_ky), { italics: true }), { align: AlignmentType.RIGHT, after: 200 }),

    P(T('HỢP ĐỒNG CUNG CẤP DỊCH VỤ THƯƠNG MẠI ĐIỆN TỬ', { bold: true, size: 32 }), { align: AlignmentType.CENTER, after: 60 }),
    P(T(`Số: ${hd.so_hop_dong}`, { bold: true }), { align: AlignmentType.CENTER, after: 200 }),

    ...canCu(),

    P(T(`Hôm nay, ${ngayVN(hd.ngay_ky).replace('Hà Nội, ', '')}, các bên gồm:`), { after: 160 }),

    P(T('I. BÊN SỬ DỤNG DỊCH VỤ (BÊN A):', { bold: true })),
    dong('Tên: ', hd.ten_khach),
    dong('Địa chỉ: ', hd.dia_chi),
    dong('MST: ', hd.mst),
    dong('Đại diện: ', hd.nguoi_dai_dien),
    dong('Chức vụ: ', hd.chuc_vu),
    dong('Số điện thoại: ', hd.sdt),

    P(T('II. BÊN CUNG CẤP (BÊN B): CÔNG TY TNHH TUKI ADS', { bold: true })),
    P(T('Địa chỉ: Tầng 3, T2 Times Tower, số 35 đường Lê Văn Lương, Phường Thanh Xuân, TP Hà Nội, Việt Nam')),
    P(T('Mã số thuế: 0111571658')),
    P(T('Đại diện ký kết (Người được ủy quyền): (Ông) LÊ DANH TUẤN')),
    P(T('Chức vụ: Phó phòng Kỹ thuật Ads')),
    P(T('(Theo Giấy ủy quyền số: 01/UQ-TNHH/2026 ngày 01/08/2026)')),
    P(T('Chủ tài khoản: CÔNG TY TNHH TUKI ADS')),
    P(T('Số tài khoản: 3688999 - Ngân hàng TMCP Việt Nam Thịnh Vượng (VPBank)'), { after: 200 }),

    P(T('Sau khi thảo luận, hai bên thống nhất ký Hợp đồng cung ứng dịch vụ Chạy Quảng cáo gian hàng Shopee với các điều khoản sau:'), { after: 160 }),

    P(T('ĐIỀU 1: NỘI DUNG HỢP ĐỒNG', { bold: true }), { before: 240 }),
    P(T(`Bên B cung cấp Gói dịch vụ SHOPEE ADS${hd.ten_goi ? ` (${hd.ten_goi})` : ''} cho bên A với những nội dung sau:`)),
    dong('- Link Shopee (tên shop): ', hd.link_shop),
    dong('- Tổng số lượng gian hàng: ', String(hd.so_luong_gian_hang || 1)),
    ...(noiDung.length ? [P(T('')), bangNoiDung(noiDung), P(T(''))] : []),

    P(T('ĐIỀU 2: GIÁ TRỊ HỢP ĐỒNG', { bold: true }), { before: 240 }),
    P([T('Giá trị sản phẩm: ', {}), T(`${dinhDang(giaTri)} VNĐ`, { bold: true })]),
    P([T('VAT 8%: ', {}), T(`${dinhDang(vat)} VNĐ`, { bold: true })]),
    P([T('Tổng giá trị hợp đồng: ', {}), T(`${dinhDang(tong)} VNĐ`, { bold: true })]),
    P([T('Bằng chữ: ', {}), T(`${docTienThanhChu(tong)}./.`, { italics: true })]),
    dong('Thời gian dự kiến bắt đầu: ', hd.ngay_bat_dau ? new Date(hd.ngay_bat_dau).toLocaleDateString('vi-VN') : ''),

    P(T('ĐIỀU 3: PHƯƠNG THỨC THANH TOÁN', { bold: true }), { before: 240 }),
    P([T('3.1. Bên A sẽ thanh toán chi phí dịch vụ cho bên B với số tiền: ', {}), T(`${dinhDang(tong)} VNĐ`, { bold: true })]),
    P([T('Bằng chữ: ', {}), T(`${docTienThanhChu(tong)}./.`, { italics: true })]),
    P(T('3.2. Thanh toán bằng hình thức: Chuyển khoản.')),
    P(T('3.3. Trường hợp Bên A gia hạn Hợp đồng, Bên A thanh toán phí dịch vụ theo chu kỳ từng tháng. Nếu có điều chỉnh giá, hai Bên thống nhất bằng văn bản trước ít nhất 07 ngày.'), { after: 160 }),

    P(T('ĐIỀU 4: QUYỀN VÀ NGHĨA VỤ CỦA BÊN A', { bold: true }), { before: 240 }),
    P(T('4.1. Cung cấp những thông tin cần thiết liên quan đến việc triển khai tổng thể gian hàng Shopee của bên A cho bên B.')),
    P(T('4.2. Không kéo dài thời gian duyệt kế hoạch, sản phẩm. Quá 05 ngày sau khi bên B bàn giao mà bên A không phản hồi thì xem như đã phê duyệt.')),
    P(T('4.3. Thanh toán đầy đủ và đúng hạn các khoản nêu tại Điều 2.')),
    P(T('4.4. Trường hợp Bên A đơn phương chấm dứt hợp đồng không do lỗi Bên B, Bên B không hoàn trả giá trị hợp đồng đã thanh toán; số tiền sẽ được xem xét quy đổi sang dịch vụ khác.'), { after: 160 }),

    P(T('ĐIỀU 5: QUYỀN VÀ NGHĨA VỤ CỦA BÊN B', { bold: true }), { before: 240 }),
    P(T('5.1. Chịu trách nhiệm lên kế hoạch chạy quảng cáo theo các đầu mục tại Điều 1.')),
    P(T('5.2. Đảm bảo đúng quy trình, yêu cầu và tiến độ quy định trong hợp đồng.')),
    P(T('5.3. Bảo mật thông tin chiến lược kinh doanh, bí mật công nghệ của bên A trong suốt quá trình thực hiện.')),
    P(T('5.4. Được quyền sử dụng các mẫu chiến dịch quảng cáo với mục đích giới thiệu năng lực.')),
    P(T('5.5. Trường hợp chấm dứt do đề nghị từ bên B, bên B báo trước bằng văn bản/email (trước 30 ngày), hoàn trả toàn bộ số tiền bên A đã thanh toán.'), { after: 160 }),

    P(T('ĐIỀU 6: ĐIỀU KHOẢN CHUNG', { bold: true }), { before: 240 }),
    P(T('6.1. Hai bên cam kết thực hiện nghiêm túc các điều khoản. Bên vi phạm phải bồi thường. Tranh chấp giải quyết trên tinh thần hòa giải; không thỏa thuận được sẽ đưa ra tòa án có thẩm quyền tại Hà Nội.')),
    P(T('6.2. Nếu bổ sung hạng mục so với hợp đồng, hai bên thống nhất chi phí phát sinh bằng 01 phụ lục kèm theo.')),
    P(T('6.3. Hợp đồng có hiệu lực kể từ ngày Bên B nhận được tiền thanh toán.')),
    P(T('6.4. Hợp đồng lập thành 02 bản Tiếng Việt có giá trị như nhau, mỗi bên giữ 01 bản.'), { after: 300 }),

    kyTen(hd.ten_khach, 'LÊ DANH TUẤN'),
  ]
}

// ---------------- HỢP ĐỒNG XÂY SHOP ----------------
function hopDongXayShop(hd) {
  const tong = Number(hd.gia_tri) || 0          // đã gồm VAT
  const noiDung = hd.rows_noi_dung || []
  const soSP = hd.so_san_pham || 30
  const soShop = Number(hd.so_luong_gian_hang) || 1
  const soShopPad = String(soShop).padStart(2, '0')
  const linkShop = hd.link_shop || 'Chưa có link shop'

  return [
    P(T('CÔNG TY CỔ PHẦN', { bold: true, size: 22 }), { after: 0 }),
    P([T('TẬP ĐOÀN TUKIGROUP', { bold: true, size: 22 })], { after: 0 }),
    P([T('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', { bold: true, size: 22 })], { align: AlignmentType.RIGHT, after: 0 }),
    P([T('Độc lập – Tự do – Hạnh phúc', { bold: true, size: 22 })], { align: AlignmentType.RIGHT, after: 200 }),

    P(T('HỢP ĐỒNG CUNG CẤP DỊCH VỤ', { bold: true, size: 32 }), { align: AlignmentType.CENTER, after: 0 }),
    P(T('THƯƠNG MẠI ĐIỆN TỬ', { bold: true, size: 32 }), { align: AlignmentType.CENTER, after: 200 }),

    P(T(`Số: ${hd.so_hop_dong}`, { bold: true }), { align: AlignmentType.CENTER, after: 60 }),
    P(T(ngayVN(hd.ngay_ky), { italics: true }), { align: AlignmentType.CENTER, after: 200 }),

    ...canCu(),

    P(T(`I. BÊN SỬ DỤNG DỊCH VỤ: ${(hd.ten_khach || '').toUpperCase()}`, { bold: true })),
    P(T(`Đại diện: ${hd.nguoi_dai_dien || '.....................................'} - Chức vụ: ${hd.chuc_vu || '.....................................'}`)),
    dong('Địa chỉ: ', hd.dia_chi),
    dong('MST: ', hd.mst),
    dong('SĐT: ', hd.sdt),
    dong('Email: ', hd.email),
    P(T('(Sau đây gọi tắt là Bên A)', { italics: true }), { after: 200 }),

    P(T('II. BÊN CUNG CẤP DỊCH VỤ: CÔNG TY CỔ PHẦN TẬP ĐOÀN TUKIGROUP', { bold: true })),
    P(T('Đại diện: NGUYỄN TRUNG KIÊN - Chức vụ: Chủ tịch HĐQT')),
    P(T('Địa chỉ: Tầng 3, T2 Times Tower, số 35 đường Lê Văn Lương, Phường Thanh Xuân, Thành phố Hà Nội, Việt Nam')),
    P(T('MST: 0109789110')),
    P(T('SĐT: 0868.388.862')),
    P(T('Số tài khoản: 86286888888 tại Ngân hàng Thương mại cổ phần Á Châu (ACB)')),
    P(T('(Sau đây gọi tắt là Bên B)', { italics: true }), { after: 200 }),

    P(T('Cùng nhau thoả thuận và thống nhất ký kết Hợp đồng dịch vụ thương mại điện tử (sau đây được gọi là Hợp đồng) với những điều khoản sau:'), { after: 160 }),

    P(T('ĐIỀU 1: NỘI DUNG HỢP ĐỒNG', { bold: true }), { before: 240 }),
    P(T(`Bên B cung cấp Gói dịch vụ TỐI ƯU${hd.ten_goi ? ` (${hd.ten_goi})` : ''} - Chuẩn hóa và tối ưu tối đa ${soSP} sản phẩm cho bên A với những nội dung sau:`)),
    dong('- Số lượng shop: ', soShopPad),
    dong('- Link Shopee: ', linkShop),
    ...(noiDung.length ? [P(T('')), bangNoiDung(noiDung, [`Hạng mục ${soShop} shop`, 'Nội dung']), P(T(''))] : []),

    P(T('ĐIỀU 2: GIÁ TRỊ HỢP ĐỒNG', { bold: true }), { before: 240 }),
    P([T('Giá trị hợp đồng (bao gồm VAT): ', {}), T(`${dinhDang(tong)} VNĐ`, { bold: true })]),
    P([T('Bằng chữ: ', {}), T(`${docTienThanhChu(tong)}./.`, { italics: true })], { after: 160 }),

    P(T('ĐIỀU 3: PHƯƠNG THỨC THANH TOÁN', { bold: true }), { before: 240 }),
    P([T('3.1. Bên A thanh toán 100% phí dịch vụ khi bắt đầu công việc với số tiền như sau: ', {}), T(`${dinhDang(tong)} VNĐ`, { bold: true })]),
    P([T('Bằng chữ: ', {}), T(`${docTienThanhChu(tong)}./.`, { italics: true })]),
    P(T('3.2. Thanh toán bằng hình thức: Chuyển khoản.'), { after: 160 }),

    P(T('ĐIỀU 4: QUYỀN VÀ NGHĨA VỤ CỦA BÊN A', { bold: true }), { before: 240 }),
    P(T('4.1. Cung cấp những thông tin cần thiết liên quan đến việc triển khai tổng thể gian hàng Shopee của bên A cho bên B.')),
    P(T('4.2. Không kéo dài thời gian duyệt mẫu. Quá 10 ngày sau khi bên B bàn giao mà bên A không phản hồi thì xem như đã phê duyệt.')),
    P(T('4.3. Thanh toán đầy đủ và đúng hạn các khoản nêu tại Điều 2.')),
    P(T('4.4. Trường hợp bên A vi phạm buộc phải chấm dứt hợp đồng, bên B không hoàn trả toàn bộ giá trị hợp đồng đã thanh toán.'), { after: 160 }),

    P(T('ĐIỀU 5: QUYỀN VÀ NGHĨA VỤ CỦA BÊN B', { bold: true }), { before: 240 }),
    P(T('5.1. Chịu trách nhiệm thiết kế sáng tạo.')),
    P(T('5.2. Đảm bảo đúng quy trình, yêu cầu và tiến độ. Bàn giao shop trong tối đa 20 ngày từ khi bên A cung cấp đủ dữ liệu.')),
    P(T('5.3. Bảo mật thông tin của bên A trong suốt quá trình thực hiện và sau khi bàn giao.')),
    P(T('5.4. Chuyển giao kết quả sản phẩm thiết kế, tài liệu và hóa đơn tài chính sau khi bên A thanh toán đầy đủ.')),
    P(T('5.5. Được quyền sử dụng các mẫu thiết kế với mục đích giới thiệu năng lực.')),
    P(T('5.6. Trường hợp chấm dứt do đề nghị từ bên B, báo trước bằng văn bản/email (trước 30 ngày), hoàn trả toàn bộ số tiền đã thanh toán.')),
    P(T(`5.7. Nếu bên A chưa cung cấp đủ ${soSP} sản phẩm, bên B bảo lưu số lượng còn lại và hỗ trợ triển khai đủ khi có thêm sản phẩm.`), { after: 160 }),

    P(T('ĐIỀU 6: ĐIỀU KHOẢN CHUNG', { bold: true }), { before: 240 }),
    P(T('6.1. Hai bên cam kết thực hiện nghiêm túc các điều khoản. Bên vi phạm phải bồi thường. Tranh chấp giải quyết trên tinh thần hòa giải; không thỏa thuận được sẽ đưa ra tòa án có thẩm quyền tại Hà Nội.')),
    P(T('6.2. Nếu bổ sung mục thiết kế so với hợp đồng, hai bên thống nhất chi phí phát sinh bằng 01 phụ lục kèm theo.')),
    P(T('6.3. Hợp đồng có hiệu lực kể từ ngày Bên B nhận được tiền thanh toán.')),
    P(T('6.4. Hợp đồng lập thành 02 bản Tiếng Việt có giá trị như nhau, mỗi bên giữ 01 bản.'), { after: 300 }),

    kyTen(hd.ten_khach, 'NGUYỄN TRUNG KIÊN'),
  ]
}

export async function taoFileHopDong(hd) {
  const children = hd.loai_dich_vu === 'xay_shop' ? hopDongXayShop(hd) : hopDongAds(hd)
  const doc = new Document({
    styles: { default: { document: { run: { font: FONT, size: 24 } } } },
    sections: [{ properties: { page: { margin: { top: 1134, bottom: 1134, left: 1701, right: 1134 } } }, children }],
  })
  return await Packer.toBlob(doc)
}
