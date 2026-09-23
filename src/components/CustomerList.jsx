import { useEffect, useMemo, useState } from 'react'
import { Plus, Search, Link2, Store, Users2, Trash2, Settings2, Columns3 } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { Button, Input, Select, Badge } from './ui'
import CustomerForm from './CustomerForm'
import CustomerDetail from './CustomerDetail'
import OrderForm from './OrderForm'
import StatusesModal from './StatusesModal'
import { useTrangThai } from '../lib/StatusContext'
import {
  NEN_TANG_OPTIONS,
  DICH_VU_OPTIONS,
  LOAI_KHACH_OPTIONS,
  NGUON_KHACH_OPTIONS,
  classOf,
  labelOf,
} from '../lib/constants'

// Khách "chung" — cả team đều xem được (khớp với hàm la_khach_chung trong database)


const chiSo = (s) => (s || '').replace(/\D/g, '')


export default function CustomerList({ currentProfile }) {
  const { options: TRANG_THAI, tenTrangThai, classTrangThai, laKhachChung } = useTrangThai()
  const [quanLyTT, setQuanLyTT] = useState(false)
  const [donMoiKhach, setDonMoiKhach] = useState(null)

  // Các cột có thể bật/tắt (Khách hàng và Thao tác luôn hiển thị)
  const COT = [
    { key: 'stt', label: 'STT' },
    { key: 'sdt', label: 'Số điện thoại' },
    { key: 'nen_tang', label: 'Nền tảng' },
    { key: 'dich_vu', label: 'Dịch vụ' },
    { key: 'nguon', label: 'Nguồn' },
    { key: 'loai', label: 'Loại' },
    { key: 'trang_thai', label: 'Trạng thái' },
    { key: 'sale', label: 'Sale phụ trách' },
    { key: 'ngay_tao', label: 'Ngày tạo data' },
    { key: 'lien_he', label: 'Liên hệ gần nhất' },
    { key: 'van_de', label: 'Vấn đề', macDinh: false },
    { key: 'giai_phap', label: 'Giải pháp', macDinh: false },
    { key: 'nhat_ky', label: 'Cập nhật gần nhất', macDinh: false },
  ]
  const [cotHien, setCotHien] = useState(() => {
    try {
      const luu = JSON.parse(localStorage.getItem('tuki_cot_khach') || 'null')
      if (luu) return luu
    } catch { /* bo qua */ }
    return Object.fromEntries(COT.map((c) => [c.key, c.macDinh !== false]))
  })
  const [moChonCot, setMoChonCot] = useState(false)
  const [nhatKyGanNhat, setNhatKyGanNhat] = useState({})
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
    try { localStorage.setItem('tuki_cot_khach', JSON.stringify(moi)) } catch { /* bo qua */ }
  }
  const soCot = 2 + COT.filter((c) => hien(c.key)).length  // Khách hàng + Thao tác + cột bật
  const [customers, setCustomers] = useState([])
  const [phoneHits, setPhoneHits] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterLoai, setFilterLoai] = useState('')
  const [filterTrangThai, setFilterTrangThai] = useState('')
  const [filterSale, setFilterSale] = useState('')
  const [filterDichVu, setFilterDichVu] = useState('')
  const [filterNguon, setFilterNguon] = useState('')
  const [locTheoNgay, setLocTheoNgay] = useState('lien_he')
  const [tuNgay, setTuNgay] = useState('')
  const [denNgay, setDenNgay] = useState('')
  const [showForm, setShowForm] = useState(false)
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
      setPhoneHits(data || [])
    }, 400)
    return () => clearTimeout(t)
  }, [search])

  async function loadProfiles() {
    const { data } = await supabase.from('profiles').select('*').order('full_name')
    setProfiles(data || [])
  }

  async function loadCustomers() {
    setLoading(true)
    const { data } = await supabase.from('customers').select('*').order('created_at', { ascending: false })
    setCustomers(data || [])
    setLoading(false)
    // Lấy dòng nhật ký mới nhất cho mỗi khách (để hiện cột "Cập nhật gần nhất")
    const { data: logs } = await supabase.from('customer_logs')
      .select('customer_id, hanh_dong, user_id, created_at')
      .order('created_at', { ascending: false })
      .limit(2000)
    const map = {}
    for (const l of logs || []) if (!map[l.customer_id]) map[l.customer_id] = l
    setNhatKyGanNhat(map)
  }

  const isAdmin = currentProfile?.role === 'admin'

  // Gộp kết quả tra cứu SĐT vào danh sách, không trùng lặp
  const nguon = useMemo(() => {
    const map = new Map(customers.map((c) => [c.id, c]))
    for (const c of phoneHits) if (!map.has(c.id)) map.set(c.id, { ...c, _tuTraCuu: true })
    return [...map.values()]
  }, [customers, phoneHits])

  const filtered = useMemo(() => {
    return nguon.filter((c) => {
      if (search && !`${c.ten_khach} ${c.ma_khach} ${c.sdt || ''} ${c.nganh_hang || ''}`.toLowerCase().includes(search.toLowerCase())) {
        if (!c._tuTraCuu) return false
      }
      if (filterLoai && c.loai_khach !== filterLoai) return false
      if (filterTrangThai && c.trang_thai_cham_soc !== filterTrangThai) return false
      if (filterSale && c.sale_id !== filterSale) return false
      if (filterDichVu && !(c.dich_vu || []).includes(filterDichVu)) return false
      if (filterNguon && c.nguon_khach !== filterNguon) return false
      const ngayLoc = locTheoNgay === 'tao' ? (c.created_at || '').slice(0, 10) : c.ngay_lien_he_gan_nhat
      if (tuNgay && (!ngayLoc || ngayLoc < tuNgay)) return false
      if (denNgay && (!ngayLoc || ngayLoc > denNgay)) return false
      return true
    })
  }, [nguon, search, filterLoai, filterTrangThai, filterSale, filterDichVu, filterNguon, locTheoNgay, tuNgay, denNgay, isAdmin, currentProfile?.id])

  // Danh sách áp dụng mọi bộ lọc TRỪ bộ lọc trạng thái,
  // để mỗi thẻ trạng thái vẫn hiện đúng số khi đang chọn một trạng thái
  const nenDem = useMemo(() => nguon.filter((c) => {
    if (!isAdmin && c.sale_id !== currentProfile?.id) return false
    if (search && !`${c.ten_khach} ${c.ma_khach} ${c.sdt || ''} ${c.nganh_hang || ''}`.toLowerCase().includes(search.toLowerCase())) {
      if (!c._tuTraCuu) return false
    }
    if (filterLoai && c.loai_khach !== filterLoai) return false
    if (filterSale && c.sale_id !== filterSale) return false
    if (filterDichVu && !(c.dich_vu || []).includes(filterDichVu)) return false
    if (filterNguon && c.nguon_khach !== filterNguon) return false
    const ngayLoc = locTheoNgay === 'tao' ? (c.created_at || '').slice(0, 10) : c.ngay_lien_he_gan_nhat
    if (tuNgay && (!ngayLoc || ngayLoc < tuNgay)) return false
    if (denNgay && (!ngayLoc || ngayLoc > denNgay)) return false
    return true
  }), [nguon, isAdmin, currentProfile?.id, search, filterLoai, filterSale, filterDichVu, filterNguon, locTheoNgay, tuNgay, denNgay])

  const demTheoTrangThai = useMemo(() => {
    const m = {}
    for (const o of TRANG_THAI) m[o.ma] = 0
    for (const c of nenDem) if (m[c.trang_thai_cham_soc] !== undefined) m[c.trang_thai_cham_soc] += 1
    return m
  }, [nenDem, TRANG_THAI])


  const profileName = (id) => profiles.find((p) => p.id === id)?.full_name || 'Chưa gán'

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
          <Select value={filterLoai} onChange={(e) => setFilterLoai(e.target.value)} className="w-40">
            <option value="">Tất cả loại khách</option>
            {LOAI_KHACH_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
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
          <Select value={filterNguon} onChange={(e) => setFilterNguon(e.target.value)} className="w-44">
            <option value="">Tất cả nguồn</option>
            {NGUON_KHACH_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
          <Select value={filterSale} onChange={(e) => setFilterSale(e.target.value)} className="w-44">
            <option value="">Tất cả sale</option>
            {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </Select>
          <div className="flex items-center gap-2 text-sm text-ink-600">
            <Select value={locTheoNgay} onChange={(e) => setLocTheoNgay(e.target.value)} className="w-36">
              <option value="lien_he">Ngày liên hệ</option>
              <option value="tao">Ngày tạo data</option>
            </Select>
            <span>từ</span>
            <Input type="date" value={tuNgay} onChange={(e) => setTuNgay(e.target.value)} className="w-40" />
            <span>đến</span>
            <Input type="date" value={denNgay} onChange={(e) => setDenNgay(e.target.value)} className="w-40" />
          </div>
          {(search || filterLoai || filterTrangThai || filterSale || filterDichVu || filterNguon || tuNgay || denNgay) && (
            <button
              onClick={() => { setSearch(''); setFilterLoai(''); setFilterTrangThai(''); setFilterSale(''); setFilterDichVu(''); setFilterNguon(''); setLocTheoNgay('lien_he'); setTuNgay(''); setDenNgay('') }}
              className="text-sm text-ink-600 hover:text-coral-500">
              Xoá bộ lọc
            </button>
          )}
        </div>
      </div>

      <div className="mx-8 mt-4 flex items-center justify-end">
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

      <div className="mx-8 mb-6 mt-2 overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full text-sm" style={{ tableLayout: 'auto' }}>
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-ink-400">
              {hien('stt') && <ThResize colKey="stt" doRong={doRong} onResize={luuDoRong}>STT</ThResize>}
              <ThResize colKey="ten" doRong={doRong} onResize={luuDoRong}>Khách hàng</ThResize>
              {hien('sdt') && <ThResize colKey="sdt" doRong={doRong} onResize={luuDoRong}>Số điện thoại</ThResize>}
              {hien('nen_tang') && <ThResize colKey="nen_tang" doRong={doRong} onResize={luuDoRong}>Nền tảng</ThResize>}
              {hien('dich_vu') && <ThResize colKey="dich_vu" doRong={doRong} onResize={luuDoRong}>Dịch vụ</ThResize>}
              {hien('nguon') && <ThResize colKey="nguon" doRong={doRong} onResize={luuDoRong}>Nguồn</ThResize>}
              {hien('loai') && <ThResize colKey="loai" doRong={doRong} onResize={luuDoRong}>Loại</ThResize>}
              {hien('trang_thai') && <ThResize colKey="trang_thai" doRong={doRong} onResize={luuDoRong}>Trạng thái</ThResize>}
              {hien('sale') && <ThResize colKey="sale" doRong={doRong} onResize={luuDoRong}>Sale phụ trách</ThResize>}
              {hien('ngay_tao') && <ThResize colKey="ngay_tao" doRong={doRong} onResize={luuDoRong}>Ngày tạo data</ThResize>}
              {hien('lien_he') && <ThResize colKey="lien_he" doRong={doRong} onResize={luuDoRong}>Liên hệ gần nhất</ThResize>}
              {hien('van_de') && <ThResize colKey="van_de" doRong={doRong} onResize={luuDoRong}>Vấn đề</ThResize>}
              {hien('giai_phap') && <ThResize colKey="giai_phap" doRong={doRong} onResize={luuDoRong}>Giải pháp</ThResize>}
              {hien('nhat_ky') && <ThResize colKey="nhat_ky" doRong={doRong} onResize={luuDoRong}>Cập nhật gần nhất</ThResize>}
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={soCot} className="px-5 py-8 text-center text-ink-400">Đang tải...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={soCot} className="px-5 py-8 text-center text-ink-400">Chưa có khách hàng nào phù hợp.</td></tr>
            ) : filtered.map((c, idx) => {
              const chung = laKhachChung(c)
              const cuaMinh = c.sale_id === currentProfile?.id
              return (
                <tr key={c.id}
                  className={`cursor-pointer border-b border-slate-100 last:border-0 hover:bg-coral-50/40 ${
                    idx % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'
                  }`}
                  onClick={() => setViewingCustomer(c)}>
                  {hien('stt') && <td className="px-4 py-3 text-ink-400">{idx + 1}</td>}
                  <td className="px-4 py-3" style={doRong.ten ? { maxWidth: doRong.ten } : undefined}>
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium text-navy-900">{c.ten_khach}</p>
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
                  </td>
                  {hien('sdt') && <td className="px-4 py-3 text-ink-600">{c.sdt || '—'}</td>}
                  {hien('nen_tang') && (
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(c.nen_tang || []).map((nt) => (
                        <Badge key={nt} className={classOf(NEN_TANG_OPTIONS, nt)}>{labelOf(NEN_TANG_OPTIONS, nt)}</Badge>
                      ))}
                    </div>
                  </td>)}
                  {hien('dich_vu') && (
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(c.dich_vu || []).map((dv) => (
                        <Badge key={dv} className={classOf(DICH_VU_OPTIONS, dv)}>{labelOf(DICH_VU_OPTIONS, dv)}</Badge>
                      ))}
                    </div>
                  </td>)}
                  {hien('nguon') && <td className="px-4 py-3 text-ink-600">{labelOf(NGUON_KHACH_OPTIONS, c.nguon_khach) || '—'}</td>}
                  {hien('loai') && (
                  <td className="px-4 py-3">
                    <Badge className={c.loai_khach === 'moi' ? 'bg-coral-50 text-coral-600' : 'bg-slate-100 text-slate-600'}>
                      {labelOf(LOAI_KHACH_OPTIONS, c.loai_khach)}
                    </Badge>
                  </td>)}
                  {hien('trang_thai') && (
                  <td className="px-4 py-3">
                    <Badge className={classTrangThai(c.trang_thai_cham_soc)}>
                      {tenTrangThai(c.trang_thai_cham_soc)}
                    </Badge>
                  </td>)}
                  {hien('sale') && <td className="px-4 py-3 text-ink-600">{profileName(c.sale_id)}</td>}
                  {hien('ngay_tao') && <td className="px-4 py-3 text-ink-600">{(c.created_at || '').slice(0, 10) || '—'}</td>}
                  {hien('lien_he') && <td className="px-4 py-3 text-ink-600">{c.ngay_lien_he_gan_nhat || '—'}</td>}
                  {hien('van_de') && (
                    <td className="px-4 py-3 text-ink-600" style={{ maxWidth: doRong.van_de || 220 }}>
                      <p className="line-clamp-2 whitespace-pre-wrap">{c.van_de || '—'}</p>
                    </td>
                  )}
                  {hien('giai_phap') && (
                    <td className="px-4 py-3 text-ink-600" style={{ maxWidth: doRong.giai_phap || 220 }}>
                      <p className="line-clamp-2 whitespace-pre-wrap">{c.giai_phap || '—'}</p>
                    </td>
                  )}
                  {hien('nhat_ky') && (
                    <td className="px-4 py-3 text-ink-600">
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
                  <td className="whitespace-nowrap px-4 py-3 text-right">
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

      {quanLyTT && <StatusesModal onClose={() => setQuanLyTT(false)} />}

      {showForm && (
        <CustomerForm
          customer={editingCustomer}
          profiles={profiles}
          currentProfile={currentProfile}
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
          customer={viewingCustomer}
          currentProfile={currentProfile}
          onClose={() => setViewingCustomer(null)}
          onChanged={loadCustomers}
          onEdit={(c) => { setViewingCustomer(null); setEditingCustomer(c); setShowForm(true) }}
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

function ThResize({ colKey, doRong, onResize, children }) {
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
  return (
    <th className="relative select-none px-4 py-3"
      style={rong ? { width: rong, maxWidth: rong } : undefined}>
      <span className="block truncate pr-2">{children}</span>
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
