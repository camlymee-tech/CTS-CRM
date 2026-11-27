import { layHet } from '../lib/layHet'
import { useEffect, useMemo, useState } from 'react'
import { Plus, Search, Link2, Store, Users2, Trash2, Settings2, ListPlus, Columns3, User, ArrowUp, ArrowDown, ArrowUpDown, Download, UserRoundCheck } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { Button, Input, Select, Badge, Phantrang } from './ui'
import CustomerForm from './CustomerForm'
import CustomerDetail from './CustomerDetail'
import OrderForm from './OrderForm'
import StatusesModal from './StatusesModal'
import DanhMucModal from './DanhMucModal'
import TaiKhachLenModal from './TaiKhachLenModal'
import ChiaKhachModal from './ChiaKhachModal'
import { laQuanLy, nhanSuXemDuoc, locNhanSu } from '../lib/quyen'
import { useTrangThai } from '../lib/StatusContext'
import { ngayLocal, gioNgay, traoDoiGanNhat, demLuotChamSoc, tongDoanhThu, sapXepKhach } from '../lib/danhSachKhach'
import {
  NEN_TANG_OPTIONS,
  DICH_VU_OPTIONS,
  LOAI_KHACH_OPTIONS,
  NGUON_KHACH_OPTIONS,
  LOAI_TUONG_TAC_OPTIONS,
  classOf,
  labelOf,
} from '../lib/constants'

// Khách "chung" — cả team đều xem được (khớp với hàm la_khach_chung trong database)


const chuanSo = (v) => { const d = String(v || '').replace(/\D/g, ''); return /^84\d{9,10}$/.test(d) ? '0' + d.slice(2) : d }
const chiSo = chuanSo


// Tìm khách: khớp chữ thường, hoặc khớp số điện thoại không phân biệt dấu cách / chấm / gạch
const khopTim = (c, search) => {
  const q = search.toLowerCase().trim()
  if (`${c.ten_khach} ${c.ma_khach} ${c.sdt || ''} ${c.nganh_hang || ''}`.toLowerCase().includes(q)) return true
  const so = q.replace(/\D/g, '')
  if (so.length < 3) return false
  const cs = chuanSo(c.sdt)
  return cs.includes(so) || cs.includes(chuanSo(q)) || chuanSo(c.sdt).includes(so)
}

export default function CustomerList({ currentProfile }) {
  const { options: TRANG_THAI, tenTrangThai, classTrangThai, laKhachChung, maHoanHuy } = useTrangThai()
  const [quanLyTT, setQuanLyTT] = useState(false)
  const [quanLyDM, setQuanLyDM] = useState(false)
  const [donMoiKhach, setDonMoiKhach] = useState(null)

  // Các cột có thể bật/tắt (Khách hàng và Thao tác luôn hiển thị). sapXep = bấm tiêu đề để sắp xếp.
  // Mặc định hiện đúng bộ cột như mẫu: STT, SĐT, Người phụ trách, Trao đổi gần nhất, Vấn đề, Nguồn, Tổng doanh thu
  // + cột "Chăm sóc" (trạng thái, lịch hẹn tiếp theo, số lượt đã chăm sóc)
  const COT = [
    { key: 'stt', label: '#' },
    { key: 'sdt', label: 'Điện thoại', sapXep: 'sdt' },
    { key: 'sale', label: 'Tên sale', sapXep: 'sale' },
    { key: 'phong_ban', label: 'Phòng ban' },
    { key: 'trao_doi', label: 'Trao đổi gần nhất', sapXep: 'trao_doi' },
    { key: 'cham_soc', label: 'Trạng thái' },
    { key: 'khu_vuc', label: 'Khu vực', macDinh: false },
    { key: 'nen_tang', label: 'Nền tảng', macDinh: false },
    { key: 'loai', label: 'Loại', macDinh: false },
    { key: 'ngay_tao', label: 'Ngày tạo data', macDinh: false },
    { key: 'lien_he', label: 'Liên hệ gần nhất', macDinh: false },
    { key: 'giai_phap', label: 'Giải pháp', macDinh: false },
    { key: 'nhat_ky', label: 'Cập nhật gần nhất', macDinh: false },
  ]
  const KHOA_LUU_COT = 'tuki_cot_khach_v4'   // đổi khoá để áp bộ cột mặc định mới 1 lần
  const [cotHien, setCotHien] = useState(() => {
    try {
      const luu = JSON.parse(localStorage.getItem(KHOA_LUU_COT) || 'null')
      if (luu) return luu
    } catch { /* bo qua */ }
    return Object.fromEntries(COT.map((c) => [c.key, c.macDinh !== false]))
  })
  const [moChonCot, setMoChonCot] = useState(false)
  const [chiaMode, setChiaMode] = useState(null)   // 'chon' | 'nghi'
  const [nhatKyGanNhat, setNhatKyGanNhat] = useState({})
  const [interactions, setInteractions] = useState([])
  const [donHang, setDonHang] = useState([])
  const [sapXep, setSapXep] = useState({ cot: '', dir: 'desc' })
  const [daChon, setDaChon] = useState(() => new Set())
  const [doRong, setDoRong] = useState(() => {
    try { return JSON.parse(localStorage.getItem('tuki_do_rong_cot') || '{}') } catch { return {} }
  })
  function luuDoRong(key, px) {
    setDoRong((cu) => {
      const moi = { ...cu, [key]: px }
      try { localStorage.setItem('tuki_do_rong_cot', JSON.stringify(moi)) } catch { /* bo qua */ }
      return moi
    })
  }
  const hien = (k) => cotHien[k] !== false
  function toggleCot(k) {
    const moi = { ...cotHien, [k]: !hien(k) }
    setCotHien(moi)
    try { localStorage.setItem(KHOA_LUU_COT, JSON.stringify(moi)) } catch { /* bo qua */ }
  }
  const soCot = 3 + COT.filter((c) => hien(c.key)).length  // ô chọn + Khách hàng + Thao tác + cột bật
  const [customers, setCustomers] = useState([])
  const [phoneHits, setPhoneHits] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterLoai, setFilterLoai] = useState('')
  const [filterTrangThai, setFilterTrangThai] = useState('')
  const [filterSale, setFilterSale] = useState('')
  const [filterPhong, setFilterPhong] = useState('')
  const phongBanCua = (id) => profiles.find((p) => p.id === id)?.phong_ban || ''
  const [filterDichVu, setFilterDichVu] = useState('')
  const [filterNguon, setFilterNguon] = useState('')
  const [tuNgay, setTuNgay] = useState('')
  const [denNgay, setDenNgay] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [taiLen, setTaiLen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [viewingCustomer, setViewingCustomer] = useState(null)


  useEffect(() => {
    loadProfiles()
    loadCustomers()
  }, [])

  async function xoaKhach(c) {
    const canhBao = isAdmin
      ? `Xoá khách "${c.ten_khach}"?\n\nToàn bộ ĐƠN DỊCH VỤ, HỢP ĐỒNG, lịch sử chăm sóc và nhật ký của khách này cũng bị xoá vĩnh viễn. Doanh số từ khách này sẽ không còn trong báo cáo. Không khôi phục được.`
      : `Xoá khách "${c.ten_khach}"?\n\nToàn bộ lịch sử chăm sóc và nhật ký của khách này cũng bị xoá. Không khôi phục được.`
    if (!window.confirm(canhBao)) return
    const { error } = await supabase.from('customers').delete().eq('id', c.id)
    if (error) {
      alert(error.message.includes('KHACH_CO_DON')
        ? `Khách "${c.ten_khach}" đã có đơn dịch vụ. Chỉ quản trị viên mới xoá được khách này.`
        : 'Không xoá được: ' + error.message)
      return
    }
    loadCustomers()
  }


  // Gõ đủ số điện thoại -> tra cứu được cả khách của sale khác
  useEffect(() => {
    const so = chiSo(search)
    if (so.length < 8) { setPhoneHits([]); return }
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc('tim_khach_theo_sdt', { p_sdt: search })
      // Chỉ nhận hồ sơ được phép xem (hoặc khách đã chốt); hồ sơ của người khác bị ẩn thông tin
      setPhoneHits((data || []).map((r) => r.thong_tin).filter(Boolean))
    }, 400)
    return () => clearTimeout(t)
  }, [search])

  async function loadProfiles() {
    const { data } = await supabase.from('profiles').select('*').order('full_name')
    setProfiles(data || [])
  }

  async function loadCustomers() {
    setLoading(true)
    const { data } = await layHet(() => supabase.from('customers').select('*').order('created_at', { ascending: false }).order('id'))
    setCustomers(data || [])
    setLoading(false)
    // Lấy dòng nhật ký mới nhất cho mỗi khách (để hiện cột "Cập nhật gần nhất")
    const { data: logs } = await layHet(() => supabase.from('customer_logs')
      .select('customer_id, hanh_dong, user_id, created_at')
      .order('created_at', { ascending: false }).order('id'))
    const map = {}
    for (const l of logs || []) if (!map[l.customer_id]) map[l.customer_id] = l
    setNhatKyGanNhat(map)
    // Lịch sử chăm sóc (cho cột Trao đổi gần nhất / Chăm sóc) và đơn hàng (cho Tổng doanh thu)
    const [{ data: its }, { data: dh }] = await Promise.all([
      layHet(() => supabase.from('customer_interactions')
        .select('customer_id, sale_id, loai, noi_dung, ngay_thuc_hien, created_at')
        .order('ngay_thuc_hien', { ascending: false }).order('id')),
      layHet(() => supabase.from('orders').select('customer_id, gia_tri, trang_thai').order('id')),
    ])
    setInteractions(its || [])
    setDonHang(dh || [])
  }

  const isAdmin = currentProfile?.role === 'admin'
  const uids = useMemo(() => nhanSuXemDuoc(currentProfile, profiles), [currentProfile, profiles])   // null = xem tất cả
  const dsSale = useMemo(() => locNhanSu(currentProfile, profiles), [currentProfile, profiles])   // admin: tất cả · leader: team · sale: chính mình
  const xemDuoc = (id) => uids === null || (!!id && uids.has(id))

  // Đếm số hồ sơ cùng số điện thoại (trong danh sách người xem được) để gắn nhãn "Trùng SĐT"
  const demTrung = useMemo(() => {
    const m = new Map()
    for (const c of customers) {
      const so = chuanSo(c.sdt)
      if (so.length >= 8) m.set(so, (m.get(so) || 0) + 1)
    }
    return m
  }, [customers])

  // Bấm "Mở hồ sơ" trong khung hồ sơ trùng → mở hồ sơ kia
  useEffect(() => {
    const mo = (e) => {
      const k = customers.find((c) => c.id === e.detail)
      if (k) setViewingCustomer(k)
    }
    window.addEventListener('mo-ho-so', mo)
    return () => window.removeEventListener('mo-ho-so', mo)
  }, [customers])

  // Gộp kết quả tra cứu SĐT vào danh sách, không trùng lặp
  const nguon = useMemo(() => {
    const map = new Map(customers.map((c) => [c.id, c]))
    for (const c of phoneHits) if (!map.has(c.id)) map.set(c.id, { ...c, _tuTraCuu: true })
    return [...map.values()]
  }, [customers, phoneHits])

  const filtered = useMemo(() => {
    return nguon.filter((c) => {
      if (search && !khopTim(c, search)) {
        if (!c._tuTraCuu) return false
      }
      if (filterLoai && c.loai_khach !== filterLoai) return false
      if (filterTrangThai && c.trang_thai_cham_soc !== filterTrangThai) return false
      if (filterSale && c.sale_id !== filterSale) return false
      if (filterPhong && phongBanCua(c.sale_id) !== filterPhong) return false
      if (filterDichVu && !(c.dich_vu || []).includes(filterDichVu)) return false
      if (filterNguon && c.nguon_khach !== filterNguon) return false
      const ngayTao = ngayLocal(c.created_at)
      if (tuNgay && (!ngayTao || ngayTao < tuNgay)) return false
      if (denNgay && (!ngayTao || ngayTao > denNgay)) return false
      return true
    })
  }, [nguon, search, filterLoai, filterTrangThai, filterSale, filterPhong, profiles, filterDichVu, filterNguon, tuNgay, denNgay, isAdmin, currentProfile?.id])

  // Danh sách áp dụng mọi bộ lọc TRỪ bộ lọc trạng thái,
  // để mỗi thẻ trạng thái vẫn hiện đúng số khi đang chọn một trạng thái
  const nenDem = useMemo(() => nguon.filter((c) => {
    if (!xemDuoc(c.sale_id)) return false
    if (search && !khopTim(c, search)) {
      if (!c._tuTraCuu) return false
    }
    if (filterLoai && c.loai_khach !== filterLoai) return false
    if (filterSale && c.sale_id !== filterSale) return false
    if (filterPhong && phongBanCua(c.sale_id) !== filterPhong) return false
    if (filterDichVu && !(c.dich_vu || []).includes(filterDichVu)) return false
    if (filterNguon && c.nguon_khach !== filterNguon) return false
    const ngayTao = ngayLocal(c.created_at)
    if (tuNgay && (!ngayTao || ngayTao < tuNgay)) return false
    if (denNgay && (!ngayTao || ngayTao > denNgay)) return false
    return true
  }), [nguon, uids, currentProfile?.id, search, filterLoai, filterSale, filterPhong, profiles, filterDichVu, filterNguon, tuNgay, denNgay])

  const demTheoTrangThai = useMemo(() => {
    const m = {}
    for (const o of TRANG_THAI) m[o.ma] = 0
    for (const c of nenDem) if (m[c.trang_thai_cham_soc] !== undefined) m[c.trang_thai_cham_soc] += 1
    return m
  }, [nenDem, TRANG_THAI])


  const dsPhongBan = useMemo(() => [...new Set((laQuanLy(currentProfile) ? dsSale : profiles).map((p) => p.phong_ban).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi')), [dsSale, profiles, currentProfile])
  const profileName = (id) => profiles.find((p) => p.id === id)?.full_name || 'Chưa gán'

  const traoDoi = useMemo(() => traoDoiGanNhat(interactions), [interactions])
  const luotCS = useMemo(() => demLuotChamSoc(interactions), [interactions])
  const doanhThu = useMemo(
    () => tongDoanhThu(donHang, new Set(customers.filter((c) => maHoanHuy.includes(c.trang_thai_cham_soc)).map((c) => c.id))),
    [donHang, customers, maHoanHuy],
  )

  const daSapXep = useMemo(
    () => sapXepKhach(filtered, sapXep.cot, sapXep.dir, {
      tenSale: (id) => profiles.find((p) => p.id === id)?.full_name || '',
      tenNguon: (v) => labelOf(NGUON_KHACH_OPTIONS, v) || '',
      traoDoi, doanhThu, luotCS,
    }),
    [filtered, sapXep, profiles, traoDoi, doanhThu, luotCS],
  )

  function doiSapXep(cot) {
    setSapXep((s) => (s.cot === cot ? { cot, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { cot, dir: cot === 'doanh_thu' || cot === 'trao_doi' ? 'desc' : 'asc' }))
  }

  const [trang, setTrang] = useState(1)
  useEffect(() => { setTrang(1) }, [search, filterLoai, filterTrangThai, filterSale, filterPhong, filterDichVu, filterNguon, tuNgay, denNgay, sapXep])
  const phanTrang = useMemo(() => daSapXep.slice((trang - 1) * 20, trang * 20), [daSapXep, trang])

  // Tải Excel: các khách đã tích chọn, hoặc toàn bộ kết quả đang lọc nếu chưa chọn khách nào
  async function taiExcel() {
    const ds = daChon.size > 0 ? daSapXep.filter((c) => daChon.has(c.id)) : daSapXep
    const XLSX = await import('xlsx')
    const rows = ds.map((c, i) => {
      const td = traoDoi[c.id]
      return {
        '#': i + 1,
        'Mã KH': c.ma_khach,
        'Tên khách hàng': c.ten_khach,
        'Điện thoại': c.sdt || '',
        'Tên sale': profileName(c.sale_id),
        'Phòng ban': phongBanCua(c.sale_id),
        'Trạng thái': tenTrangThai(c.trang_thai_cham_soc),
        'Hẹn chăm sóc tiếp': c.ngay_cham_soc_tiep_theo || '',
        'Số lượt chăm sóc': luotCS[c.id] || 0,
        'Trao đổi gần nhất': td ? `${profileName(td.nguoi)} (${gioNgay(td.thoiGian)}): ${td.noiDung}` : '',
        'Nguồn khách hàng': labelOf(NGUON_KHACH_OPTIONS, c.nguon_khach) || '',
        'Ngày tạo': ngayLocal(c.created_at),
        'Tổng doanh thu (chưa VAT)': doanhThu[c.id] || 0,
      }
    })
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Khach hang')
    XLSX.writeFile(wb, `KhachHang_${ngayLocal(new Date())}.xlsx`)
  }

  // Xoá nhiều khách cùng lúc: chỉ quản trị viên
  async function xoaNhieu() {
    if (!isAdmin || daChon.size === 0) return
    const ids = [...daChon]
    const ok = window.confirm(
      `Xoá ${ids.length} khách đã chọn?\n\nToàn bộ ĐƠN DỊCH VỤ, HỢP ĐỒNG, lịch sử chăm sóc và nhật ký của các khách này cũng bị xoá vĩnh viễn. Doanh số từ các khách này sẽ không còn trong báo cáo. Không khôi phục được.`
    )
    if (!ok) return
    for (let i = 0; i < ids.length; i += 100) {
      const { error } = await supabase.from('customers').delete().in('id', ids.slice(i, i + 100))
      if (error) { alert('Không xoá được: ' + error.message); loadCustomers(); return }
    }
    setDaChon(new Set())
    loadCustomers()
  }

  // Chọn nhiều khách (ô tích đầu dòng)
  const chonTatCaTrang = phanTrang.length > 0 && phanTrang.every((c) => daChon.has(c.id))
  function toggleChon(id) {
    setDaChon((cu) => { const m = new Set(cu); m.has(id) ? m.delete(id) : m.add(id); return m })
  }
  function toggleChonTrang() {
    setDaChon((cu) => {
      const m = new Set(cu)
      if (chonTatCaTrang) phanTrang.forEach((c) => m.delete(c.id))
      else phanTrang.forEach((c) => m.add(c.id))
      return m
    })
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-8 py-5">
        <div>
          <h1 className="font-display text-xl font-bold text-navy-900">Khách hàng</h1>
          <p className="text-sm text-ink-600">Quản lý & phân loại toàn bộ khách hàng của team sale</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Button variant="secondary" onClick={() => setQuanLyTT(true)}>
              <Settings2 size={16} /> Trạng thái
            </Button>
          )}
          {isAdmin && (
            <Button variant="secondary" onClick={() => setQuanLyDM(true)}>
              <ListPlus size={16} /> Nguồn & dịch vụ
            </Button>
          )}
          <Button onClick={() => { setEditingCustomer(null); setShowForm(true) }}>
            <Plus size={16} /> Thêm khách hàng
          </Button>
        </div>
      </header>

      <div className="grid gap-3 px-8 pt-6" style={{ gridTemplateColumns: `repeat(${Math.min(TRANG_THAI.length + 1, 8)}, minmax(0, 1fr))` }}>
        <StatCard
          label="Tổng khách hàng"
          value={nenDem.length}
          active={filterTrangThai === ''}
          onClick={() => setFilterTrangThai('')}
        />
        {TRANG_THAI.map((o) => (
          <StatCard
            key={o.ma}
            label={o.ten}
            value={demTheoTrangThai[o.ma] || 0}
            active={filterTrangThai === o.ma}
            onClick={() => setFilterTrangThai(filterTrangThai === o.ma ? '' : o.ma)}
          />
        ))}
      </div>
      <p className="px-8 pt-2 text-xs text-ink-400">
        Tổng khách theo từng trạng thái · {isAdmin ? 'toàn team' : 'khách của bạn'} · thay đổi theo bộ lọc bên dưới · bấm vào thẻ để lọc
      </p>

      <div className="mx-8 mt-6 space-y-3 rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <Input placeholder="Tìm theo tên, mã KH, SĐT, ngành hàng..." value={search}
              onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterTrangThai} onChange={(e) => setFilterTrangThai(e.target.value)} className="w-48">
            <option value="">Tất cả trạng thái</option>
            {TRANG_THAI.map((o) => <option key={o.ma} value={o.ma}>{o.ten}</option>)}
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={filterDichVu} onChange={(e) => setFilterDichVu(e.target.value)} className="w-48">
            <option value="">Tất cả dịch vụ</option>
            {DICH_VU_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
          <Select value={filterPhong} onChange={(e) => setFilterPhong(e.target.value)} className="w-48">
            <option value="">Tất cả phòng ban</option>
            {dsPhongBan.map((pb) => <option key={pb} value={pb}>{pb}</option>)}
          </Select>
          <Select value={filterSale} onChange={(e) => setFilterSale(e.target.value)} className="w-44">
            <option value="">Tất cả sale</option>
            {(laQuanLy(currentProfile) ? dsSale : profiles).map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </Select>
          <div className="flex items-center gap-2 text-sm text-ink-600">
            <span className="font-medium text-navy-900">Ngày tạo</span>
            <span>từ</span>
            <Input type="date" value={tuNgay} onChange={(e) => setTuNgay(e.target.value)} className="w-40" />
            <span>đến</span>
            <Input type="date" value={denNgay} onChange={(e) => setDenNgay(e.target.value)} className="w-40" />
          </div>
          {(search || filterLoai || filterTrangThai || filterSale || filterPhong || filterDichVu || filterNguon || tuNgay || denNgay) && (
            <button
              onClick={() => { setSearch(''); setFilterLoai(''); setFilterTrangThai(''); setFilterSale(''); setFilterPhong(''); setFilterDichVu(''); setFilterNguon(''); setTuNgay(''); setDenNgay('') }}
              className="text-sm text-ink-600 hover:text-coral-500">
              Xoá bộ lọc
            </button>
          )}
        </div>
      </div>

      <div className="mx-8 mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-600">
          <b className="text-navy-900">{filtered.length}</b> khách
          {daChon.size > 0 && (
            <>
              {' · '}đã chọn <b className="text-coral-600">{daChon.size}</b>
              <button type="button" onClick={() => setDaChon(new Set())} className="ml-2 text-xs text-ink-400 hover:text-coral-500">Bỏ chọn</button>
            </>
          )}
        </p>
        <div className="flex items-center gap-2">
          {laQuanLy(currentProfile) && daChon.size > 0 && (
            <button type="button" onClick={() => setChiaMode('chon')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-coral-500 bg-coral-500 px-3 py-1.5 text-sm text-white hover:bg-coral-600">
              <UserRoundCheck size={15} /> Chia {daChon.size} khách cho sale
            </button>
          )}
          {isAdmin && daChon.size > 0 && (
            <button type="button" onClick={xoaNhieu}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-sm text-rose-600 hover:bg-rose-50">
              <Trash2 size={15} /> Xoá {daChon.size} khách
            </button>
          )}
          <button type="button" onClick={taiExcel}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-ink-600 hover:border-coral-500 hover:text-coral-500">
            <Download size={15} /> {daChon.size > 0 ? `Tải Excel (${daChon.size} khách)` : 'Tải Excel'}
          </button>
        <div className="relative">
          <button onClick={() => setMoChonCot((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-ink-600 hover:border-coral-500 hover:text-coral-500">
            <Columns3 size={15} /> Cột hiển thị
          </button>
          {moChonCot && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMoChonCot(false)} />
              <div className="absolute right-0 z-20 mt-1 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                <p className="px-2 py-1 text-xs text-ink-400">Chọn cột muốn hiển thị</p>
                {COT.map((c) => (
                  <label key={c.key} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                    <input type="checkbox" checked={hien(c.key)} onChange={() => toggleCot(c.key)}
                      className="h-4 w-4 rounded border-slate-300" />
                    <span className="text-navy-900">{c.label}</span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
        </div>
      </div>

      <div className="mx-8 mb-6 mt-2 overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="border-collapse w-full text-sm" style={{ tableLayout: 'auto' }}>
          <thead>
            <tr className="border-b border-slate-200 bg-slate-100 text-left text-sm font-semibold text-navy-900">
              <th className="border border-slate-200 w-10 px-2.5 py-3">
                <input type="checkbox" checked={chonTatCaTrang} onChange={toggleChonTrang}
                  className="h-4 w-4 rounded border-slate-300" title="Chọn / bỏ chọn các khách trên trang này" />
              </th>
              {hien('stt') && <ThResize colKey="stt" doRong={doRong} onResize={luuDoRong}>#</ThResize>}
              <ThResize colKey="ten" doRong={doRong} onResize={luuDoRong}>Tên khách hàng</ThResize>
              {COT.filter((c) => c.key !== 'stt' && hien(c.key)).map((c) => (
                <ThResize key={c.key} colKey={c.key} doRong={doRong} onResize={luuDoRong}
                  sapXep={c.sapXep} dangSapXep={sapXep.cot === c.sapXep ? sapXep.dir : null}
                  onSapXep={() => doiSapXep(c.sapXep)}
                  tieuDeNho={c.key === 'doanh_thu' ? 'Chưa VAT, trừ đơn huỷ' : undefined}>
                  {c.label}
                </ThResize>
              ))}
              <th className="border border-slate-200 px-2.5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={soCot} className="border border-slate-200 px-5 py-8 text-center text-ink-400">Đang tải...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={soCot} className="border border-slate-200 px-5 py-8 text-center text-ink-400">Chưa có khách hàng nào phù hợp.</td></tr>
            ) : phanTrang.map((c, idxTrang) => {
              const idx = (trang - 1) * 20 + idxTrang
              const chung = laKhachChung(c)
              const cuaMinh = c.sale_id === currentProfile?.id || (!isAdmin && !!c.sale_id && !!uids?.has(c.sale_id))
              const dongChon = daChon.has(c.id)
              const mauTT = TRANG_THAI.find((o) => o.ma === c.trang_thai_cham_soc)?.mau
              const td = traoDoi[c.id]
              const soCS = luotCS[c.id] || 0
              const hen = c.ngay_cham_soc_tiep_theo
              const homNay = ngayLocal(new Date())
              return (
                <tr key={c.id}
                  className={`cursor-pointer border-b border-slate-200 last:border-0 hover:bg-sky-50/60 ${
                    dongChon ? 'bg-sky-50' : idx % 2 === 1 ? 'bg-slate-50' : 'bg-white'
                  }`}
                  onClick={() => setViewingCustomer(c)}>
                  <td className={`relative w-10 border-l-4 px-2.5 py-3 ${VIEN_TRANG_THAI[mauTT] || 'border-slate-300'}`}
                    style={{ borderTop: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }}
                    onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={dongChon} onChange={() => toggleChon(c.id)}
                      className="h-4 w-4 rounded border-slate-300" />
                  </td>
                  {hien('stt') && <td className="border border-slate-200 px-2.5 py-3 text-ink-600">{idx + 1}</td>}
                  <td className="border border-slate-200 px-2.5 py-3" style={{ maxWidth: doRong.ten || 170 }}>
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-indigo-100 text-indigo-300">
                        <User size={20} fill="currentColor" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate font-medium text-indigo-800">{c.ten_khach}</p>
                          {soCS > 0 && (
                            <span title={`${soCS} lượt chăm sóc đã ghi`}
                              className="inline-flex h-5 min-w-[1.25rem] flex-none items-center justify-center rounded-full bg-coral-500 px-1.5 text-[11px] font-semibold text-white">
                              {soCS}
                            </span>
                          )}
                          {chung && !cuaMinh && (
                            <span title="Khách chung — cả team đều xem được">
                              <Users2 size={13} className="text-amber-500" />
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-ink-400">
                          <span>{c.ma_khach}</span>
                          {c.link_fb && (
                            <a href={c.link_fb} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-0.5 text-teal-500 hover:underline">
                              <Link2 size={10} /> FB
                            </a>
                          )}
                          {c.link_shop && (
                            <a href={c.link_shop} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-0.5 text-teal-500 hover:underline">
                              <Store size={10} /> Shop
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  {hien('sdt') && (
                    <td className="border border-slate-200 px-2.5 py-3 font-medium text-indigo-800">
                      {c.sdt || <span className="text-ink-400">—</span>}
                      {(demTrung.get(chuanSo(c.sdt)) || 0) > 1 && (
                        <button type="button" title="Lọc các hồ sơ cùng số này"
                          onClick={(e) => { e.stopPropagation(); setSearch(c.sdt) }}
                          className="mt-1 block rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 hover:bg-amber-200">
                          Trùng SĐT · {demTrung.get(chuanSo(c.sdt))} hồ sơ
                        </button>
                      )}
                    </td>
                  )}
                  {hien('sale') && <td className="border border-slate-200 px-2.5 py-3 text-navy-900">{profileName(c.sale_id)}</td>}
                  {hien('phong_ban') && <td className="border border-slate-200 px-2.5 py-3 text-navy-900">{phongBanCua(c.sale_id) || '—'}</td>}
                  {hien('trao_doi') && (
                    <td className="border border-slate-200 px-2.5 py-3" style={{ minWidth: 260, maxWidth: doRong.trao_doi || 420 }}>
                      {!td ? <span className="text-ink-400">—</span> : (
                        <div>
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="font-semibold text-indigo-800">{profileName(td.nguoi)}</span>
                            <span className="flex-none whitespace-nowrap text-xs text-ink-600">{gioNgay(td.thoiGian)}</span>
                          </div>
                          <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-navy-900">
                            <span className="mr-1 text-xs font-medium text-teal-600">
                              [{labelOf(LOAI_TUONG_TAC_OPTIONS, td.loai)}]
                            </span>
                            {td.noiDung}
                          </p>
                        </div>
                      )}
                    </td>
                  )}
                  {hien('cham_soc') && (
                    <td className="border border-slate-200 px-2.5 py-3" style={{ minWidth: 130 }}>
                      <Badge className={`${classTrangThai(c.trang_thai_cham_soc)}`}>{tenTrangThai(c.trang_thai_cham_soc)}</Badge>
                      <p className="mt-1 whitespace-nowrap text-xs text-ink-600">
                        {hen
                          ? <span className={hen < homNay ? 'font-medium text-rose-600' : hen === homNay ? 'font-medium text-coral-600' : ''}>
                              Hẹn {hen.split('-').reverse().join('/')}{hen < homNay ? ' · trễ' : hen === homNay ? ' · hôm nay' : ''}
                            </span>
                          : <span className="text-ink-400">Chưa đặt lịch hẹn</span>}
                      </p>
                    </td>
                  )}
                  {hien('khu_vuc') && <td className="border border-slate-200 px-2.5 py-3 text-navy-900">{c.khu_vuc || '—'}</td>}
                  {hien('nen_tang') && (
                  <td className="border border-slate-200 px-2.5 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(c.nen_tang || []).map((nt) => (
                        <Badge key={nt} className={classOf(NEN_TANG_OPTIONS, nt)}>{labelOf(NEN_TANG_OPTIONS, nt)}</Badge>
                      ))}
                    </div>
                  </td>)}
                  {hien('loai') && (
                  <td className="border border-slate-200 px-2.5 py-3">
                    <Badge className={c.loai_khach === 'moi' ? 'bg-coral-50 text-coral-600' : 'bg-slate-100 text-slate-600'}>
                      {labelOf(LOAI_KHACH_OPTIONS, c.loai_khach)}
                    </Badge>
                  </td>)}
                  {hien('ngay_tao') && <td className="border border-slate-200 px-2.5 py-3 text-ink-600">{ngayLocal(c.created_at) || '—'}</td>}
                  {hien('lien_he') && <td className="border border-slate-200 px-2.5 py-3 text-ink-600">{c.ngay_lien_he_gan_nhat || '—'}</td>}
                  {hien('giai_phap') && (
                    <td className="border border-slate-200 px-2.5 py-3 text-ink-600" style={{ maxWidth: doRong.giai_phap || 220 }}>
                      <p className="line-clamp-2 whitespace-pre-wrap">{c.giai_phap || '—'}</p>
                    </td>
                  )}
                  {hien('nhat_ky') && (
                    <td className="border border-slate-200 px-2.5 py-3 text-ink-600">
                      {(() => {
                        const l = nhatKyGanNhat[c.id]
                        if (!l) return <span className="text-ink-400">—</span>
                        return (
                          <div style={{ maxWidth: doRong.nhat_ky || 200 }}>
                            <p className="truncate text-navy-900">{l.hanh_dong}</p>
                            <p className="text-xs text-ink-400">
                              {profileName(l.user_id)} · {new Date(l.created_at).toLocaleDateString('vi-VN')}
                            </p>
                          </div>
                        )
                      })()}
                    </td>
                  )}
                  <td className="border border-slate-200 whitespace-nowrap px-2.5 py-3 text-right">
                    {(isAdmin || cuaMinh) && (
                      <button onClick={(e) => { e.stopPropagation(); xoaKhach(c) }}
                        className="text-ink-400 hover:text-rose-500" title="Xoá khách hàng">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <Phantrang trang={trang} setTrang={setTrang} tong={filtered.length} />

      {quanLyTT && <StatusesModal onClose={() => setQuanLyTT(false)} />}
      {quanLyDM && <DanhMucModal onClose={() => setQuanLyDM(false)} />}

      {chiaMode && (
        <ChiaKhachModal mode={chiaMode} customers={customers} daChon={daChon} profiles={dsSale}
          onClose={() => setChiaMode(null)}
          onDone={() => { setDaChon(new Set()); loadCustomers() }} />
      )}

      {taiLen && (
        <TaiKhachLenModal customers={customers} profiles={dsSale} currentProfile={currentProfile}
          onClose={() => setTaiLen(false)} onDone={loadCustomers} />
      )}

      {showForm && (
        <CustomerForm
          customer={editingCustomer}
          profiles={laQuanLy(currentProfile) ? dsSale : profiles}
          currentProfile={currentProfile}
          onTaiFile={() => { setShowForm(false); setTaiLen(true) }}
          onClose={() => setShowForm(false)}
          onSaved={(khachVuaChot) => {
            setShowForm(false)
            loadCustomers()
            if (khachVuaChot) setDonMoiKhach(khachVuaChot)
          }}
        />
      )}

      {viewingCustomer && (
        <CustomerDetail
          key={viewingCustomer.id}
          customer={viewingCustomer}
          currentProfile={currentProfile}
          onClose={() => setViewingCustomer(null)}
          onChanged={loadCustomers}
        />
      )}

      {donMoiKhach && (
        <OrderForm
          customer={donMoiKhach}
          profiles={profiles}
          currentProfile={currentProfile}
          onClose={() => setDonMoiKhach(null)}
          onSaved={() => { setDonMoiKhach(null); loadCustomers() }}
        />
      )}
    </div>
  )
}

// Màu vạch dọc bên trái mỗi dòng theo trạng thái chăm sóc (giống vạch xanh ở mẫu)
const VIEN_TRANG_THAI = {
  slate: 'border-slate-300', orange: 'border-orange-400', amber: 'border-amber-400', emerald: 'border-emerald-500',
  teal: 'border-teal-500', violet: 'border-violet-500', rose: 'border-rose-500', coral: 'border-coral-500',
  sky: 'border-sky-500', navy: 'border-navy-900',
}

function ThResize({ colKey, doRong, onResize, children, sapXep, dangSapXep, onSapXep, tieuDeNho }) {
  const rong = doRong[colKey]
  function batDauKeo(e) {
    e.preventDefault()
    e.stopPropagation()
    const th = e.currentTarget.closest('th')
    const xDau = e.clientX
    const rongDau = th.offsetWidth
    function keo(ev) {
      const moi = Math.max(60, rongDau + (ev.clientX - xDau))
      th.style.width = moi + 'px'
      th.style.maxWidth = moi + 'px'
    }
    function thoi() {
      document.removeEventListener('mousemove', keo)
      document.removeEventListener('mouseup', thoi)
      onResize(colKey, th.offsetWidth)
    }
    document.addEventListener('mousemove', keo)
    document.addEventListener('mouseup', thoi)
  }
  const Mui = dangSapXep === 'asc' ? ArrowUp : dangSapXep === 'desc' ? ArrowDown : ArrowUpDown
  return (
    <th className="border border-slate-200 relative select-none px-2.5 py-3"
      style={rong ? { width: rong, maxWidth: rong } : undefined}
      title={tieuDeNho}>
      {sapXep ? (
        <button type="button" onClick={onSapXep} className="inline-flex items-center gap-1.5 pr-2 hover:text-coral-600">
          <span className="truncate">{children}</span>
          <Mui size={14} className={dangSapXep ? 'text-coral-500' : 'text-ink-400'} />
        </button>
      ) : (
        <span className="block truncate pr-2">{children}</span>
      )}
      <span onMouseDown={batDauKeo}
        className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-coral-500/40"
        title="Kéo để chỉnh độ rộng" />
    </th>
  )
}

function StatCard({ label, value, active = false, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-3 py-3 text-left shadow-sm transition ${
        active ? 'bg-navy-900 ring-2 ring-coral-500' : 'bg-white hover:shadow-md'
      }`}
    >
      <p className={`text-[11px] font-medium leading-tight ${active ? 'text-white/60' : 'text-ink-400'}`}>{label}</p>
      <p className={`mt-1 font-display text-xl font-bold ${active ? 'text-white' : 'text-navy-900'}`}>{value}</p>
    </button>
  )
}
