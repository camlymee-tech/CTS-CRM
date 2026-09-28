// Thông tin Bên B (bên cung cấp dịch vụ = công ty mình) cho từng loại hợp đồng.
// Đây là giá trị mặc định — nếu đã sửa trong app (bảng ben_b_settings) thì lấy bản đã sửa.
// Ô nào để trống thì hợp đồng sẽ không hiện dòng đó.
export const BEN_B_MAC_DINH = {
  xay_shop: {
    ten: 'CÔNG TY CỔ PHẦN TẬP ĐOÀN TUKIGROUP',
    dai_dien: 'NGUYỄN TRUNG KIÊN',
    chuc_vu: 'Chủ tịch HĐQT',
    giay_uy_quyen: '',
    dia_chi: 'Tầng 3, T2 Times Tower, số 35 đường Lê Văn Lương, Phường Thanh Xuân, Thành phố Hà Nội, Việt Nam',
    mst: '0109789110',
    sdt: '0868.388.862',
    chu_tai_khoan: '',
    so_tai_khoan: '86286888888 tại Ngân hàng Thương mại cổ phần Á Châu (ACB)',
    ngan_hang: '',
  },
  ads: {
    ten: 'CÔNG TY TNHH TUKI ADS',
    dai_dien: '(Ông) LÊ DANH TUẤN',
    chuc_vu: 'Phó phòng Kỹ thuật Ads',
    giay_uy_quyen: '01/UQ-TNHH/2026 ngày 01/08/2026',
    dia_chi: 'Tầng 3, T2 Times Tower, số 35 đường Lê Văn Lương, Phường Thanh Xuân, TP Hà Nội, Việt Nam',
    mst: '0111571658',
    sdt: '',
    chu_tai_khoan: 'CÔNG TY TNHH TUKI ADS',
    so_tai_khoan: '3688999',
    ngan_hang: 'TMCP Việt Nam Thịnh Vượng (VPBank)',
  },
}

export const BEN_B_TRUONG = [
  { key: 'ten', label: 'Tên công ty (Bên cung cấp dịch vụ)', rong: true },
  { key: 'dai_dien', label: 'Đại diện' },
  { key: 'chuc_vu', label: 'Chức vụ' },
  { key: 'giay_uy_quyen', label: 'Giấy ủy quyền (nếu có, VD: 01/UQ-TNHH/2026 ngày 01/08/2026)', rong: true },
  { key: 'dia_chi', label: 'Địa chỉ', rong: true },
  { key: 'mst', label: 'MST' },
  { key: 'sdt', label: 'SĐT' },
  { key: 'chu_tai_khoan', label: 'Chủ tài khoản', rong: true },
  { key: 'so_tai_khoan', label: 'Số tài khoản', rong: true },
  { key: 'ngan_hang', label: 'Ngân hàng', rong: true },
]
