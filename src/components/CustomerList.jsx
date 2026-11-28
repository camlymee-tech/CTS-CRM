// Trang Khách hàng: thẻ đếm theo trạng thái, bộ lọc, thanh thao tác (chia / xoá / Excel / cột), bảng khách.
// Bộ lọc: khachHang/BoLocKhach · một dòng bảng: khachHang/DongKhach · logic lọc / Excel: lib/danhSachKhach.
import { layHet } from '../lib/layHet'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Trash2, Settings2, ListPlus, Columns3, Download, UserRoundCheck } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { layNhanSu } from '../lib/nhanSu'
import { loiDeHieu } from '../lib/loi'
import { Button, Phantrang } from './ui'
import CustomerForm from './CustomerForm'
import CustomerDetail from './CustomerDetail'
import OrderForm from './OrderForm'
import StatusesModal from './StatusesModal'
import DanhMucModal from './DanhMucModal'
import TaiKhachLenModal from './TaiKhachLenModal'
import ChiaKhachModal from './ChiaKhachModal'
import BoLocKhach from './khachHang/BoLocKhach'
import DongKhach from './khachHang/DongKhach'
import { ThResize, StatCard } from './khachHang/PhanTu'
import { laAdmin, laQuanLy, nhanSuXemDuoc, locNhanSu } from '../lib/quyen'
import { useTrangThai } from '../lib/StatusContext'
import { chuanSo } from '../lib/sdt'
import {
  tongDoanhThu, sapXepKhach, locKhach, dongExcelKhach, BO_LOC_TRONG,
} from '../lib/danhSachKhach'
import { ngayLocal } from '../lib/ngay'
import { taiTomTatKhach } from '../lib/tomTatKhach'
import { NGUON_KHACH_OPTIONS, labelOf } from '../lib/constants'

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

export default function CustomerList({ currentProfile }) {
  const { options: TRANG_THAI, tenTrangThai, maHoanHuy } = useTrangThai()
  const [quanLyTT, setQuanLyTT] = useState(false)
  const [quanLyDM, setQuanLyDM] = useState(false)
  const [donMoiKhach, setDonMoiKhach] = useState(null)

  const [cotHien, setCotHien] = useState(() => {
    try {
      const luu = JSON.parse(localStorage.getItem(KHOA_LUU_COT) || 'null')
      if (luu) return luu
    } catch { /* bo qua */ }
    return Object.fromEntries(COT.map((c) => [c.key, c.macDinh !== false]))
  })
  const [moChonCot, setMoChonCot] = useState(false)
  const [chiaMode, setChiaMode] = useState(null)   // 'chon' | 'nghi'
  const [tomTat, setTomTat] = useState({ nhatKy: {}, traoDoi: {}, luotCS: {} })
  const [donHang, setDonHang] = useState([])
  const [dangTaiCot, setDangTaiCot] = useState(true)   // đang tải cột trao đổi / lượt chăm sóc / doanh thu → chưa cho tải Excel
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
  const [phoneHits, setPhoneHits] = useState({ q: '', ds: [] })   // kết quả tra cứu SĐT, kèm chuỗi đã tra
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [boLoc, setBoLoc] = useState(BO_LOC_TRONG)
  const [trang, setTrang] = useState(1)
  // Đổi bộ lọc → quay về trang 1
  function datLoc(k, v) {
    if (boLoc[k] === v) return
    setBoLoc({ ...boLoc, [k]: v })
    setTrang(1)
  }
  function xoaLoc() {
    if (boLoc === BO_LOC_TRONG) return
    setBoLoc(BO_LOC_TRONG)
    setTrang(1)
  }
  const phongBanCua = (id) => profiles.find((p) => p.id === id)?.phong_ban || ''
  const [showForm, setShowForm] = useState(false)
  const [taiLen, setTaiLen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [viewingCustomer, setViewingCustomer] = useState(null)
  // Hồ sơ đang mở ghi lên địa chỉ web (…/#/khach-hang/<id>) để F5 vẫn mở lại và gửi link cho đồng nghiệp được
  function moHoSo(c) {
    setViewingCustomer(c)
    window.history.replaceState(null, '', `#/khach-hang/${c.id}`)
  }
  function dongHoSo() {
    setViewingCustomer(null)
    window.history.replaceState(null, '', '#/khach-hang')
  }
  const daMoTuLink = useRef(false)

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
        : 'Không xoá được: ' + loiDeHieu(error))
      return
    }
    loadCustomers()
  }

  // Gõ đủ số điện thoại -> tra cứu được cả khách của sale khác
  const search = boLoc.search
  useEffect(() => {
    if (chuanSo(search).length < 8) return   // số chưa đủ dài: không tra (kết quả cũ tự ẩn, xem nguon bên dưới)
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc('tim_khach_theo_sdt', { p_sdt: search })
      // Chỉ nhận hồ sơ được phép xem (hoặc khách đã chốt); hồ sơ của người khác bị ẩn thông tin
      setPhoneHits({ q: search, ds: (data || []).map((r) => r.thong_tin).filter(Boolean) })
    }, 400)
    return () => clearTimeout(t)
  }, [search])

  async function loadProfiles() {
    const { data } = await layNhanSu()
    setProfiles(data || [])
  }

  async function loadCustomers() {
    setLoading(true)
    setDangTaiCot(true)
    // Tóm tắt nhật ký / chăm sóc và đơn hàng tải song song với danh sách khách
    const dangTaiThem = Promise.all([
      taiTomTatKhach(),
      layHet(() => supabase.from('orders').select('customer_id, gia_tri, trang_thai').order('id')),
    ])
    const { data } = await layHet(() => supabase.from('customers').select('*').order('created_at', { ascending: false }).order('id'))
    setCustomers(data || [])
    setLoading(false)
    // Lần tải đầu: mở trang bằng link có mã hồ sơ (…/#/khach-hang/<id>) → mở hồ sơ đó nếu người xem được phép thấy khách
    if (!daMoTuLink.current) {
      daMoTuLink.current = true
      const id = window.location.hash.match(/^#\/khach-hang\/([^/?]+)/)?.[1]
      const k = id && (data || []).find((c) => String(c.id) === decodeURIComponent(id))
      if (k) setViewingCustomer(k)
      else if (id) window.history.replaceState(null, '', '#/khach-hang')
    }
    // Cột "Cập nhật gần nhất", "Trao đổi gần nhất", số lượt chăm sóc và "Tổng doanh thu"
    try {
      const [tt, { data: dh }] = await dangTaiThem
      setTomTat(tt)
      setDonHang(dh || [])
    } finally {
      setDangTaiCot(false)   // lỗi mạng cũng mở lại nút, không khoá mãi
    }
  }

  const isAdmin = laAdmin(currentProfile)
  const uids = useMemo(() => nhanSuXemDuoc(currentProfile, profiles), [currentProfile, profiles])   // null = xem tất cả
  const dsSale = useMemo(() => locNhanSu(currentProfile, profiles), [currentProfile, profiles])   // admin: tất cả · leader: team · sale: chính mình

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
      if (k) moHoSo(k)
    }
    window.addEventListener('mo-ho-so', mo)
    return () => window.removeEventListener('mo-ho-so', mo)
  }, [customers])

  // Gộp kết quả tra cứu SĐT vào danh sách, không trùng lặp
  const nguon = useMemo(() => {
    const map = new Map(customers.map((c) => [c.id, c]))
    // Chỉ dùng kết quả tra đúng chuỗi đang gõ
    for (const c of phoneHits.q === search ? phoneHits.ds : []) if (!map.has(c.id)) map.set(c.id, { ...c, _tuTraCuu: true })
    return [...map.values()]
  }, [customers, phoneHits, search])

  const filtered = useMemo(() => {
    const phongCua = (id) => profiles.find((p) => p.id === id)?.phong_ban || ''
    return locKhach(nguon, boLoc, { phongBanCua: phongCua })
  }, [nguon, boLoc, profiles])

  // Danh sách áp dụng mọi bộ lọc TRỪ bộ lọc trạng thái,
  // để mỗi thẻ trạng thái vẫn hiện đúng số khi đang chọn một trạng thái
  const nenDem = useMemo(() => {
    const phongCua = (id) => profiles.find((p) => p.id === id)?.phong_ban || ''
    const xemDuoc = (id) => uids === null || (!!id && uids.has(id))
    return locKhach(nguon, boLoc, { phongBanCua: phongCua, xemDuoc, boTrangThai: true })
  }, [nguon, boLoc, profiles, uids])

  const demTheoTrangThai = useMemo(() => {
    const m = {}
    for (const o of TRANG_THAI) m[o.ma] = 0
    for (const c of nenDem) if (m[c.trang_thai_cham_soc] !== undefined) m[c.trang_thai_cham_soc] += 1
    return m
  }, [nenDem, TRANG_THAI])

  const dsPhongBan = useMemo(() => [...new Set((laQuanLy(currentProfile) ? dsSale : profiles).map((p) => p.phong_ban).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi')), [dsSale, profiles, currentProfile])
  const profileName = (id) => profiles.find((p) => p.id === id)?.full_name || 'Chưa gán'

  const { traoDoi, luotCS, nhatKy: nhatKyGanNhat } = tomTat
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
    setTrang(1)
    setSapXep((s) => (s.cot === cot ? { cot, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { cot, dir: cot === 'doanh_thu' || cot === 'trao_doi' ? 'desc' : 'asc' }))
  }

  const phanTrang = useMemo(() => daSapXep.slice((trang - 1) * 20, trang * 20), [daSapXep, trang])

  // Tải Excel: các khách đã tích chọn, hoặc toàn bộ kết quả đang lọc nếu chưa chọn khách nào
  async function taiExcel() {
    if (dangTaiCot) return   // chưa tải xong cột trao đổi / lượt chăm sóc / doanh thu thì file sẽ thiếu số liệu
    const ds = daChon.size > 0 ? daSapXep.filter((c) => daChon.has(c.id)) : daSapXep
    const XLSX = await import('xlsx')
    const rows = dongExcelKhach(ds, { profileName, phongBanCua, tenTrangThai, luotCS, traoDoi, doanhThu })
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
      if (error) { alert('Không xoá được: ' + loiDeHieu(error)); loadCustomers(); return }
    }
    setDaChon(new Set())
    loadCustomers()
  }

  // Chọn nhiều khách (ô tích đầu dòng)
  const chonTatCaTrang = phanTrang.length > 0 && phanTrang.every((c) => daChon.has(c.id))
  function toggleChon(id) {
    setDaChon((cu) => {
      const m = new Set(cu)
      if (m.has(id)) m.delete(id)
      else m.add(id)
      return m
    })
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
          active={boLoc.trangThai === ''}
          onClick={() => datLoc('trangThai', '')}
        />
        {TRANG_THAI.map((o) => (
          <StatCard
            key={o.ma}
            label={o.ten}
            value={demTheoTrangThai[o.ma] || 0}
            active={boLoc.trangThai === o.ma}
            onClick={() => datLoc('trangThai', boLoc.trangThai === o.ma ? '' : o.ma)}
          />
        ))}
      </div>
      <p className="px-8 pt-2 text-xs text-ink-400">
        Tổng khách theo từng trạng thái · {isAdmin ? 'toàn team' : 'khách của bạn'} · thay đổi theo bộ lọc bên dưới · bấm vào thẻ để lọc
      </p>

      <BoLocKhach boLoc={boLoc} datLoc={datLoc} xoaLoc={xoaLoc}
        dsPhongBan={dsPhongBan} dsSaleLoc={laQuanLy(currentProfile) ? dsSale : profiles} />

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
          <button type="button" onClick={taiExcel} disabled={dangTaiCot}
            title={dangTaiCot ? 'Đang tải số lượt chăm sóc, trao đổi gần nhất và doanh thu — chờ vài giây' : undefined}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-ink-600 hover:border-coral-500 hover:text-coral-500 disabled:cursor-wait disabled:opacity-50 disabled:hover:border-slate-200 disabled:hover:text-ink-600">
            <Download size={15} /> {dangTaiCot ? 'Đang tải số liệu…' : daChon.size > 0 ? `Tải Excel (${daChon.size} khách)` : 'Tải Excel'}
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
              const cuaMinh = c.sale_id === currentProfile?.id || (!isAdmin && !!c.sale_id && !!uids?.has(c.sale_id))
              return (
                <DongKhach key={c.id} c={c} idx={(trang - 1) * 20 + idxTrang} hien={hien} doRong={doRong}
                  dongChon={daChon.has(c.id)} cuaMinh={cuaMinh} coTheXoa={isAdmin || cuaMinh}
                  td={traoDoi[c.id]} soCS={luotCS[c.id] || 0} soTrung={demTrung.get(chuanSo(c.sdt)) || 0}
                  nhatKy={nhatKyGanNhat[c.id]} profileName={profileName} phongBan={phongBanCua(c.sale_id)}
                  onMo={() => moHoSo(c)} onChon={() => toggleChon(c.id)}
                  onLocSdt={() => datLoc('search', c.sdt)} onXoa={() => xoaKhach(c)} />
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
        <TaiKhachLenModal profiles={dsSale} currentProfile={currentProfile}
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
          onClose={dongHoSo}
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
