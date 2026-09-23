import { useEffect, useMemo, useState } from 'react'
import { Search, Pencil, ExternalLink, FileText, AlertTriangle, FileDown, Eye, Printer, Download, Trash2 } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { Button, Input, Select, Badge, Modal, Textarea } from './ui'
import { TRANG_THAI_HD_OPTIONS, classOf, labelOf, formatVnd, giaTruocVat } from '../lib/constants'
import { taoSoHopDong, laSoChuan, vietTat } from '../lib/docSo'
import ContractPreview from './ContractPreview'

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

export default function ContractsPage({ currentProfile }) {
  const [contracts, setContracts] = useState([])
  const [customers, setCustomers] = useState([])
  const [orders, setOrders] = useState([])
  const [items, setItems] = useState({})
  const [packages, setPackages] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterTT, setFilterTT] = useState('')
  const [filterSale, setFilterSale] = useState('')
  const [tuNgay, setTuNgay] = useState('')
  const [denNgay, setDenNgay] = useState('')
  const [editing, setEditing] = useState(null)
  const [xuatHD, setXuatHD] = useState(null)
  const [xemHD, setXemHD] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: ct }, { data: cu }, { data: od }, { data: it }, { data: pf }, { data: pk }] = await Promise.all([
      supabase.from('contracts').select('*').order('ngay_ky', { ascending: false }),
      supabase.from('customers').select('*'),
      supabase.from('orders').select('id, ma_don, sale_id'),
      supabase.from('order_items').select('*'),
      supabase.from('profiles').select('id, full_name'),
      supabase.from('service_packages').select('*'),
    ])
    setContracts(ct || []); setCustomers(cu || []); setOrders(od || []); setProfiles(pf || [])
    setPackages(pk || [])
    const g = {}
    for (const i of it || []) g[i.order_id] = [...(g[i.order_id] || []), i]
    setItems(g)
    setLoading(false)
  }

  const khach = (id) => customers.find((c) => c.id === id)
  const don = (id) => orders.find((o) => o.id === id)
  const tenSale = (id) => profiles.find((p) => p.id === id)?.full_name || '—'

  const homNay = new Date().toISOString().slice(0, 10)

  const filtered = useMemo(() => contracts.filter((c) => {
    if (filterTT && c.trang_thai !== filterTT) return false
    const d = don(c.order_id)
    if (filterSale && d?.sale_id !== filterSale) return false
    if (tuNgay && (!c.ngay_ky || c.ngay_ky < tuNgay)) return false
    if (denNgay && (!c.ngay_ky || c.ngay_ky > denNgay)) return false
    if (search) {
      const k = khach(c.customer_id)
      const dv = (items[c.order_id] || []).map((i) => i.ten_dich_vu).join(' ')
      if (!`${c.so_hop_dong} ${k?.ten_khach || ''} ${k?.sdt || ''} ${k?.ma_khach || ''} ${d?.ma_don || ''} ${dv}`
        .toLowerCase().includes(search.toLowerCase())) return false
    }
    return true
  }), [contracts, customers, orders, items, search, filterTT, filterSale, tuNgay, denNgay])

  const tongGiaTri = filtered.filter((c) => c.trang_thai !== 'da_huy')
    .reduce((s, c) => s + (Number(c.gia_tri) || 0), 0)
  const tongGiaTriTruocVat = filtered.filter((c) => c.trang_thai !== 'da_huy')
    .reduce((s, c) => s + giaTruocVat(c.gia_tri), 0)
  const sapHetHan = contracts.filter((c) => c.trang_thai === 'hieu_luc' && c.ngay_het_han
    && c.ngay_het_han >= homNay
    && c.ngay_het_han <= new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10))

  async function xoaHopDong(c) {
    if (!window.confirm(`Xoá hợp đồng ${c.so_hop_dong}? Không thể hoàn tác. Đơn dịch vụ liên quan vẫn được giữ nguyên.`)) return
    const { error } = await supabase.from('contracts').delete().eq('id', c.id)
    if (error) { window.alert('Không xoá được: ' + error.message); return }
    load()
  }

  async function taiExcel() {
    const XLSX = await import('xlsx')
    const rows = filtered.map((c) => {
      const k = khach(c.customer_id)
      const d = don(c.order_id)
      const dv = (items[c.order_id] || []).map((i) => `${i.ten_dich_vu}${i.ten_goi ? ' · ' + i.ten_goi : ''}`).join(', ')
      return {
        'Số hợp đồng': c.so_hop_dong,
        'Mã đơn': d?.ma_don || '',
        'Khách hàng': k?.ten_khach || '',
        'Mã KH': k?.ma_khach || '',
        'SĐT': k?.sdt || '',
        'Dịch vụ': dv,
        'Giá trị (đã VAT)': Number(c.gia_tri) || 0,
        'Giá trị (trước VAT)': giaTruocVat(c.gia_tri),
        'Ngày ký': c.ngay_ky || '',
        'Hết hạn': c.ngay_het_han || '',
        'Sale': tenSale(d?.sale_id),
        'Trạng thái': labelOf(TRANG_THAI_HD_OPTIONS, c.trang_thai),
      }
    })
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Hop dong')
    XLSX.writeFile(wb, `HopDong_${homNay}.xlsx`)
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="border-b border-slate-200 bg-white px-8 py-5 print:hidden">
        <h1 className="font-display text-xl font-bold text-navy-900">Hợp đồng</h1>
        <p className="text-sm text-ink-600">
          Hợp đồng tự sinh khi tạo đơn dịch vụ. Một khách có thể có nhiều hợp đồng.
        </p>
      </header>

      <h2 className="hidden px-8 pt-6 font-display text-lg font-bold text-navy-900 print:block">
        Danh sách hợp đồng
      </h2>

      <div className="grid grid-cols-3 gap-4 px-8 pt-6 print:hidden">
        <StatCard label="Tổng hợp đồng" value={filtered.length} />
        <StatCard label="Tổng giá trị (chưa VAT)" value={formatVnd(tongGiaTriTruocVat)} accent="coral" />
        <StatCard label="Sắp hết hạn trong 30 ngày" value={sapHetHan.length}
          accent={sapHetHan.length ? 'amber' : 'teal'} />
      </div>

      {sapHetHan.length > 0 && (
        <div className="mx-8 mt-4 flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 print:hidden">
          <AlertTriangle size={16} className="mt-0.5 flex-none" />
          <div>
            <b>{sapHetHan.length} hợp đồng sắp hết hạn</b> — đây là cơ hội tái ký, nên liên hệ khách trước khi hết hạn:{' '}
            {sapHetHan.slice(0, 5).map((c) => khach(c.customer_id)?.ten_khach).filter(Boolean).join(', ')}
            {sapHetHan.length > 5 && `, và ${sapHetHan.length - 5} khách khác`}
          </div>
        </div>
      )}

      <div className="mx-8 mt-6 flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 shadow-sm print:hidden">
        <div className="relative min-w-[220px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <Input placeholder="Tìm theo số HĐ, khách hàng, SĐT, mã đơn, dịch vụ..." value={search}
            onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterTT} onChange={(e) => setFilterTT(e.target.value)} className="w-44">
          <option value="">Tất cả trạng thái</option>
          {TRANG_THAI_HD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
        <Select value={filterSale} onChange={(e) => setFilterSale(e.target.value)} className="w-44">
          <option value="">Tất cả sale</option>
          {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
        </Select>
        <div className="flex items-center gap-1.5">
          <Input type="date" value={tuNgay} onChange={(e) => setTuNgay(e.target.value)} className="w-36" title="Ký từ ngày" />
          <span className="text-ink-400">—</span>
          <Input type="date" value={denNgay} onChange={(e) => setDenNgay(e.target.value)} className="w-36" title="Đến ngày" />
        </div>
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="secondary" onClick={() => window.print()}>
            <Printer size={15} /> In
          </Button>
          <Button type="button" variant="secondary" onClick={taiExcel}>
            <Download size={15} /> Tải Excel
          </Button>
        </div>
      </div>

      <div className="mx-8 my-6 overflow-x-auto rounded-2xl bg-white shadow-sm print:mx-0 print:shadow-none">
        <table className="w-full min-w-[1000px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-ink-400">
              <th className="px-5 py-3">Số hợp đồng</th>
              <th className="px-5 py-3">Khách hàng</th>
              <th className="px-5 py-3">Dịch vụ</th>
              <th className="px-5 py-3 text-right">Giá trị</th>
              <th className="px-5 py-3">Ngày ký</th>
              <th className="px-5 py-3">Hết hạn</th>
              <th className="px-5 py-3">Sale</th>
              <th className="px-5 py-3">Trạng thái</th>
              <th className="px-5 py-3 print:hidden"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="px-5 py-8 text-center text-ink-400">Đang tải...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9} className="px-5 py-8 text-center text-ink-400">
                {contracts.length === 0
                  ? 'Chưa có hợp đồng nào. Hợp đồng sẽ tự tạo khi bạn tạo đơn dịch vụ.'
                  : 'Không tìm thấy hợp đồng phù hợp.'}
              </td></tr>
            ) : filtered.map((c) => {
              const k = khach(c.customer_id)
              const d = don(c.order_id)
              const hetHanSom = c.trang_thai === 'hieu_luc' && c.ngay_het_han && c.ngay_het_han < homNay
              return (
                <tr key={c.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <button
                      onClick={() => (c.loai_dich_vu ? setXemHD(c) : setXuatHD(c))}
                      className="text-left font-medium text-navy-900 hover:text-coral-500 hover:underline print:no-underline print:text-navy-900"
                      title="Bấm để xem hợp đồng">
                      {c.so_hop_dong}
                    </button>
                    {d && <p className="text-xs text-ink-400">Đơn {d.ma_don}</p>}
                  </td>
                  <td className="px-5 py-3">
                    <p className="text-navy-900">{k?.ten_khach || '—'}</p>
                    <p className="text-xs text-ink-400">{k?.ma_khach}{k?.ma_khach && k?.sdt ? ' · ' : ''}{k?.sdt}</p>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(items[c.order_id] || []).map((i) => (
                        <Badge key={i.id} className="bg-slate-100 text-slate-600">
                          {i.ten_dich_vu}{i.ten_goi ? ` · ${i.ten_goi}` : ''}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right font-medium text-navy-900">{formatVnd(c.gia_tri)}</td>
                  <td className="px-5 py-3 text-ink-600">{c.ngay_ky || '—'}</td>
                  <td className="px-5 py-3">
                    <span className={hetHanSom ? 'text-rose-500' : 'text-ink-600'}>
                      {c.ngay_het_han || '—'}
                    </span>
                    {c.thoi_han_thang && <p className="text-xs text-ink-400">{c.thoi_han_thang} tháng</p>}
                  </td>
                  <td className="px-5 py-3 text-ink-600">{tenSale(d?.sale_id)}</td>
                  <td className="px-5 py-3">
                    <Badge className={classOf(TRANG_THAI_HD_OPTIONS, c.trang_thai)}>
                      {labelOf(TRANG_THAI_HD_OPTIONS, c.trang_thai)}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-right print:hidden">
                    {c.file_url && (
                      <a href={c.file_url} target="_blank" rel="noreferrer"
                        className="mr-3 inline-flex text-teal-500 hover:text-teal-600" title="Mở file hợp đồng">
                        <ExternalLink size={14} />
                      </a>
                    )}
                    {c.loai_dich_vu && (
                      <button onClick={() => setXemHD(c)}
                        className="mr-3 inline-flex items-center gap-1 text-xs text-navy-700 hover:text-navy-900" title="Xem trước hợp đồng">
                        <Eye size={14} /> Xem
                      </button>
                    )}
                    <button onClick={() => setXuatHD(c)}
                      className="mr-3 inline-flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700" title="Xuất file hợp đồng">
                      <FileDown size={14} /> Xuất
                    </button>
                    <button onClick={() => setEditing(c)}
                      className="mr-3 text-ink-400 hover:text-coral-500" title="Sửa hợp đồng">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => xoaHopDong(c)}
                      className="text-ink-400 hover:text-rose-500" title="Xoá hợp đồng">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {xuatHD && (
        <XuatHopDongForm
          contract={xuatHD}
          khach={khach(xuatHD.customer_id)}
          don={don(xuatHD.order_id)}
          dichVu={items[xuatHD.order_id] || []}
          packages={packages}
          onClose={() => setXuatHD(null)}
          onSaved={() => { setXuatHD(null); load() }}
        />
      )}

      {editing && (
        <ContractForm contract={editing} khach={khach(editing.customer_id)}
          onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />
      )}

      {xemHD && (
        <ContractPreview
          hd={hdTuHopDongDaLuu(xemHD, khach(xemHD.customer_id))}
          onClose={() => setXemHD(null)}
        />
      )}
    </div>
  )
}

export function XuatHopDongForm({ contract, khach, don, dichVu, packages, onClose, onSaved }) {
  const laXayShop = (dichVu || []).some((d) => /xây shop|tối ưu/i.test(d.ten_dich_vu))
  const [loaiDV, setLoaiDV] = useState(contract.loai_dich_vu || (laXayShop ? 'xay_shop' : 'ads'))
  const [vtat, setVtat] = useState(khach?.ten_viet_tat || vietTat(khach?.ten_khach))
  const goiKhop0 = timGoiKhop(loaiDV, dichVu, packages)
  const [form, setForm] = useState({
    ngay_ky: contract.ngay_ky || new Date().toISOString().slice(0, 10),
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
    noi_dung: goiKhop0?.noi_dung_hd || '',  // mỗi dòng: "Nội dung | Chi tiết" — tự điền theo gói, sửa được
  })
  const [dangXuat, setDangXuat] = useState(false)
  const [msg, setMsg] = useState('')
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

  // Số tạm (HD-YYYYMM-NNN) tự sinh lúc tạo đơn sẽ được thay bằng số chuẩn
  // DDMMYY/HĐDV/TUKIADS|TUKISELLER-Mã KH ngay lần xuất đầu tiên; từ đó giữ nguyên,
  // không đổi số mỗi lần xuất lại nữa
  const soHD = laSoChuan(contract.so_hop_dong) ? contract.so_hop_dong : taoSoHopDong({
    loaiDichVu: loaiDV, ngay: form.ngay_ky,
    maKhach: khach?.ma_khach,
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

  async function xuat() {
    setDangXuat(true); setMsg('')
    // Lưu lại thông tin bên A vào khách + thông tin hợp đồng để lần sau khỏi nhập lại
    await supabase.from('customers').update({
      dia_chi: form.dia_chi || null, mst: form.mst || null,
      nguoi_dai_dien: form.nguoi_dai_dien || null, chuc_vu: form.chuc_vu || null,
      email: form.email || null, ten_viet_tat: vtat || null,
    }).eq('id', khach.id)
    await supabase.from('contracts').update({
      so_hop_dong: soHD, loai_dich_vu: loaiDV,
      so_luong_gian_hang: Number(form.so_luong_gian_hang) || 1,
      so_san_pham: form.so_san_pham ? Number(form.so_san_pham) : null,
      ten_goi: form.ten_goi || null,
      ngay_bat_dau: form.ngay_bat_dau || null,
      noi_dung_hd: form.noi_dung || null,
    }).eq('id', contract.id)

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
      setMsg('Lỗi tạo file: ' + e.message)
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
          {laSoChuan(contract.so_hop_dong) && (
            <span className="ml-1 text-xs text-ink-400">(giữ nguyên, không đổi khi xuất lại)</span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
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

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Hủy</Button>
          <Button type="button" variant="secondary" onClick={() => setXemTruoc(true)}>
            <Eye size={15} /> Xem trước
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

function ContractForm({ contract, khach, onClose, onSaved }) {
  const [form, setForm] = useState({
    so_hop_dong: contract.so_hop_dong || '',
    ngay_ky: contract.ngay_ky || '',
    thoi_han_thang: contract.thoi_han_thang || '',
    ngay_het_han: contract.ngay_het_han || '',
    trang_thai: contract.trang_thai || 'hieu_luc',
    file_url: contract.file_url || '',
    ghi_chu: contract.ghi_chu || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setSaving(true); setError('')
    const { error } = await supabase.from('contracts').update({
      so_hop_dong: form.so_hop_dong,
      ngay_ky: form.ngay_ky || null,
      thoi_han_thang: form.thoi_han_thang ? Number(form.thoi_han_thang) : null,
      ngay_het_han: form.ngay_het_han || null,
      trang_thai: form.trang_thai,
      file_url: form.file_url || null,
      ghi_chu: form.ghi_chu || null,
    }).eq('id', contract.id)
    setSaving(false)
    if (error) { setError(error.message); return }
    onSaved()
  }

  return (
    <Modal title={`Hợp đồng ${contract.so_hop_dong}`} onClose={onClose} wide>
      <form onSubmit={submit} className="grid grid-cols-2 gap-4">
        <div className="col-span-2 rounded-xl bg-slate-50 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-ink-400">Khách hàng</p>
          <p className="font-display font-semibold text-navy-900">{khach?.ten_khach || '—'}</p>
          <p className="text-sm text-ink-600">
            Giá trị {formatVnd(contract.gia_tri)} · lấy từ đơn dịch vụ, sửa ở trang Đơn dịch vụ
          </p>
        </div>

        <Input label="Số hợp đồng" value={form.so_hop_dong}
          onChange={(e) => setForm({ ...form, so_hop_dong: e.target.value })} />
        <Select label="Trạng thái" value={form.trang_thai}
          onChange={(e) => setForm({ ...form, trang_thai: e.target.value })}>
          {TRANG_THAI_HD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>

        <Input label="Ngày ký" type="date" value={form.ngay_ky}
          onChange={(e) => setForm({ ...form, ngay_ky: e.target.value })} />
        <Input label="Thời hạn (tháng)" type="number" min="0" value={form.thoi_han_thang}
          onChange={(e) => setForm({ ...form, thoi_han_thang: e.target.value })} />

        <div className="col-span-2">
          <Input label="Ngày hết hạn" type="date" value={form.ngay_het_han}
            onChange={(e) => setForm({ ...form, ngay_het_han: e.target.value })} />
          <p className="mt-1 text-xs text-ink-400">Để trống sẽ tự tính từ ngày ký + thời hạn.</p>
        </div>

        <div className="col-span-2">
          <Input label="Link file hợp đồng" value={form.file_url}
            onChange={(e) => setForm({ ...form, file_url: e.target.value })}
            placeholder="Link Google Drive bản scan hợp đồng đã ký..." />
        </div>

        <div className="col-span-2">
          <Textarea label="Ghi chú" rows={2} value={form.ghi_chu}
            onChange={(e) => setForm({ ...form, ghi_chu: e.target.value })} />
        </div>

        {error && <p className="col-span-2 text-sm text-rose-600">{error}</p>}

        <div className="col-span-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Hủy</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu hợp đồng'}</Button>
        </div>
      </form>
    </Modal>
  )
}

function StatCard({ label, value, accent = 'navy' }) {
  const accents = {
    navy: 'text-navy-900', coral: 'text-coral-500',
    teal: 'text-teal-500', amber: 'text-amber-600',
  }
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-400">{label}</p>
      <p className={`mt-1 font-display text-2xl font-bold ${accents[accent]}`}>{value}</p>
    </div>
  )
}
