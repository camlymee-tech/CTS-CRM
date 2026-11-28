// Form "Xuất hợp đồng" (Word) mở từ hồ sơ khách + hàm dựng lại dữ liệu hợp đồng đã lưu để xem trước.
// Tách ra từ ContractsPage.jsx cũ (trang danh sách hợp đồng đã bỏ khỏi menu).
import { useState } from 'react'
import { FileDown, Eye, Save } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { Button, Input, Select, Modal, Textarea } from './ui'
import { formatVnd } from '../lib/constants'
import { taoSoHopDong, vietTat } from '../lib/docSo'
import ContractPreview from './ContractPreview'
import { homNayLocal } from '../lib/ngay'
import { loiDeHieu } from '../lib/loi'

// Chuỗi "Tên | Chi tiết" mỗi dòng -> mảng [ [tên, chi tiết], ... ] cho bảng nội dung hợp đồng
function parseNoiDung(text) {
  return (text || '').trim()
    ? text.trim().split('\n').map((l) => {
        const [a, ...b] = l.split('|')
        return [a.trim(), b.join('|').trim()]
      })
    : []
}

// Tìm gói (trong service_packages) khớp với dịch vụ đã chốt trên đơn, theo loại hợp đồng
// đang chọn — ads -> "Chạy quảng cáo"; xay_shop -> "Xây shop" / "Tối ưu sản phẩm"
function timGoiKhop(loaiDV, dichVu, packages) {
  const khop = loaiDV === 'xay_shop' ? /xây shop|tối ưu/i : /quảng cáo/i
  const item = (dichVu || []).find((d) => d.package_id && khop.test(d.ten_dich_vu))
  if (!item) return null
  return (packages || []).find((p) => p.id === item.package_id) || null
}

// Dựng lại dữ liệu hợp đồng (đúng cấu trúc taoFileHopDong cần) từ 1 hợp đồng đã lưu,
// dùng để xem trước ngay từ danh sách mà không cần mở lại form xuất file
export function hdTuHopDongDaLuu(c, khach) {
  return {
    loai_dich_vu: c.loai_dich_vu || 'ads',
    so_hop_dong: c.so_hop_dong,
    ngay_ky: c.ngay_ky,
    ten_khach: khach?.ten_khach,
    sdt: khach?.sdt,
    dia_chi: khach?.dia_chi, mst: khach?.mst,
    nguoi_dai_dien: khach?.nguoi_dai_dien, chuc_vu: khach?.chuc_vu, email: khach?.email,
    link_shop: khach?.link_shop,
    so_luong_gian_hang: c.so_luong_gian_hang || 1,
    so_san_pham: c.so_san_pham,
    ten_goi: c.ten_goi,
    ngay_bat_dau: c.ngay_bat_dau,
    gia_tri: c.gia_tri,
    rows_noi_dung: parseNoiDung(c.noi_dung_hd),
  }
}

export function XuatHopDongForm({ contract, khach, don, dichVu, packages, onClose, onSaved }) {
  const laXayShop = (dichVu || []).some((d) => /xây shop|tối ưu/i.test(d.ten_dich_vu))
  const [loaiDV, setLoaiDV] = useState(contract.loai_dich_vu || (laXayShop ? 'xay_shop' : 'ads'))
  const [vtat, setVtat] = useState(khach?.ten_viet_tat || vietTat(khach?.ten_khach))
  const goiKhop0 = timGoiKhop(loaiDV, dichVu, packages)
  const [form, setForm] = useState({
    ngay_ky: contract.ngay_ky || homNayLocal(),
    dia_chi: khach?.dia_chi || '',
    mst: khach?.mst || '',
    nguoi_dai_dien: khach?.nguoi_dai_dien || '',
    chuc_vu: khach?.chuc_vu || '',
    email: khach?.email || '',
    link_shop: khach?.link_shop || '',
    so_luong_gian_hang: contract.so_luong_gian_hang || 1,
    so_san_pham: contract.so_san_pham || goiKhop0?.so_san_pham || '',
    ten_goi: contract.ten_goi || (dichVu || []).map((d) => d.ten_goi).filter(Boolean).join(', '),
    ngay_bat_dau: contract.ngay_bat_dau || '',
    noi_dung: contract.noi_dung_hd || goiKhop0?.noi_dung_hd || '',  // mỗi dòng: "Nội dung | Chi tiết" — tự điền theo gói, sửa được
  })
  const [dangXuat, setDangXuat] = useState(false)
  const [msg, setMsg] = useState('')
  const [dangLuu, setDangLuu] = useState(false)
  const [daLuu, setDaLuu] = useState('')
  const [xemTruoc, setXemTruoc] = useState(false)

  // Đổi loại hợp đồng (ads/xay_shop) thì dò lại gói khớp để điền lại số SP/nội dung
  function doiLoaiDV(loai) {
    setLoaiDV(loai)
    const g = timGoiKhop(loai, dichVu, packages)
    if (g) {
      setForm((f) => ({
        ...f,
        so_san_pham: f.so_san_pham || g.so_san_pham || '',
        ten_goi: g.ten_goi || f.ten_goi,
        noi_dung: g.noi_dung_hd || f.noi_dung,
      }))
    }
  }

  // Giữ nguyên số hợp đồng đã có (tự sinh lúc tạo đơn) — chỉ sinh số mới theo mẫu
  // TUKISELLER/TUKIADS cho hợp đồng CHƯA từng có số, để không đổi số mỗi lần xuất lại
  const soHD = contract.so_hop_dong || taoSoHopDong({
    loaiDichVu: loaiDV, ngay: form.ngay_ky,
    maKhach: khach?.ma_khach, tenVietTat: vtat,
  })

  // Dữ liệu hợp đồng dựng từ form hiện tại — dùng chung cho cả Xem trước và Xuất file Word
  function hdHienTai() {
    return {
      loai_dich_vu: loaiDV,
      so_hop_dong: soHD,
      ngay_ky: form.ngay_ky,
      ten_khach: khach?.ten_khach,
      sdt: khach?.sdt,
      dia_chi: form.dia_chi, mst: form.mst,
      nguoi_dai_dien: form.nguoi_dai_dien, chuc_vu: form.chuc_vu, email: form.email,
      link_shop: form.link_shop,
      so_luong_gian_hang: Number(form.so_luong_gian_hang) || 1,
      so_san_pham: form.so_san_pham ? Number(form.so_san_pham) : null,
      ten_goi: form.ten_goi,
      ngay_bat_dau: form.ngay_bat_dau,
      gia_tri: contract.gia_tri,
      rows_noi_dung: parseNoiDung(form.noi_dung),
    }
  }

  // Lưu thông tin Bên A vào hồ sơ khách + thông tin hợp đồng để lần sau khỏi nhập lại.
  // Trả về chuỗi lỗi (rỗng nếu lưu được).
  async function luuThongTin() {
    const { error: e1 } = await supabase.from('customers').update({
      dia_chi: form.dia_chi || null, mst: form.mst || null,
      nguoi_dai_dien: form.nguoi_dai_dien || null, chuc_vu: form.chuc_vu || null,
      email: form.email || null, ten_viet_tat: vtat || null,
      link_shop: form.link_shop || null,
    }).eq('id', khach.id)
    if (e1) return e1.message
    const { error: e2 } = await supabase.from('contracts').update({
      so_hop_dong: soHD, loai_dich_vu: loaiDV,
      so_luong_gian_hang: Number(form.so_luong_gian_hang) || 1,
      so_san_pham: form.so_san_pham ? Number(form.so_san_pham) : null,
      ten_goi: form.ten_goi || null,
      ngay_bat_dau: form.ngay_bat_dau || null,
      noi_dung_hd: form.noi_dung || null,
    }).eq('id', contract.id)
    return e2 ? e2.message : ''
  }

  async function luu() {
    setDangLuu(true); setMsg(''); setDaLuu('')
    const loi = await luuThongTin()
    setDangLuu(false)
    if (loi) setMsg('Không lưu được: ' + loi)
    else setDaLuu('Đã lưu thông tin')
  }

  async function xuat() {
    setDangXuat(true); setMsg(''); setDaLuu('')
    const loi = await luuThongTin()
    if (loi) { setDangXuat(false); setMsg('Không lưu được: ' + loi); return }

    try {
      const { taoFileHopDong } = await import('../lib/hopDong')
      const blob = await taoFileHopDong(hdHienTai())
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `HopDong_${soHD.replace(/\//g, '-')}.docx`
      a.click()
      URL.revokeObjectURL(url)
      setDangXuat(false)
      onSaved()
    } catch (e) {
      setDangXuat(false)
      setMsg('Lỗi tạo file: ' + loiDeHieu(e))
    }
  }

  return (
    <Modal title="Xuất hợp đồng" onClose={onClose} wide>
      <div className="space-y-4">
        <div className="rounded-xl bg-slate-50 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-ink-400">Khách hàng</p>
          <p className="font-display font-semibold text-navy-900">{khach?.ten_khach || '—'}</p>
          <p className="text-sm text-ink-600">Giá trị {formatVnd(contract.gia_tri)} (đã gồm VAT)</p>
          <p className="mt-1 text-xs text-ink-400">
            Thông tin Bên A (địa chỉ, MST, người đại diện, link shop...) lấy từ hồ sơ khách hàng —
            sửa ở đây sẽ tự cập nhật lại luôn hồ sơ khách để dùng chung cho các hợp đồng sau.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Select label="Loại hợp đồng" value={loaiDV} onChange={(e) => doiLoaiDV(e.target.value)}>
            <option value="ads">Chạy quảng cáo (TUKI ADS)</option>
            <option value="xay_shop">Xây shop (TUKIGROUP)</option>
          </Select>
          <Input label="Ngày ký" type="date" value={form.ngay_ky}
            onChange={(e) => setForm({ ...form, ngay_ky: e.target.value })} />
        </div>

        <div className="rounded-lg bg-teal-50 px-3 py-2 text-sm">
          <span className="text-ink-600">Số hợp đồng: </span>
          <span className="font-medium text-navy-900">{soHD}</span>
          {contract.so_hop_dong && (
            <span className="ml-1 text-xs text-ink-400">(giữ nguyên số đã có, không đổi khi xuất lại)</span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          {!contract.so_hop_dong && (
            <Input label="Tên viết tắt (trong số HĐ)" value={vtat}
              onChange={(e) => setVtat(e.target.value.toUpperCase())} />
          )}
          <Input label="Người đại diện (Bên A)" value={form.nguoi_dai_dien}
            onChange={(e) => setForm({ ...form, nguoi_dai_dien: e.target.value })} />
          <Input label="Chức vụ" value={form.chuc_vu}
            onChange={(e) => setForm({ ...form, chuc_vu: e.target.value })} />
          <Input label="Mã số thuế" value={form.mst}
            onChange={(e) => setForm({ ...form, mst: e.target.value })} />
          <div className="col-span-2">
            <Input label="Địa chỉ" value={form.dia_chi}
              onChange={(e) => setForm({ ...form, dia_chi: e.target.value })} />
          </div>
          {loaiDV === 'xay_shop' && (
            <Input label="Email" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} />
          )}
          <Input label="Link shop" value={form.link_shop}
            onChange={(e) => setForm({ ...form, link_shop: e.target.value })} />
          <Input label="Số lượng gian hàng" type="number" min="1" value={form.so_luong_gian_hang}
            onChange={(e) => setForm({ ...form, so_luong_gian_hang: e.target.value })} />
          <Input label="Số sản phẩm (theo gói)" type="number" value={form.so_san_pham}
            onChange={(e) => setForm({ ...form, so_san_pham: e.target.value })}
            placeholder={goiKhop0?.so_san_pham ? `Tự điền: ${goiKhop0.so_san_pham}` : 'VD: 20'} />
          <Input label="Tên gói" value={form.ten_goi}
            onChange={(e) => setForm({ ...form, ten_goi: e.target.value })} placeholder="VD: SHOPEE PRO - 1 tháng" />
          {loaiDV === 'ads' && (
            <Input label="Ngày dự kiến bắt đầu" type="date" value={form.ngay_bat_dau}
              onChange={(e) => setForm({ ...form, ngay_bat_dau: e.target.value })} />
          )}
        </div>

        <div>
          <Textarea label="Nội dung triển khai (mỗi dòng: Tên nội dung | Chi tiết)" rows={6}
            value={form.noi_dung} onChange={(e) => setForm({ ...form, noi_dung: e.target.value })}
            placeholder={"Phân tích & lựa chọn sản phẩm | Lựa chọn 20 sản phẩm phân bổ ngân sách\nLên & care quảng cáo | Care tối đa 20 sản phẩm"} />
          <p className="mt-1 text-xs text-ink-400">
            {form.noi_dung
              ? 'Đã tự điền theo gói khách chọn ở đơn dịch vụ — sửa lại nếu cần. '
              : 'Để trống nếu không cần bảng nội dung. '}
            Dùng dấu | ngăn giữa tên nội dung và chi tiết.
          </p>
        </div>

        {msg && <p className="text-sm text-rose-600">{msg}</p>}
        {daLuu && <p className="text-sm font-medium text-emerald-600">✓ {daLuu}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Hủy</Button>
          <Button type="button" variant="secondary" onClick={() => setXemTruoc(true)}>
            <Eye size={15} /> Xem trước
          </Button>
          <Button type="button" variant="secondary" onClick={luu} disabled={dangLuu || dangXuat}>
            <Save size={15} /> {dangLuu ? 'Đang lưu...' : 'Lưu'}
          </Button>
          <Button type="button" onClick={xuat} disabled={dangXuat}>
            <FileDown size={15} /> {dangXuat ? 'Đang tạo file...' : 'Tải hợp đồng Word'}
          </Button>
        </div>
      </div>

      {xemTruoc && (
        <ContractPreview hd={hdHienTai()} onClose={() => setXemTruoc(false)} />
      )}
    </Modal>
  )
}
