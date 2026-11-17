import { useEffect, useState } from 'react'
import {
  X, Phone, MessageCircle, Users as UsersIcon, MoreHorizontal, Plus,
  Link2, Store, HandHeart, CircleAlert, CircleCheck, History, Check, Trash2, CalendarClock, FileText, ShoppingBag,
  FileDown, Eye,
} from 'lucide-react'
import { supabase } from '../supabaseClient'
import { Button, Textarea, Select, Badge, Input } from './ui'
import { useTrangThai } from '../lib/StatusContext'
import { XuatHopDongForm, hdTuHopDongDaLuu } from './ContractsPage'
import ContractPreview from './ContractPreview'
import OrderForm from './OrderForm'
import BenBModal from './BenBModal'
import { useBenB } from '../lib/benB'
import { nhacChoHopDong, hanDichVu, dinhDangNgay, moTaConLai } from '../lib/taiKy'
import { baoCaoKeTiep, moTaHanBaoCao } from '../lib/baoCaoAds'
import BaoCaoAdsModal from './BaoCaoAdsModal'
import {
  LOAI_TUONG_TAC_OPTIONS, NEN_TANG_OPTIONS,
  DICH_VU_OPTIONS, NGUON_KHACH_OPTIONS, LOAI_KHACH_OPTIONS,
  TRANG_THAI_HD_OPTIONS, TINH_THANH,
  classOf, labelOf, formatVnd,
} from '../lib/constants'

const ICONS = { goi_dien: Phone, nhan_tin: MessageCircle, gap_mat: UsersIcon, khac: MoreHorizontal }



export default function CustomerDetail({ customer: khachBanDau, currentProfile, onClose, onChanged }) {
  const { options: TRANG_THAI, tenTrangThai, classTrangThai, laKhachChung, maTaoDon } = useTrangThai()
  const [customer, setCustomer] = useState(khachBanDau)
  const [tab, setTab] = useState('thong_tin')
  const [interactions, setInteractions] = useState([])
  const [logs, setLogs] = useState([])
  const [donHang, setDonHang] = useState([])
  const [hopDong, setHopDong] = useState([])
  const [dvTheoDon, setDvTheoDon] = useState({})
  const [profiles, setProfiles] = useState([])
  const [packages, setPackages] = useState([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [xuatHD, setXuatHD] = useState(null)   // { hd, don }
  const [xemHD, setXemHD] = useState(null)
  const [donMoi, setDonMoi] = useState(false)
  const [baoCaoAds, setBaoCaoAds] = useState([])        // các lần đã báo cáo chỉ số ADS của khách
  const [ghiBaoCao, setGhiBaoCao] = useState(null)       // { hd, lanThu } — mở cửa sổ ghi nhận đã báo cáo
  const [taiKyPreset, setTaiKyPreset] = useState(null)   // { hd, donGanNhat } — mở form tái ký cho 1 hợp đồng

  const cuaMinh = customer.sale_id === currentProfile?.id
  const chung = laKhachChung(customer)
  const isAdmin = currentProfile?.role === 'admin'
  const { benB, taiLai: taiLaiBenB } = useBenB()
  const [moBenB, setMoBenB] = useState(false)
  const suaDuoc = cuaMinh || isAdmin || chung || !customer.sale_id

  useEffect(() => { load() }, [customer.id])

  async function load() {
    setLoading(true)
    const [{ data: it }, { data: lg }, { data: pf }, { data: od }, { data: ct }, { data: pk }, { data: bcAds }] = await Promise.all([
      supabase.from('customer_interactions').select('*').eq('customer_id', customer.id)
        .order('ngay_thuc_hien', { ascending: false }),
      supabase.from('customer_logs').select('*').eq('customer_id', customer.id)
        .order('created_at', { ascending: false }).limit(50),
      supabase.from('profiles').select('id, full_name'),
      supabase.from('orders').select('*').eq('customer_id', customer.id).order('ngay_chot', { ascending: false }),
      supabase.from('contracts').select('*').eq('customer_id', customer.id).order('ngay_ky', { ascending: false }),
      supabase.from('service_packages').select('*'),
      supabase.from('ads_bao_cao').select('*').eq('customer_id', customer.id).order('ngay_bao_cao', { ascending: false }),
    ])
    setBaoCaoAds(bcAds || [])
    setInteractions(it || []); setLogs(lg || []); setProfiles(pf || [])
    setDonHang(od || []); setHopDong(ct || [])
    setPackages(pk || [])

    const ids = (od || []).map((o) => o.id)
    if (ids.length) {
      const { data: dv } = await supabase.from('order_items').select('*').in('order_id', ids)
      const g = {}
      for (const i of dv || []) g[i.order_id] = [...(g[i.order_id] || []), i]
      setDvTheoDon(g)
    } else setDvTheoDon({})
    setLoading(false)
  }

  const tenNguoi = (id) => profiles.find((p) => p.id === id)?.full_name || 'Không rõ'

  async function nhanKhach() {
    if (!window.confirm(`Nhận ${customer.ten_khach} về phụ trách? Sale cũ sẽ không còn thấy khách này trong danh sách riêng.`)) return
    const { error } = await supabase.from('customers')
      .update({ sale_id: currentProfile.id }).eq('id', customer.id)
    if (error) { setMsg('Lỗi: ' + error.message); return }
    setCustomer({ ...customer, sale_id: currentProfile.id })
    setMsg('')
    load(); onChanged?.()
  }

  async function xoaTuongTac(it) {
    if (!window.confirm('Xoá dòng lịch sử chăm sóc này?')) return
    const { error } = await supabase.from('customer_interactions').delete().eq('id', it.id)
    if (error) { setMsg('Không xoá được: ' + error.message); return }
    setMsg(''); load(); onChanged?.()
  }

  async function doiTrangThai(tt) {
    const truoc = customer.trang_thai_cham_soc
    const { error } = await supabase.from('customers')
      .update({ trang_thai_cham_soc: tt }).eq('id', customer.id)
    if (error) { setMsg('Lỗi: ' + error.message); return }
    const moi = { ...customer, trang_thai_cham_soc: tt }
    setCustomer(moi)
    load(); onChanged?.()

    // Vừa chuyển sang Chốt hợp đồng -> mở form tạo đơn dịch vụ ngay tại đây
    if (maTaoDon.includes(tt) && !maTaoDon.includes(truoc)) {
      setDonMoi(true)
    }
  }

  const tongGiaTriDon = donHang.reduce((s, o) => s + (Number(o.gia_tri) || 0), 0)

  async function xoaDon(o) {
    if (!window.confirm(`Xoá đơn ${o.ma_don}? Thao tác này không hoàn tác được, hợp đồng gắn với đơn (nếu có) cũng sẽ bị xoá theo.`)) return
    const { error } = await supabase.from('orders').delete().eq('id', o.id)
    if (error) { setMsg('Không xoá được: ' + error.message); return }
    setMsg(''); load(); onChanged?.()
  }

  async function xoaBaoCaoAds(b) {
    if (!window.confirm(`Xoá lần báo cáo ngày ${dinhDangNgay(b.ngay_bao_cao)}? Lịch nhắc báo cáo sẽ tính lại.`)) return
    const { error } = await supabase.from('ads_bao_cao').delete().eq('id', b.id)
    if (error) { setMsg('Không xoá được: ' + error.message); return }
    setMsg(''); load()
  }

  async function xoaHopDong(hd) {
    if (!window.confirm(`Xoá hợp đồng ${hd.so_hop_dong}? Thao tác này không hoàn tác được. Đơn dịch vụ liên quan vẫn được giữ nguyên.`)) return
    const { error } = await supabase.from('contracts').delete().eq('id', hd.id)
    if (error) { setMsg('Không xoá được: ' + error.message); return }
    setMsg(''); load(); onChanged?.()
  }

  // Form gộp toàn bộ thông tin khách hàng có thể sửa — 1 nút Lưu duy nhất, không cần mở form riêng
  const [formTT, setFormTT] = useState({
    ten_khach: customer.ten_khach || '',
    sdt: customer.sdt || '',
    link_fb: customer.link_fb || '',
    link_shop: customer.link_shop || '',
    nen_tang: customer.nen_tang || [],
    dich_vu: customer.dich_vu || [],
    nganh_hang: customer.nganh_hang || '',
    khu_vuc: customer.khu_vuc || '',
    nguon_khach: customer.nguon_khach || '',
    loai_khach: customer.loai_khach || '',
    sale_id: customer.sale_id || '',
    ngay_cham_soc_tiep_theo: customer.ngay_cham_soc_tiep_theo || '',
    ten_tieu_de_bena: customer.ten_tieu_de_bena || '',
    nguoi_dai_dien: customer.nguoi_dai_dien || '',
    chuc_vu: customer.chuc_vu || '',
    mst: customer.mst || '',
    dia_chi: customer.dia_chi || '',
    so_tai_khoan: customer.so_tai_khoan || '',
  })
  const [dangLuuTT, setDangLuuTT] = useState(false)
  const [luuXongTT, setLuuXongTT] = useState('')

  function toggleArrTT(field, val) {
    setFormTT((f) => ({ ...f, [field]: f[field].includes(val) ? f[field].filter((v) => v !== val) : [...f[field], val] }))
  }

  async function luuThongTin(e) {
    e.preventDefault()
    setDangLuuTT(true)
    const patch = { ...formTT }
    for (const k of Object.keys(patch)) {
      if (!Array.isArray(patch[k]) && patch[k] === '') patch[k] = null
    }
    const { error } = await supabase.from('customers').update(patch).eq('id', customer.id)
    setDangLuuTT(false)
    if (error) {
      setMsg(error.message.includes('SDT_TRUNG')
        ? 'Số điện thoại này đã thuộc về một khách hàng khác trong hệ thống.'
        : 'Không lưu được: ' + error.message)
      return
    }
    setMsg('')
    setCustomer((c) => ({ ...c, ...patch }))
    setLuuXongTT('Đã lưu')
    setTimeout(() => setLuuXongTT(''), 1500)
    onChanged?.()
  }

  const TABS = [
    { key: 'thong_tin', label: 'Thông tin' },
    { key: 'cham_soc', label: `Chăm sóc (${interactions.length})` },
    { key: 'don_hang', label: `Đơn hàng (${donHang.length})` },
    { key: 'hop_dong', label: `Hợp đồng (${hopDong.length})` },
    { key: 'nhat_ky', label: 'Nhật ký' },
  ]

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-navy-950/30 p-4 backdrop-blur-sm">
      <div className="grid h-full max-h-[920px] w-full max-w-6xl grid-cols-1 overflow-y-auto overflow-x-hidden rounded-2xl bg-white shadow-2xl sm:grid-cols-[280px_1fr] sm:overflow-hidden">

        {/* CỘT TRÁI — tóm tắt khách hàng */}
        <div className="flex flex-col overflow-y-auto border-r border-slate-100 bg-slate-50/60 p-5">
          <div className="flex items-start justify-between">
            <div className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-coral-100 font-display text-lg font-bold text-coral-600">
              {(customer.ten_khach || '?').trim().charAt(0).toUpperCase()}
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 text-ink-400 hover:bg-slate-100 hover:text-navy-900">
              <X size={18} />
            </button>
          </div>

          <p className="mt-3 text-xs font-medium uppercase tracking-wide text-ink-400">{customer.ma_khach}</p>
          <h2 className="font-display text-lg font-bold leading-tight text-navy-900">{customer.ten_khach}</h2>

          <div className="mt-2 flex flex-col gap-1.5 text-sm">
            {customer.sdt && (
              <span className="inline-flex items-center gap-1.5 text-ink-600">
                <Phone size={13} className="text-ink-400" /> {customer.sdt}
              </span>
            )}
            {customer.link_fb && (
              <a href={customer.link_fb} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-teal-500 hover:underline">
                <Link2 size={13} /> Facebook
              </a>
            )}
            {customer.link_shop && (
              <a href={customer.link_shop} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-teal-500 hover:underline">
                <Store size={13} /> Link shop
              </a>
            )}
          </div>

          <div className="mt-3">
            {suaDuoc ? (
              <Select value={customer.trang_thai_cham_soc} onChange={(e) => doiTrangThai(e.target.value)}
                className="w-full py-1.5 text-sm">
                {TRANG_THAI.map((o) => <option key={o.ma} value={o.ma}>{o.ten}</option>)}
              </Select>
            ) : (
              <Badge className={classTrangThai(customer.trang_thai_cham_soc)}>
                {tenTrangThai(customer.trang_thai_cham_soc)}
              </Badge>
            )}
          </div>

          <div className="mt-4 rounded-xl border border-slate-100 bg-white p-3">
            <p className="text-xs text-ink-400">Sale phụ trách</p>
            <p className="text-sm font-medium text-navy-900">{tenNguoi(customer.sale_id)}</p>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <StatTile label="Liên hệ gần nhất" value={customer.ngay_lien_he_gan_nhat || '—'} />
            <StatTile label="Lượt chăm sóc" value={interactions.length} />
            <StatTile label="Giá trị đơn" value={formatVnd(tongGiaTriDon)} small />
          </div>

          <div className="mt-3 space-y-2 text-sm">
            <Field label="Ngày tạo" value={(customer.created_at || '').slice(0, 10)} />
          </div>

          {chung && !cuaMinh && (
            <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2.5">
              <p className="text-xs text-amber-800">
                Data chung — hiện do <b>{tenNguoi(customer.sale_id)}</b> phụ trách
              </p>
              <Button onClick={nhanKhach} className="mt-2 w-full px-3 py-1.5 text-xs">
                <HandHeart size={14} /> Nhận khách
              </Button>
            </div>
          )}
          {msg && <p className="mt-2 text-sm text-rose-600">{msg}</p>}
        </div>

        {/* CỘT PHẢI — tab nội dung */}
        <div className="flex min-w-0 flex-col overflow-hidden">
          <div className="flex gap-1 border-b border-slate-100 px-6 pt-4">
            {TABS.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`-mb-px border-b-2 px-3 py-2 text-sm transition ${
                  tab === t.key ? 'border-coral-500 font-medium text-navy-900' : 'border-transparent text-ink-600 hover:text-navy-900'
                }`}>
                {t.label}
              </button>
            ))}
          </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? <p className="text-sm text-ink-400">Đang tải...</p> : (
            <>
              {tab === 'thong_tin' && (
                suaDuoc ? (
                  <form onSubmit={luuThongTin} className="space-y-5">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                      <Input label="Tên khách hàng" value={formTT.ten_khach}
                        onChange={(e) => setFormTT({ ...formTT, ten_khach: e.target.value })} />
                      <Input label="Link Facebook" value={formTT.link_fb}
                        onChange={(e) => setFormTT({ ...formTT, link_fb: e.target.value })} />
                      <Input label="Link shop" value={formTT.link_shop}
                        onChange={(e) => setFormTT({ ...formTT, link_shop: e.target.value })} />
                      <Select label="Khu vực khách ở" value={formTT.khu_vuc}
                        onChange={(e) => setFormTT({ ...formTT, khu_vuc: e.target.value })}>
                        <option value="">-- Chọn tỉnh / thành --</option>
                        {TINH_THANH.map((t) => <option key={t} value={t}>{t}</option>)}
                      </Select>
                      <Input label="Số điện thoại" value={formTT.sdt}
                        onChange={(e) => setFormTT({ ...formTT, sdt: e.target.value })} />
                      <Input label="Ngành hàng" value={formTT.nganh_hang}
                        onChange={(e) => setFormTT({ ...formTT, nganh_hang: e.target.value })} />
                      <Select label="Sale phụ trách" value={formTT.sale_id}
                        onChange={(e) => setFormTT({ ...formTT, sale_id: e.target.value })}>
                        <option value="">-- Chưa gán --</option>
                        {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                      </Select>
                      <Input label="Chăm sóc tiếp theo" type="date" value={formTT.ngay_cham_soc_tiep_theo}
                        onChange={(e) => setFormTT({ ...formTT, ngay_cham_soc_tiep_theo: e.target.value })} />
                    </div>

                    <div className="flex items-center gap-3">
                      <Button type="submit" disabled={dangLuuTT}>
                        {dangLuuTT ? 'Đang lưu...' : 'Lưu thông tin'}
                      </Button>
                      {luuXongTT && <span className="text-sm text-emerald-600">{luuXongTT}</span>}
                    </div>
                  </form>
                ) : (
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                      <Field label="Số điện thoại" value={customer.sdt} />
                      <Field label="Ngành hàng" value={customer.nganh_hang} />
                      <Field label="Khu vực khách ở" value={customer.khu_vuc} />
                      <Field label="Chăm sóc tiếp theo" value={customer.ngay_cham_soc_tiep_theo} />
                    </div>
                  </div>
                )
              )}

              {tab === 'don_hang' && (
                <div className="space-y-3">
                  <button type="button" onClick={() => setDonMoi(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-coral-300 px-3 py-2 text-sm font-medium text-coral-600 hover:bg-coral-50">
                    <Plus size={15} /> Tạo đơn dịch vụ {donHang.length > 0 ? 'khác' : 'mới'}
                  </button>

                  {donHang.length === 0 ? (
                    <p className="text-sm text-ink-400">
                      Khách chưa có đơn dịch vụ nào.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {donHang.map((o) => (
                        <div key={o.id} className="rounded-xl border border-slate-100 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <ShoppingBag size={14} className="text-coral-500" />
                                <p className="font-medium text-navy-900">{o.ma_don}</p>
                                {o.loai_don === 'tai_ky'
                                  ? <Badge className="bg-teal-50 text-teal-600">Tái ký</Badge>
                                  : <Badge className="bg-coral-50 text-coral-600">Mới</Badge>}
                              </div>
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {(dvTheoDon[o.id] || []).map((i) => (
                                  <Badge key={i.id} className="bg-slate-100 text-slate-600">
                                    {i.ten_dich_vu}{i.ten_goi ? ` · ${i.ten_goi}` : ''} · {formatVnd(i.gia)}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            <div className="flex flex-none flex-col items-end gap-1">
                              <p className="font-display font-bold text-coral-500">{formatVnd(o.gia_tri)}</p>
                              <button type="button" onClick={() => xoaDon(o)}
                                className="inline-flex items-center gap-1 text-xs text-ink-400 hover:text-rose-500">
                                <Trash2 size={12} /> Xoá
                              </button>
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-50 pt-3 text-xs text-ink-600">
                            <span>Chốt: <b className="text-navy-900">{o.ngay_chot || '—'}</b></span>
                            {o.so_thang && <span>Thời hạn: <b className="text-navy-900">{o.so_thang} tháng</b></span>}
                          </div>
                          {o.ghi_chu && <p className="mt-2 text-xs text-ink-600">{o.ghi_chu}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {tab === 'hop_dong' && (
                <>
                  {isAdmin && (
                    <button type="button" onClick={() => setMoBenB(true)}
                      className="mb-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-navy-700 hover:bg-slate-50">
                      Sửa thông tin Bên B (bên cung cấp dịch vụ)
                    </button>
                  )}
                {hopDong.length === 0 ? (
                  <p className="text-sm text-ink-400">Khách chưa có hợp đồng nào.</p>
                ) : (
                  <div className="space-y-3">
                    {hopDong.map((hd) => {
                      const donGoc = donHang.find((o) => o.id === hd.order_id)
                      const itemsPhang = Object.values(dvTheoDon).flat()
                      const nhac = nhacChoHopDong(hd, donHang, itemsPhang)
                      const bc = baoCaoKeTiep(hd, donHang, baoCaoAds, (dvTheoDon[hd.order_id] || []))
                      const lichSuBc = baoCaoAds.filter((b) => b.contract_id === hd.id)
                      const hanHienTai = hanDichVu(hd, donHang) || hd.ngay_het_han
                      const daTaiKy = !!hd.ngay_het_han && !!hanHienTai && hanHienTai !== String(hd.ngay_het_han).slice(0, 10)
                      return (
                        <div key={hd.id} className="rounded-xl border border-slate-100 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <FileText size={14} className="text-teal-500" />
                                <p className="font-medium text-navy-900">{hd.so_hop_dong}</p>
                                <Badge className={classOf(TRANG_THAI_HD_OPTIONS, hd.trang_thai)}>
                                  {labelOf(TRANG_THAI_HD_OPTIONS, hd.trang_thai)}
                                </Badge>
                                {nhac && (
                                  <Badge className={nhac.muc === 'qua_han' ? 'bg-rose-100 text-rose-600'
                                    : nhac.muc === 'hom_nay' ? 'bg-coral-50 text-coral-600' : 'bg-amber-100 text-amber-700'}>
                                    Nhắc tái ký · {moTaConLai(nhac.conLai)}
                                  </Badge>
                                )}
                              </div>
                              {donGoc && <p className="mt-1 text-xs text-ink-400">Từ đơn {donGoc.ma_don}</p>}
                            </div>
                            <div className="flex flex-none flex-col items-end gap-1">
                              <p className="font-display font-bold text-coral-500">{formatVnd(hd.gia_tri)}</p>
                              <button type="button" onClick={() => xoaHopDong(hd)}
                                className="inline-flex items-center gap-1 text-xs text-ink-400 hover:text-rose-500">
                                <Trash2 size={12} /> Xoá
                              </button>
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-50 pt-3 text-xs text-ink-600">
                            <span>Ký: <b className="text-navy-900">{hd.ngay_ky || '—'}</b></span>
                            {hanHienTai && (
                              <span>Hết hạn: <b className="text-navy-900">{dinhDangNgay(hanHienTai)}</b>
                                {daTaiKy && <span className="text-teal-600"> (đã gia hạn theo các lần tái ký)</span>}
                              </span>
                            )}
                            {hd.file_url && (
                              <a href={hd.file_url} target="_blank" rel="noreferrer"
                                className="text-teal-500 hover:underline">Mở file</a>
                            )}
                            {hd.loai_dich_vu && (
                              <button type="button" onClick={() => setXemHD(hd)}
                                className="inline-flex items-center gap-1 text-navy-700 hover:text-navy-900">
                                <Eye size={12} /> Xem
                              </button>
                            )}
                            {bc && (
                              <button type="button" onClick={() => setGhiBaoCao({ hd, lanThu: bc.lanThu })}
                                className="inline-flex items-center gap-1 rounded-md bg-violet-600 px-2 py-1 font-medium text-white hover:bg-violet-700">
                                Ghi nhận đã báo cáo ADS
                              </button>
                            )}
                            {nhac && (
                              <button type="button" onClick={() => setTaiKyPreset({ hd, donGanNhat: nhac.donGanNhat })}
                                className="inline-flex items-center gap-1 rounded-md bg-coral-500 px-2 py-1 font-medium text-white hover:bg-coral-600">
                                Tạo đơn tái ký
                              </button>
                            )}
                            {donGoc && (
                              <button type="button" onClick={() => setXuatHD({ hd, don: donGoc })}
                                className="inline-flex items-center gap-1 text-teal-600 hover:text-teal-700">
                                <FileDown size={12} /> Xuất hợp đồng
                              </button>
                            )}
                          </div>

                          {(bc || lichSuBc.length > 0) && (
                            <div className="mt-3 rounded-lg bg-violet-50/60 px-3 py-2 text-xs text-ink-600">
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                <span className="font-medium text-violet-700">Báo cáo chỉ số ADS (2 tuần/lần)</span>
                                <span>Đã báo cáo: <b className="text-navy-900">{lichSuBc.length} lần</b></span>
                                {bc && bc.canBaoCao && (
                                  <span>
                                    Lần kế tiếp: <b className="text-navy-900">{dinhDangNgay(bc.ngayDenHan)}</b>{' '}
                                    <Badge className={bc.conLai < 0 ? 'bg-rose-100 text-rose-600' : bc.conLai <= 2 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}>
                                      {moTaHanBaoCao(bc.conLai)}
                                    </Badge>
                                  </span>
                                )}
                                {bc && !bc.canBaoCao && <span className="text-ink-400">Không còn lần báo cáo nào trong thời gian hợp đồng</span>}
                              </div>
                              {lichSuBc.length > 0 && (
                                <ul className="mt-1.5 space-y-1">
                                  {lichSuBc.slice(0, 4).map((b) => (
                                    <li key={b.id} className="flex items-start justify-between gap-2">
                                      <span>
                                        <b className="text-navy-900">{dinhDangNgay(b.ngay_bao_cao)}</b>
                                        {b.ghi_chu ? ` — ${b.ghi_chu}` : ''}
                                      </span>
                                      <button type="button" onClick={() => xoaBaoCaoAds(b)}
                                        className="flex-none text-ink-400 hover:text-rose-500" title="Xoá lần báo cáo này">
                                        <Trash2 size={11} />
                                      </button>
                                    </li>
                                  ))}
                                  {lichSuBc.length > 4 && <li className="text-ink-400">... và {lichSuBc.length - 4} lần trước đó</li>}
                                </ul>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
                </>
              )}

              {tab === 'cham_soc' && (
                interactions.length === 0
                  ? <p className="text-sm text-ink-400">Chưa có lịch sử chăm sóc nào.</p>
                  : (
                    <ul className="space-y-3">
                      {interactions.map((it) => {
                        const Icon = ICONS[it.loai] || MoreHorizontal
                        return (
                          <li key={it.id} className="flex gap-3 rounded-xl border border-slate-100 p-3">
                            <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-teal-50 text-teal-500">
                              <Icon size={15} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-navy-900">{it.noi_dung}</p>
                              <p className="mt-0.5 text-xs text-ink-400">
                                {tenNguoi(it.sale_id)} · {new Date(it.ngay_thuc_hien).toLocaleString('vi-VN')}
                              </p>
                            </div>
                            {(it.sale_id === currentProfile?.id || isAdmin) && (
                              <button onClick={() => xoaTuongTac(it)}
                                className="flex-none text-ink-400 hover:text-rose-500" title="Xoá">
                                <Trash2 size={14} />
                              </button>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  )
              )}

              {tab === 'nhat_ky' && (
                logs.length === 0
                  ? <p className="text-sm text-ink-400">Chưa có thay đổi nào được ghi nhận.</p>
                  : (
                    <ul className="space-y-2">
                      {logs.map((l) => (
                        <li key={l.id} className="flex gap-3 rounded-xl border border-slate-100 px-3 py-2.5">
                          <History size={14} className="mt-0.5 flex-none text-ink-400" />
                          <div className="min-w-0">
                            <p className="text-sm text-navy-900">
                              <b>{l.hanh_dong}</b>
                              {l.chi_tiet && <span className="text-ink-600"> — {l.chi_tiet}</span>}
                            </p>
                            <p className="text-xs text-ink-400">
                              {tenNguoi(l.user_id)} · {new Date(l.created_at).toLocaleString('vi-VN')}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )
              )}
            </>
          )}
        </div>

        {tab === 'cham_soc' && suaDuoc && (
          <AddInteraction customerId={customer.id} currentProfile={currentProfile}
            ngayHen={customer.ngay_cham_soc_tiep_theo}
            onAdded={(ngayMoi) => {
              if (ngayMoi !== undefined) setCustomer({ ...customer, ngay_cham_soc_tiep_theo: ngayMoi })
              load(); onChanged?.()
            }} />
        )}
        </div>
      </div>

      {ghiBaoCao && (
        <BaoCaoAdsModal
          hd={ghiBaoCao.hd}
          khach={customer}
          lanThu={ghiBaoCao.lanThu}
          currentProfile={currentProfile}
          onClose={() => setGhiBaoCao(null)}
          onSaved={() => { setGhiBaoCao(null); load(); onChanged?.() }}
        />
      )}

      {(donMoi || taiKyPreset) && (
        <OrderForm
          customer={customer}
          profiles={profiles}
          currentProfile={currentProfile}
          {...(taiKyPreset ? {
            loaiBanDau: 'tai_ky',
            taiKyHopDongId: taiKyPreset.hd.id,
            saoChepTuDonId: taiKyPreset.donGanNhat?.id,
          } : {})}
          onClose={() => { setDonMoi(false); setTaiKyPreset(null) }}
          onSaved={() => { setDonMoi(false); setTaiKyPreset(null); load(); onChanged?.() }}
        />
      )}

      {moBenB && (
        <BenBModal benB={benB} onClose={() => setMoBenB(false)} onSaved={taiLaiBenB} />
      )}

      {xuatHD && (
        <XuatHopDongForm
          contract={xuatHD.hd}
          khach={customer}
          don={xuatHD.don}
          dichVu={dvTheoDon[xuatHD.don.id] || []}
          packages={packages}
          onClose={() => setXuatHD(null)}
          onSaved={() => { setXuatHD(null); load() }}
        />
      )}

      {xemHD && (
        <ContractPreview
          hd={hdTuHopDongDaLuu(xemHD, customer, benB)}
          onClose={() => setXemHD(null)}
        />
      )}
    </div>
  )
}

function VanDeGiaiPhap({ customer, suaDuoc, onSaved }) {
  const [vanDe, setVanDe] = useState(customer.van_de || '')
  const [giaiPhap, setGiaiPhap] = useState(customer.giai_phap || '')
  const [goiTuVan, setGoiTuVan] = useState(customer.goi_tu_van || '')
  const [luu, setLuu] = useState('')

  async function ghi(patch) {
    const { error } = await supabase.from('customers').update(patch).eq('id', customer.id)
    if (!error) {
      onSaved(patch)
      setLuu('Đã lưu')
      setTimeout(() => setLuu(''), 1500)
    }
  }

  if (!suaDuoc) {
    return (
      <div className="space-y-3">
        <O nhan="Vấn đề" giaTri={customer.van_de} />
        <O nhan="Giải pháp" giaTri={customer.giai_phap} />
        <O nhan="Gói tư vấn phù hợp" giaTri={customer.goi_tu_van} />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-display font-semibold text-navy-900">Vấn đề &amp; giải pháp</p>
        {luu && <span className="text-xs text-emerald-600">{luu}</span>}
      </div>

      <label className="block">
        <span className="text-xs font-medium text-ink-400">VẤN ĐỀ</span>
        <textarea rows={3} defaultValue={vanDe} placeholder="Vấn đề khách đang gặp..."
          onBlur={(e) => { if (e.target.value !== (customer.van_de || '')) ghi({ van_de: e.target.value || null }) }}
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-coral-500" />
      </label>

      <label className="block">
        <span className="text-xs font-medium text-ink-400">GIẢI PHÁP</span>
        <textarea rows={5} defaultValue={giaiPhap} placeholder="Giải pháp tư vấn cho khách..."
          onBlur={(e) => { if (e.target.value !== (customer.giai_phap || '')) ghi({ giai_phap: e.target.value || null }) }}
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-coral-500" />
      </label>

      <label className="block">
        <span className="text-xs font-medium text-ink-400">GÓI TƯ VẤN PHÙ HỢP</span>
        <textarea rows={2} defaultValue={goiTuVan} placeholder="VD: Gói Chạy quảng cáo Pro 3 tháng + Xây shop VIP 1..."
          onBlur={(e) => { if (e.target.value !== (customer.goi_tu_van || '')) ghi({ goi_tu_van: e.target.value || null }) }}
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-coral-500" />
      </label>

      <p className="text-xs text-ink-400">Tự lưu khi bạn bấm ra ngoài ô.</p>
    </div>
  )
}

function O({ nhan, giaTri }) {
  return (
    <div>
      <p className="text-xs font-medium text-ink-400">{nhan}</p>
      <p className="mt-0.5 whitespace-pre-wrap text-sm text-navy-900">{giaTri || '—'}</p>
    </div>
  )
}

function StatTile({ label, value, small }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white px-1.5 py-2">
      <p className={`font-display font-bold text-navy-900 ${small ? 'text-xs' : 'text-sm'}`}>{value}</p>
      <p className="mt-0.5 text-[10px] leading-tight text-ink-400">{label}</p>
    </div>
  )
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-ink-400">{label}</p>
      <p className="font-medium text-navy-900">{value || '—'}</p>
    </div>
  )
}

function AddInteraction({ customerId, currentProfile, ngayHen, onAdded }) {
  const [noiDung, setNoiDung] = useState('')
  const [loai, setLoai] = useState('goi_dien')
  const [ngayTiepTheo, setNgayTiepTheo] = useState('')
  const [saving, setSaving] = useState(false)

  function congNgay(n) {
    const d = new Date()
    d.setDate(d.getDate() + n)
    setNgayTiepTheo(d.toISOString().slice(0, 10))
  }

  async function submit(e) {
    e.preventDefault()
    if (!noiDung.trim()) return
    setSaving(true)
    const { error } = await supabase.from('customer_interactions').insert({
      customer_id: customerId, sale_id: currentProfile?.id, loai, noi_dung: noiDung.trim(),
    })
    if (error) { setSaving(false); return }

    const patch = { ngay_lien_he_gan_nhat: new Date().toISOString().slice(0, 10) }
    if (ngayTiepTheo) patch.ngay_cham_soc_tiep_theo = ngayTiepTheo
    await supabase.from('customers').update(patch).eq('id', customerId)

    setSaving(false)
    setNoiDung('')
    setNgayTiepTheo('')
    onAdded(ngayTiepTheo || undefined)
  }

  const NHANH = [
    { label: 'Mai', ngay: 1 },
    { label: '3 ngày', ngay: 3 },
    { label: '1 tuần', ngay: 7 },
    { label: '2 tuần', ngay: 14 },
  ]

  return (
    <form onSubmit={submit} className="border-t border-slate-100 px-6 py-4">
      <div className="mb-2">
        <Select value={loai} onChange={(e) => setLoai(e.target.value)} className="w-40">
          {LOAI_TUONG_TAC_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      </div>
      <Textarea rows={2} placeholder="Ghi lại nội dung đã trao đổi với khách..."
        value={noiDung} onChange={(e) => setNoiDung(e.target.value)} />

      <div className="mt-3 rounded-xl bg-slate-50 p-3">
        <div className="flex items-center gap-2 text-sm font-medium text-navy-900">
          <CalendarClock size={15} className="text-coral-500" />
          Hẹn chăm sóc lại
          {ngayHen && !ngayTiepTheo && (
            <span className="font-normal text-ink-400">· đang hẹn {ngayHen}</span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {NHANH.map((n) => (
            <button type="button" key={n.ngay} onClick={() => congNgay(n.ngay)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-ink-600 hover:border-coral-500 hover:text-coral-500">
              {n.label}
            </button>
          ))}
          <input type="date" value={ngayTiepTheo} onChange={(e) => setNgayTiepTheo(e.target.value)}
            className="rounded-lg border border-slate-200 px-2 py-1 text-xs outline-none focus:border-coral-500" />
          {ngayTiepTheo && (
            <button type="button" onClick={() => setNgayTiepTheo('')}
              className="text-xs text-ink-400 hover:text-rose-500">Bỏ chọn</button>
          )}
        </div>
      </div>

      <Button type="submit" disabled={saving} className="mt-3 w-full">
        <Plus size={15} /> {saving ? 'Đang lưu...' : 'Lưu chăm sóc' + (ngayTiepTheo ? ' & đặt lịch hẹn' : '')}
      </Button>
    </form>
  )
}
